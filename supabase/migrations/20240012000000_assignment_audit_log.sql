-- Make guardian_id nullable on transactions to support offline/cash payments
alter table public.transactions
  alter column guardian_id drop not null;

-- Audit log for manual admin adjustments to assignments
create table if not exists public.assignment_audit_log (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  admin_id      uuid not null references auth.users(id),
  action        text not null check (action in ('waive', 'offline_payment', 'note')),
  amount_pence  integer,      -- set for offline_payment; null for waive/note
  note          text,         -- required for offline_payment; optional for waive
  created_at    timestamptz not null default now()
);

alter table public.assignment_audit_log enable row level security;

create policy "admin_read_audit_log"
  on public.assignment_audit_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assignments a
      join public.payment_requests pr on pr.id = a.payment_request_id
      where a.id = assignment_audit_log.assignment_id
        and pr.school_id = public.my_school_id()
    )
  );

create index assignment_audit_log_assignment_idx
  on public.assignment_audit_log(assignment_id, created_at desc);

-- Offline-payment function: creates transaction + ledger + updates assignment + audit log atomically
create or replace function public.record_offline_payment(
  p_assignment_id uuid,
  p_amount_pence  integer,
  p_admin_id      uuid,
  p_note          text
)
returns void
language plpgsql
security definer
as $$
declare
  v_txn_id       uuid;
  v_current_paid integer;
  v_due          integer;
  v_new_paid     integer;
  v_new_status   text;
begin
  if p_amount_pence <= 0 then
    raise exception 'amount_pence must be positive';
  end if;

  -- Lock assignment row to prevent concurrent updates
  select amount_paid_pence, amount_due_pence
  into v_current_paid, v_due
  from public.assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'assignment not found';
  end if;

  v_new_paid := v_current_paid + p_amount_pence;
  v_new_status := case
    when v_new_paid >= v_due then 'paid'
    when v_new_paid > 0      then 'partial'
    else                          'unpaid'
  end;

  -- Synthetic transaction for the offline payment; no guardian_id (cash payment)
  insert into public.transactions (guardian_id, stripe_payment_intent, amount_pence, status)
  values (null, 'offline_' || gen_random_uuid()::text, p_amount_pence, 'succeeded')
  returning id into v_txn_id;

  insert into public.transaction_lines (transaction_id, assignment_id, amount_pence)
  values (v_txn_id, p_assignment_id, p_amount_pence);

  -- Double-entry: DR cash / CR income (balanced)
  insert into public.ledger_entries (transaction_id, account, debit_pence, credit_pence)
  values
    (v_txn_id, 'cash',   p_amount_pence, 0),
    (v_txn_id, 'income', 0,              p_amount_pence);

  update public.assignments
  set amount_paid_pence = v_new_paid,
      status            = v_new_status
  where id = p_assignment_id;

  insert into public.assignment_audit_log (assignment_id, admin_id, action, amount_pence, note)
  values (p_assignment_id, p_admin_id, 'offline_payment', p_amount_pence, p_note);
end;
$$;

-- Waive function: marks assignment waived and writes audit log (no ledger entries — no money changes hands)
create or replace function public.waive_assignment(
  p_assignment_id uuid,
  p_admin_id      uuid,
  p_note          text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.assignments
  set status = 'waived'
  where id = p_assignment_id;

  if not found then
    raise exception 'assignment not found';
  end if;

  insert into public.assignment_audit_log (assignment_id, admin_id, action, note)
  values (p_assignment_id, p_admin_id, 'waive', p_note);
end;
$$;
