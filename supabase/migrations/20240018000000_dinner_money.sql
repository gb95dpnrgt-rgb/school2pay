-- ─────────────────────────────────────────────────────────────────────────────
-- Dinner money
-- ─────────────────────────────────────────────────────────────────────────────

-- School-level settings for dinner money
create table public.dinner_settings (
  id                          uuid primary key default gen_random_uuid(),
  school_id                   uuid not null references public.schools(id) on delete cascade,
  price_per_meal_pence        integer not null default 260,  -- £2.60 default
  low_balance_threshold_pence integer not null default 500,  -- £5.00 default
  enabled                     boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint dinner_settings_school_id_unique unique (school_id)
);

-- One wallet per guardian per school
create table public.dinner_wallets (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid not null references public.guardians(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  balance_pence integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint dinner_wallets_guardian_school_unique unique (guardian_id, school_id)
);

-- Every credit and debit — append only, never update or delete
create type public.dinner_transaction_type as enum (
  'topup',       -- parent topped up via Stripe
  'deduction',   -- meal taken by child
  'refund',      -- admin refunded balance
  'adjustment'   -- manual admin correction with note
);

create table public.dinner_transactions (
  id                      uuid primary key default gen_random_uuid(),
  wallet_id               uuid not null references public.dinner_wallets(id) on delete restrict,
  student_id              uuid references public.students(id) on delete set null,
  type                    public.dinner_transaction_type not null,
  amount_pence            integer not null,  -- positive = credit, negative = debit
  balance_after_pence     integer not null,  -- wallet balance after this transaction
  note                    text,
  stripe_payment_intent   text,             -- set for topup transactions
  date                    date not null default current_date,
  created_at              timestamptz not null default now()
);

-- Free school meals eligibility — these students are never charged
create table public.fsm_students (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  expires_at  date,  -- null = indefinite
  note        text,
  created_at  timestamptz not null default now(),
  constraint fsm_students_student_id_unique unique (student_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index dinner_wallets_guardian_id_idx on public.dinner_wallets(guardian_id);
create index dinner_wallets_school_id_idx on public.dinner_wallets(school_id);
create index dinner_transactions_wallet_id_idx on public.dinner_transactions(wallet_id);
create index dinner_transactions_date_idx on public.dinner_transactions(date);
create index dinner_transactions_student_id_idx on public.dinner_transactions(student_id);
create index fsm_students_school_id_idx on public.fsm_students(school_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.dinner_settings enable row level security;
alter table public.dinner_wallets enable row level security;
alter table public.dinner_transactions enable row level security;
alter table public.fsm_students enable row level security;

-- dinner_settings: admin sees only their school
create policy "dinner_settings_admin_select" on public.dinner_settings
  for select using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "dinner_settings_admin_insert" on public.dinner_settings
  for insert with check (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "dinner_settings_admin_update" on public.dinner_settings
  for update using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );

-- dinner_wallets: admin sees only their school's wallets
create policy "dinner_wallets_admin_select" on public.dinner_wallets
  for select using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "dinner_wallets_admin_insert" on public.dinner_wallets
  for insert with check (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "dinner_wallets_admin_update" on public.dinner_wallets
  for update using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );

-- dinner_transactions: admin sees only their school's transactions
create policy "dinner_transactions_admin_select" on public.dinner_transactions
  for select using (
    wallet_id in (
      select id from public.dinner_wallets
      where school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
    )
  );
create policy "dinner_transactions_admin_insert" on public.dinner_transactions
  for insert with check (
    wallet_id in (
      select id from public.dinner_wallets
      where school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
    )
  );

-- fsm_students: admin sees only their school
create policy "fsm_students_admin_select" on public.fsm_students
  for select using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "fsm_students_admin_insert" on public.fsm_students
  for insert with check (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "fsm_students_admin_update" on public.fsm_students
  for update using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
create policy "fsm_students_admin_delete" on public.fsm_students
  for delete using (
    school_id in (select school_id from public.admin_users where auth_user_id = auth.uid())
  );
