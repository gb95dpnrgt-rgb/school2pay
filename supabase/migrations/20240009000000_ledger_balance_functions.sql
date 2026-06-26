-- N3: SQL-level aggregation for ledger integrity checks.
-- Previously done in TypeScript by loading all rows — this scales to any volume.

create or replace function public.ledger_global_totals()
returns table(total_debits bigint, total_credits bigint)
language sql security definer stable as $$
  select
    coalesce(sum(debit_pence), 0)  as total_debits,
    coalesce(sum(credit_pence), 0) as total_credits
  from public.ledger_entries;
$$;

create or replace function public.ledger_imbalanced_transactions()
returns table(transaction_id uuid, debits bigint, credits bigint)
language sql security definer stable as $$
  select
    transaction_id,
    sum(debit_pence)  as debits,
    sum(credit_pence) as credits
  from public.ledger_entries
  group by transaction_id
  having sum(debit_pence) <> sum(credit_pence);
$$;
