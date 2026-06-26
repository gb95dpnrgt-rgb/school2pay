-- I1: Enforce uniqueness on guardian email at the DB level.
-- The importer already deduplicates in application code, but the constraint
-- makes the guarantee DB-enforced and prevents concurrent-import races.
alter table public.guardians
  add constraint guardians_email_unique unique (email);

-- N1: Admin SELECT policies for transaction_lines and ledger_entries.
-- All current writes use service-role (bypasses RLS), but admin reads of
-- payment detail pages should be able to use session-scoped clients.
create policy "admin reads school transaction_lines"
  on public.transaction_lines for select
  using (
    exists (
      select 1
      from public.transactions t
      join public.transaction_lines tl2 on tl2.transaction_id = t.id
      join public.assignments a on a.id = tl2.assignment_id
      join public.payment_requests pr on pr.id = a.payment_request_id
      where tl2.id = transaction_lines.id
        and pr.school_id = public.my_school_id()
    )
  );

create policy "admin reads school ledger_entries"
  on public.ledger_entries for select
  using (
    exists (
      select 1
      from public.transaction_lines tl
      join public.assignments a on a.id = tl.assignment_id
      join public.payment_requests pr on pr.id = a.payment_request_id
      where tl.transaction_id = ledger_entries.transaction_id
        and pr.school_id = public.my_school_id()
    )
  );
