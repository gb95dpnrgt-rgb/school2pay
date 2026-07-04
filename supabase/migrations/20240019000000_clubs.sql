-- ─────────────────────────────────────────────────────────────────────────────
-- Clubs management
-- ─────────────────────────────────────────────────────────────────────────────

create type public.club_fee_model as enum ('termly', 'weekly');
create type public.club_status as enum ('draft', 'open', 'closed');
create type public.enrollment_status as enum ('enrolled', 'waitlisted', 'cancelled');
create type public.enrollment_payment_status as enum ('unpaid', 'paid', 'refunded');

create table public.clubs (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  name                text not null,
  description         text,
  fee_model           public.club_fee_model not null default 'termly',
  fee_pence           integer not null,           -- per session if weekly, flat if termly
  sessions_per_term   integer,                    -- set for weekly clubs; total = fee_pence × sessions_per_term
  day_of_week         text,                       -- e.g. 'Monday'
  start_date          date,
  end_date            date,
  max_capacity        integer,                    -- null = unlimited
  status              public.club_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.club_enrollments (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id) on delete cascade,
  student_id          uuid not null references public.students(id) on delete cascade,
  guardian_id         uuid not null references public.guardians(id) on delete cascade,
  status              public.enrollment_status not null default 'enrolled',
  payment_status      public.enrollment_payment_status not null default 'unpaid',
  stripe_payment_intent text,
  waitlist_position   integer,                   -- set when status = waitlisted
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint club_enrollments_unique unique (club_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index clubs_school_id_idx on public.clubs(school_id);
create index club_enrollments_club_id_idx on public.club_enrollments(club_id);
create index club_enrollments_guardian_id_idx on public.club_enrollments(guardian_id);
create index club_enrollments_student_id_idx on public.club_enrollments(student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.clubs enable row level security;
alter table public.club_enrollments enable row level security;

-- clubs: admin sees only their school
create policy "clubs_admin_select" on public.clubs
  for select using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "clubs_admin_insert" on public.clubs
  for insert with check (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "clubs_admin_update" on public.clubs
  for update using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );

-- club_enrollments: admin sees only their school's enrollments
create policy "club_enrollments_admin_select" on public.club_enrollments
  for select using (
    club_id in (
      select id from public.clubs
      where school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
    )
  );
create policy "club_enrollments_admin_insert" on public.club_enrollments
  for insert with check (
    club_id in (
      select id from public.clubs
      where school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
    )
  );
create policy "club_enrollments_admin_update" on public.club_enrollments
  for update using (
    club_id in (
      select id from public.clubs
      where school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
    )
  );
