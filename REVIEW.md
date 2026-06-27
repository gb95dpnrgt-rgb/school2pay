# Payments Engineering Review — School2Pay
*Reviewed: 2026-06-13 | Reviewer: automated senior-engineer pass*

---

## Phase 12 — Digital consent forms (added 2026-06-27)

### GDPR — Special category data in `consent_responses.responses`

Medical conditions, dietary requirements, medication details, and GP info collected via consent forms are **special category data under UK GDPR Art. 9**. The following steps must be completed before processing any real parent data:

1. **DPA update** — amend your Data Processing Agreement to cover health/dietary data.
2. **ROPA entry** — add an entry to your Record of Processing Activities for consent responses.
3. **Privacy notice** — update `/privacy` page to explicitly state what medical data is collected, why, who sees it, and for how long.
4. **Retention policy** — `consent_responses` table comment documents a 1-year retention period post-trip `due_date`. **Confirm this period with your DPO before go-live.** The automated purge (pg_cron or Edge Function) has not been implemented; this must be either automated or performed as a documented manual step on a schedule.
5. **Legal basis** — consent under Art. 9(2)(a) is used here (parent explicitly ticks/signs). Ensure withdrawal of consent is honoured operationally (school receives notification, child excluded from trip if needed).

### Consent form manual testing checklist

- [ ] Create a new request with consent form attached — verify `consent_forms` + `consent_fields` rows created in Supabase
- [ ] Open parent pay link — verify consent fields appear before or alongside payment
- [ ] Submit consent with `requires_consent_before_payment = true` — verify payment button blocked until consent given
- [ ] Withdraw consent — verify `withdrawn_at` is set, row not deleted, payment gate re-applied
- [ ] Two children, one guardian — verify each child's consent tracked independently
- [ ] Request with no consent form — verify pay page unchanged

---

## CRITICAL

### C1 — Double-payment race: two parents can pay the same assignment concurrently
**File:** `src/app/api/pay/checkout/route.ts:67`

The paid/waived guard is a read-then-act without a DB lock. If Parent A and Parent B both open the same child's pay link simultaneously, both read `status = 'unpaid'`, both pass the guard, both create `transactions` + `transaction_lines` rows and separate Stripe Checkout sessions. Both sessions can succeed. The webhook processes two distinct event IDs — both pass idempotency — so `amount_paid_pence` is incremented twice and the ledger gets two payment postings. Result: double-charge to two parents for the same assignment, double ledger credit.

**Fix:** Before creating the transaction, check for an existing `pending` or `succeeded` `transaction_lines` row for any of the requested `assignment_id`s. If found, return 409. This closes the window to a narrow race inside Postgres (two concurrent INSERTs to `transaction_lines` for the same `assignment_id`) which is then covered by a unique partial index.

**Migration required:** Add `CREATE UNIQUE INDEX transaction_lines_assignment_active ON transaction_lines(assignment_id) WHERE ...` — but Postgres partial indexes cannot use correlated subqueries. Pragmatic fix: unique constraint on `(assignment_id)` scoped by status check at application layer (see fix in `checkout/route.ts`).

---

### C2 — Orphaned transaction rows when Stripe session creation fails
**File:** `src/app/api/pay/checkout/route.ts:152`

Sequence:
1. INSERT `transactions` (pending)
2. INSERT `transaction_lines`
3. `stripe.checkout.sessions.create(...)` ← if this throws or times out
4. UPDATE `transactions.stripe_payment_intent` ← never reached

On failure the caller sees a 500, the parent retries, and step 1 creates a second pending transaction for the same assignments. Now two pending transactions point at the same `assignment_ids` via `transaction_lines`. When the (eventually succeeding) Stripe PI fires, the webhook finds the first transaction (or the second — whichever got the PI stored), posts ledger entries for that one, and the other transaction row is orphaned forever. In the worst case — if Stripe actually charged the card before the timeout — we have a Stripe payment with no matching transaction row.

**Fix:** Wrap the Stripe session creation in try/catch; on failure, delete the transaction row (cascades to lines) before returning 500. This makes the route idempotent on retry.

---

### C3 — No index on `transactions.stripe_payment_intent`
**File:** `supabase/migrations/20240005000000_transactions_email_log.sql`

The webhook handler looks up transactions by `.eq("stripe_payment_intent", pi.id)`. As the transactions table grows this is a sequential scan. Under load (Stripe retries, concurrent webhooks) this is a correctness risk — slow lookups increase the window for the idempotency race, and timeouts cause Stripe to retry, multiplying the problem.

**Fix:** `CREATE INDEX transactions_stripe_pi_idx ON transactions(stripe_payment_intent);`

---

## IMPORTANT

### I1 — `guardians` has no unique constraint on `email`
**File:** `supabase/migrations/20240003000000_admin_users_students_guardians.sql`

The CSV importer inserts guardians without deduplicating on email. Re-importing (or importing overlapping year groups) creates duplicate guardian rows with the same email. The same parent receives two magic links, can pay the same assignment twice if they click both. Magic links are guardian-scoped so both are valid.

**Fix:** Add `UNIQUE(email)` on `guardians` (with an `ON CONFLICT (email) DO NOTHING` / `DO UPDATE` strategy in the importer).

---

### I2 — Pay page fetches all assignments for a request, filters in TypeScript
**File:** `src/app/pay/[token]/page.tsx:62–88`

The query fetches every assignment for the entire payment request (potentially all 200+ students in a school), then filters to the guardian's children in TypeScript. This leaks data into server memory unnecessarily and is fragile — a future refactor moving this query client-side would expose other families' data.

**Fix:** Add `.filter("students.guardian_student.guardian_id", "eq", guardianId)` or restructure the query to join through `guardian_student` with a guardian_id filter at the SQL level.

---

### I3 — Refund handler does not guard against double-refund
**File:** `src/app/api/stripe/webhook/route.ts:180`

`handleChargeRefunded` checks for an existing transaction but does not check whether it's already `refunded`. If `charge.refunded` fires twice (Stripe retries are common after 5xx), the event idempotency check on `stripe_events` covers this — but only if the first call completed successfully. If the first call posted ledger entries and then failed on the assignment reset loop, the second retry inserts a second `stripe_events` row (different event ID would be a different event — Stripe resends the same event ID, so idempotency does cover it). This is actually safe. Documenting for clarity.

---

### I4 — `MAGIC_LINK_SECRET` falls back to a hardcoded dev string
**File:** `src/lib/magic-link.ts:3`

```ts
process.env.MAGIC_LINK_SECRET ?? "dev-secret-change-in-production-min-32-chars"
```

If this env var is accidentally unset in production, all magic links are signed with the known dev secret, making them forgeable. The `??` fallback should throw in production.

**Fix:** Remove the fallback and throw explicitly if the env var is missing at startup.

---

### I5 — `stripe_payment_intent` not unique on `transactions`
**File:** `supabase/migrations/20240005000000_transactions_email_log.sql`

No `UNIQUE` constraint on `transactions.stripe_payment_intent`. If it's ever stored twice (bug in retry path from C2), the webhook's `.maybeSingle()` silently returns the first row.

**Fix:** `ALTER TABLE transactions ADD CONSTRAINT transactions_stripe_pi_unique UNIQUE (stripe_payment_intent);` (partial, allowing NULLs via Postgres semantics).

---

### I6 — Application fee fixed at 50p regardless of cart size
**File:** `src/app/api/pay/checkout/route.ts:149`

`application_fee_amount: APPLICATION_FEE_PENCE` is always 50p even when a parent pays for 3 children. This is consistent with CLAUDE.md ("50p flat for MVP") but means School2Pay earns the same fee on a £150 cart as a £25 cart. Flagged for commercial review post-MVP.

---

## NICE TO HAVE

### N1 — `transaction_lines` has no admin SELECT policy
**File:** `supabase/migrations/20240005000000_transactions_email_log.sql`

`transaction_lines` and `ledger_entries` have RLS enabled but no admin SELECT policy. All current reads use the service-role client (which bypasses RLS), so this isn't a live bug. But if any future code uses the anon/session client to query these tables, it will silently return empty rows.

---

### N2 — No rate limiting on `/api/pay/checkout`
A valid magic link token could be used to spam checkout creation (each call creates a new pending transaction). Consider a rate limit (e.g. 5 checkouts per token per hour) or expiring the token after first successful checkout.

---

### N3 — `checkLedgerBalance` loads all ledger rows into memory
**File:** `src/lib/ledger.ts:97`

Works for MVP volumes; will be slow at scale. Move the aggregation to a SQL `GROUP BY` query with `SUM(debit_pence)`, `SUM(credit_pence)`.

---

## Summary of what to fix now

| # | Finding | Fix location |
|---|---------|-------------|
| C1 | Double-payment race | `checkout/route.ts` + new migration |
| C2 | Orphaned transaction on Stripe failure | `checkout/route.ts` |
| C3 | Missing index on stripe_payment_intent | new migration |
| I4 | Magic link secret fallback | `magic-link.ts` |
