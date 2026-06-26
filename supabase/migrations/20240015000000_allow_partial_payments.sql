-- Allow payment requests to accept partial (instalment) payments from parents
alter table public.payment_requests
  add column if not exists allow_partial boolean not null default false;
