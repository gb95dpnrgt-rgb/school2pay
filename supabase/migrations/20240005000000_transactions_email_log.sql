-- transactions: one per parent checkout session
create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  guardian_id           uuid not null references public.guardians(id),
  stripe_payment_intent text,
  amount_pence          integer not null check (amount_pence > 0),
  status                text not null default 'pending'
                          check (status in ('pending','succeeded','failed','refunded')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- transaction_lines: one per assignment in a checkout
create table public.transaction_lines (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  assignment_id   uuid not null references public.assignments(id),
  amount_pence    integer not null check (amount_pence > 0),
  created_at      timestamptz not null default now()
);

-- ledger_entries: append-only, no UPDATE/DELETE ever
create table public.ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id),
  account         text not null,
  debit_pence     integer not null default 0 check (debit_pence >= 0),
  credit_pence    integer not null default 0 check (credit_pence >= 0),
  created_at      timestamptz not null default now()
);

-- email_log: track every notification sent
create table public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  guardian_id         uuid not null references public.guardians(id),
  payment_request_id  uuid not null references public.payment_requests(id),
  resend_message_id   text,
  sent_at             timestamptz not null default now()
);

-- RLS: transactions — guardians use anon pay page (no auth); service role for all writes
-- Admins read via school join
alter table public.transactions enable row level security;
alter table public.transaction_lines enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.email_log enable row level security;

-- Deny-all by default (service role bypasses RLS for all writes from server)
-- Admin read access for transactions via school_id join
create policy "admin reads school transactions"
  on public.transactions for select
  using (
    exists (
      select 1
      from public.transaction_lines tl
      join public.assignments a on a.id = tl.assignment_id
      join public.payment_requests pr on pr.id = a.payment_request_id
      where tl.transaction_id = transactions.id
        and pr.school_id = public.my_school_id()
    )
  );

create policy "admin reads school email_log"
  on public.email_log for select
  using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and pr.school_id = public.my_school_id()
    )
  );
