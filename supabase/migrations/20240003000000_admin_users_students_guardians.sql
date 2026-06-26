-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.admin_users (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now(),
  constraint admin_users_auth_user_id_key unique (auth_user_id)
);

create index admin_users_school_id_idx on public.admin_users(school_id);

create table public.students (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete restrict,
  first_name  text not null,
  year_group  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index students_school_id_idx on public.students(school_id);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create table public.guardians (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger guardians_set_updated_at
  before update on public.guardians
  for each row execute function public.set_updated_at();

create table public.guardian_student (
  guardian_id  uuid not null references public.guardians(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  relationship text not null,
  primary key (guardian_id, student_id)
);

create index guardian_student_student_id_idx on public.guardian_student(student_id);

-- ── Helper function ───────────────────────────────────────────────────────────

-- Returns the school_id for the currently authenticated admin.
-- security definer so it can read admin_users without the caller needing direct access.
create or replace function public.my_school_id()
returns uuid language sql security definer stable as $$
  select school_id from public.admin_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.admin_users      enable row level security;
alter table public.students         enable row level security;
alter table public.guardians        enable row level security;
alter table public.guardian_student enable row level security;

-- admin_users: each admin sees only their own row
create policy "admin_users: own row"
  on public.admin_users for select
  to authenticated
  using (auth_user_id = auth.uid());

-- students: admin can CRUD students in their own school only
create policy "students: own school"
  on public.students for all
  to authenticated
  using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id());

-- guardian_student: admin can CRUD junction rows for their school's students
create policy "guardian_student: own school"
  on public.guardian_student for all
  to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.school_id = public.my_school_id()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.school_id = public.my_school_id()
    )
  );

-- guardians: admin can SELECT guardians linked to their school's students
create policy "guardians: own school"
  on public.guardians for select
  to authenticated
  using (
    exists (
      select 1 from public.guardian_student gs
      join public.students s on s.id = gs.student_id
      where gs.guardian_id = guardians.id
        and s.school_id = public.my_school_id()
    )
  );

-- schools: replace deny-all with admin-scoped read
drop policy "schools: deny all by default" on public.schools;

create policy "schools: deny all by default"
  on public.schools for all
  to anon, authenticated
  using (false);

create policy "schools: admin sees own school"
  on public.schools for select
  to authenticated
  using (id = public.my_school_id());

-- trusts: admin can see their school's trust
drop policy "trusts: deny all by default" on public.trusts;

create policy "trusts: deny all by default"
  on public.trusts for all
  to anon, authenticated
  using (false);

create policy "trusts: admin sees own trust"
  on public.trusts for select
  to authenticated
  using (
    exists (
      select 1 from public.schools s
      where s.id = public.my_school_id() and s.trust_id = trusts.id
    )
  );
