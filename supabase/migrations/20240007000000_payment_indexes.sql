-- C3: Index for webhook lookup by stripe_payment_intent (full-scan risk under load)
create index if not exists transactions_stripe_pi_idx
  on public.transactions(stripe_payment_intent);

-- I5: Unique constraint on stripe_payment_intent (NULLs are excluded from uniqueness in Postgres)
alter table public.transactions
  add constraint transactions_stripe_pi_unique unique (stripe_payment_intent);
