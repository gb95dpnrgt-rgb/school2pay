-- Payout reconciliation tables
-- One row per Stripe payout (bank transfer) for the connected account
create table public.payouts (
  id                   uuid primary key default gen_random_uuid(),
  stripe_payout_id     text not null unique,
  school_id            uuid not null references public.schools(id),
  arrival_date         date not null,
  currency             text not null default 'gbp',
  -- Amounts in pence (all derived from Stripe balance transactions)
  gross_pence          integer not null default 0,
  stripe_fees_pence    integer not null default 0,
  app_fees_pence       integer not null default 0,
  net_pence            integer not null default 0,   -- what the school actually receives
  -- Count of balance transactions we could not match to our records
  unmatched_count      integer not null default 0,
  status               text not null default 'paid'
                         check (status in ('paid', 'failed', 'canceled')),
  description          text,
  created_at           timestamptz not null default now()
);

-- One row per Stripe balance transaction within a payout
create table public.payout_lines (
  id                        uuid primary key default gen_random_uuid(),
  payout_id                 uuid not null references public.payouts(id) on delete cascade,
  transaction_id            uuid references public.transactions(id),   -- null if unmatched
  stripe_balance_txn_id     text not null unique,
  stripe_charge_id          text,
  stripe_payment_intent_id  text,
  type                      text not null,            -- 'charge', 'refund', 'adjustment', etc.
  gross_pence               integer not null default 0,
  stripe_fee_pence          integer not null default 0,
  app_fee_pence             integer not null default 0,
  net_pence                 integer not null default 0,
  description               text,
  matched                   boolean not null default false,
  created_at                timestamptz not null default now()
);

-- RLS: admins can only see payouts for their school
alter table public.payouts     enable row level security;
alter table public.payout_lines enable row level security;

create policy "admin_read_payouts"
  on public.payouts for select
  to authenticated
  using (school_id = public.my_school_id());

create policy "admin_read_payout_lines"
  on public.payout_lines for select
  to authenticated
  using (
    exists (
      select 1 from public.payouts p
      where p.id = payout_lines.payout_id
        and p.school_id = public.my_school_id()
    )
  );

-- Indexes
create index payouts_school_arrival_idx on public.payouts(school_id, arrival_date desc);
create index payout_lines_payout_idx    on public.payout_lines(payout_id);
create index payout_lines_txn_idx       on public.payout_lines(transaction_id) where transaction_id is not null;
