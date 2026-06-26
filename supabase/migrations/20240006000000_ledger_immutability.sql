-- Postgres trigger that rejects any UPDATE or DELETE on ledger_entries.
-- The ledger is append-only: corrections are new reversing entries, never edits.

create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql
security definer
as $$
begin
  raise exception 'ledger_entries is append-only — UPDATE and DELETE are not permitted. Post a reversing entry instead.';
end;
$$;

create trigger ledger_immutable
  before update or delete on public.ledger_entries
  for each row execute function public.reject_ledger_mutation();
