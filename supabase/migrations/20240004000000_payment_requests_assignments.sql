-- payment_requests: one per school per campaign
create table public.payment_requests (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  title            text not null,
  description      text,
  amount_pence     integer not null check (amount_pence > 0),
  due_date         date not null,
  year_groups      text[], -- null = whole school; non-null = targeted year groups
  status           text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- assignments: one per (payment_request, student)
create table public.assignments (
  id                  uuid primary key default gen_random_uuid(),
  payment_request_id  uuid not null references public.payment_requests(id) on delete cascade,
  student_id          uuid not null references public.students(id) on delete cascade,
  amount_due_pence    integer not null check (amount_due_pence > 0),
  amount_paid_pence   integer not null default 0 check (amount_paid_pence >= 0),
  status              text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'waived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (payment_request_id, student_id)
);

-- RLS: payment_requests
alter table public.payment_requests enable row level security;

create policy "admin sees own school payment_requests"
  on public.payment_requests for select
  using (school_id = public.my_school_id());

create policy "admin inserts own school payment_requests"
  on public.payment_requests for insert
  with check (school_id = public.my_school_id());

create policy "admin updates own school payment_requests"
  on public.payment_requests for update
  using (school_id = public.my_school_id());

-- RLS: assignments (via payment_request school_id)
alter table public.assignments enable row level security;

create policy "admin sees own school assignments"
  on public.assignments for select
  using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = assignment_id  -- Note: using payment_request_id column below
        and pr.school_id = public.my_school_id()
    )
  );

-- Fix the policy above — correct column name
drop policy "admin sees own school assignments" on public.assignments;

create policy "admin sees own school assignments"
  on public.assignments for select
  using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and pr.school_id = public.my_school_id()
    )
  );

create policy "admin inserts own school assignments"
  on public.assignments for insert
  with check (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and pr.school_id = public.my_school_id()
    )
  );

create policy "admin updates own school assignments"
  on public.assignments for update
  using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and pr.school_id = public.my_school_id()
    )
  );
