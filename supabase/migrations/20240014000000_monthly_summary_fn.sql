-- Monthly collection summary per payment request
-- Returns one row per (year-month, payment_request_id) with aggregate figures
create or replace function public.monthly_collection_summary(p_school_id uuid)
returns table(
  month              text,     -- 'YYYY-MM'
  payment_request_id uuid,
  request_title      text,
  total_students     bigint,
  paid_count         bigint,
  waived_count       bigint,
  gross_collected_pence bigint,
  net_collected_pence   bigint  -- gross minus estimated fees
)
language sql
security definer
stable
as $$
  select
    to_char(date_trunc('month', t.created_at), 'YYYY-MM') as month,
    pr.id                                                  as payment_request_id,
    pr.title                                               as request_title,
    count(distinct a.id)                                   as total_students,
    count(distinct a.id) filter (where a.status = 'paid') as paid_count,
    count(distinct a.id) filter (where a.status = 'waived') as waived_count,
    coalesce(sum(tl.amount_pence), 0)                      as gross_collected_pence,
    -- Estimate net: gross minus Stripe fee (ceil(gross*1.5%)+20p) minus app fee (50p) per transaction line
    coalesce(sum(
      tl.amount_pence
      - (ceil(tl.amount_pence * 0.015)::integer + 20)  -- stripe fee per line
      - 50                                               -- app fee per line
    ), 0)                                                   as net_collected_pence
  from public.payment_requests pr
  join public.assignments a       on a.payment_request_id = pr.id
  join public.transaction_lines tl on tl.assignment_id = a.id
  join public.transactions t       on t.id = tl.transaction_id
  where pr.school_id = p_school_id
    and t.status = 'succeeded'
  group by
    date_trunc('month', t.created_at),
    pr.id,
    pr.title
  order by
    date_trunc('month', t.created_at) desc,
    pr.title;
$$;
