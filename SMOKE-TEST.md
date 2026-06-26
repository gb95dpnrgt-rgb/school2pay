# School2Pay — Launch Day Smoke Test

> Run this script **before** any real parent payments are collected.
> You will make a real £1 charge to a real card and then refund it.
> Have the Stripe Dashboard and the School2Pay admin panel open side-by-side.
>
> **Do not run this with test-mode (`sk_test_...`) keys.** This script verifies the live stack.

---

## Prerequisites

- [ ] All LAUNCH.md CRITICAL items are checked off
- [ ] `STRIPE_SECRET_KEY` is a live key (`sk_live_...`)
- [ ] At least one trust has completed Stripe Connect KYC
- [ ] One admin account exists for a school under that trust
- [ ] A physical Visa or Mastercard debit/credit card is to hand (yours or a company card)
- [ ] Access to the email inbox used as the test guardian email

---

## STEP 1 — Log in as admin

1. Navigate to `https://your-domain.com/login`
2. Enter your admin email and complete the magic-link flow
3. **Verify:** you land on the dashboard; the school name shown matches the school you expect
4. **Verify:** no JavaScript errors in the browser console

---

## STEP 2 — Add a test student

1. Go to **Students → Import CSV** (or add manually if there is no CSV import button on the page yet)
2. Add a student: first name `SmokeTest`, year group `7`
3. Add a guardian: email = your own email address (you will receive the payment link here)
4. **Verify:** student appears in the student list

---

## STEP 3 — Create a £1 payment request

1. Go to **Payment Requests → New request**
2. Title: `Smoke test — delete after`
3. Amount: `1.00` (one pound — the UI converts to 100p)
4. Due date: any future date
5. Year groups: tick Year 7 (or whichever you used above)
6. Submit
7. **Verify:** request appears in the list with status `open`
8. **Verify:** the SmokeTest student appears as an assignment on the request detail page with status `unpaid`

---

## STEP 4 — Send the payment email

1. On the request detail page, find the SmokeTest student row
2. Click **Send payment email**
3. **Verify:** the UI shows a confirmation ("Email sent" or similar)
4. **Verify:** an email arrives in your inbox within ~60 seconds with subject containing the payment request title
5. **Verify:** the email displays the amount as **£1.00** and does not mention any card surcharge

---

## STEP 5 — Pay as a parent

1. Open the payment email and click the payment link
2. **Verify:** the link opens a page showing the student name, the amount (£1.00), and the school name
3. **Verify:** there is NO mention of a processing fee being added to the amount (surcharging is illegal)
4. Click **Pay now** (or equivalent)
5. You are redirected to Stripe Checkout
6. Enter card details:
   - Card number: your real Visa or Mastercard
   - Expiry: correct
   - CVC: correct
   - Name: anything
7. Click **Pay £1.00**
8. **Verify:** Stripe processes the payment and redirects back to the School2Pay success/confirmation page
9. **Verify:** success page shows the correct amount and does not say "pending" — it should say something like "Thank you, your payment is being confirmed"

> **Note:** The assignment will NOT show as paid yet. It updates only when the webhook is received (usually within a few seconds).

---

## STEP 6 — Verify webhook processing

1. Go back to the admin panel → request detail page for "Smoke test — delete after"
2. Wait up to 30 seconds, then refresh
3. **Verify:** SmokeTest student assignment status changed from `unpaid` to `paid`
4. **Verify:** Amount paid column shows £1.00

If status has NOT changed after 60 seconds:
- Check **Stripe Dashboard → Developers → Webhooks → your endpoint → Recent deliveries**
- Look for a `payment_intent.succeeded` event — check its HTTP response code (should be 200)
- If it shows a non-200 response or no delivery attempt, the webhook is not reaching your server
- Check Vercel logs and Sentry for errors

---

## STEP 7 — Verify the ledger

SSH into the production environment or run this locally against the production DB:

```bash
npx tsx scripts/check-ledger.ts
```

**Verify:** output shows `✓ All transactions balance` (or the equivalent passing message)

If it shows imbalances: do not proceed to give access to real schools until this is resolved.

---

## STEP 8 — Check the Stripe Dashboard figures match

1. Open **Stripe Dashboard → Payments**
2. Find the £1.00 payment
3. Note: gross = £1.00, Stripe fee ≈ £0.22 (1.5% + 20p), application fee = £0.50, net to school ≈ £0.28
4. After the first payout settles (may be T+2 business days on a new account): go to **School2Pay Reports → Payouts**
5. **Verify:** the payout appears with a net figure that matches the Stripe Dashboard to the penny
6. **Verify:** no unmatched balance transactions are flagged

---

## STEP 9 — Refund the payment

1. In **Stripe Dashboard → Payments**, find the £1.00 payment
2. Click **Refund** → full refund → confirm
3. Wait up to 60 seconds, then refresh the School2Pay request detail page
4. **Verify:** assignment status changes to reflect the refund (check the audit trail / status field — depending on implementation, this may stay `paid` with a note, or revert)
5. **Verify:** `check-ledger.ts` still passes after the refund

---

## STEP 10 — Clean up

1. Delete or waive the "Smoke test — delete after" payment request (or mark it archived — do not leave it open)
2. Delete the SmokeTest student if your data model allows, or note it as a test record
3. Document the smoke test result:
   - Date and time
   - Name of person who ran it
   - Payment intent ID from Stripe (for audit trail)
   - Result: PASS / FAIL

---

## Expected timings

| Step | Expected time |
|---|---|
| Email delivery | < 60 seconds |
| Webhook → assignment marked paid | < 30 seconds |
| Stripe payout to bank (new account) | 2–7 business days |
| Refund to card | 5–10 business days |

---

## If anything fails

1. **Email not received**: check Resend Dashboard → Logs. Verify domain is verified and `RESEND_FROM` uses the verified domain.
2. **Webhook not firing**: check Stripe Dashboard → Developers → Webhooks. Confirm the endpoint URL and signing secret match production. Check that `payout.paid` is also under Connect webhooks.
3. **Assignment not updated**: check Vercel function logs and Sentry. The webhook handler may be throwing — look for `payment_intent.succeeded` errors.
4. **Ledger fails**: do not open to real parents. Investigate the imbalance using `check-ledger.ts` output before proceeding.
5. **Sentry shows errors**: fix before proceeding. The smoke test is not complete if Sentry captures any errors during this flow.

---

## Sign-off

| Item | Person | Time | Result |
|---|---|---|---|
| Steps 1–5 (payment flow) | | | |
| Step 6 (webhook received) | | | |
| Step 7 (ledger balanced) | | | |
| Step 8 (Stripe figures match) | | | |
| Step 9 (refund processed) | | | |
| **Overall: READY TO LAUNCH** | | | |
