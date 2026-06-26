-- Aggregate summary for a payment request — computed in SQL, not JavaScript.
-- Called from the admin detail page to avoid loading all assignment rows.
create or replace function public.request_summary(p_request_id uuid)
returns table(
  total_students  bigint,
  paid_count      bigint,
  partial_count   bigint,
  unpaid_count    bigint,
  waived_count    bigint,
  total_expected_pence  bigint,
  total_collected_pence bigint,
  pct_paid        numeric
)
language sql security definer stable as $$
  select
    count(*)                                                          as total_students,
    count(*) filter (where status = 'paid')                          as paid_count,
    count(*) filter (where status = 'partial')                       as partial_count,
    count(*) filter (where status = 'unpaid')                        as unpaid_count,
    count(*) filter (where status = 'waived')                        as waived_count,
    coalesce(sum(amount_due_pence), 0)                               as total_expected_pence,
    coalesce(sum(amount_paid_pence), 0)                              as total_collected_pence,
    case
      when sum(amount_due_pence) > 0
      then round(
        100.0 * sum(amount_paid_pence) / sum(amount_due_pence), 1
      )
      else 0
    end                                                               as pct_paid
  from public.assignments
  where payment_request_id = p_request_id;
$$;
