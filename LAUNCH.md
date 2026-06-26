# School2Pay — Launch Checklist

> **Do not move to live Stripe keys until every item in the CRITICAL section is checked.**
> Work through each section in order. Tick items off in a shared doc with a timestamp and the name of the person who verified it.

---

## CRITICAL — Must complete before any real money moves

### Stripe

- [ ] Create a live-mode Stripe account (or activate live mode on the existing test account)
- [ ] Complete Stripe platform profile: business type, website URL, MCC code, statement descriptor
- [ ] Replace `STRIPE_SECRET_KEY` in Vercel env with the **live** key (`sk_live_...`)
- [ ] Register the **live** webhook endpoint in the Stripe Dashboard:
  - URL: `https://your-domain.com/api/stripe/webhook`
  - Events to subscribe: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `payout.paid`
  - **Connect webhooks** (separate from account webhooks): `payout.paid` must be subscribed here, not just on account-level
  - Copy the signing secret and set `STRIPE_WEBHOOK_SECRET` in Vercel
- [ ] Verify webhook delivery with a Stripe test event from the Dashboard → look for 200 response in webhook logs
- [ ] Confirm `application_fee_amount` is correctly set in the Stripe checkout session creation (`src/app/api/pay/checkout/route.ts`)
- [ ] Test a **real £1 charge** using a physical card before processing parent payments (see SMOKE-TEST.md)

### Resend

- [ ] Add and verify your sending domain in the Resend Dashboard (DNS TXT + DKIM records)
- [ ] Update `RESEND_FROM` to use the verified domain: `School2Pay <payments@yourdomain.com>`
- [ ] Create a webhook endpoint in Resend Dashboard:
  - URL: `https://your-domain.com/api/resend/webhook`
  - Event: `email.bounced`
  - Copy the signing secret and set `RESEND_WEBHOOK_SECRET` in Vercel env
- [ ] Send a test email and confirm delivery (check spam folder, check Resend Dashboard logs)

### Supabase

- [ ] **Do not use the development project for production.** Create a new Supabase project in the `eu-west-2` (London) or `eu-central-1` region
- [ ] Run all migrations (`supabase/migrations/`) on the production project in order:
  ```
  20240002000000_stripe_events.sql
  20240003000000_admin_users_students_guardians.sql
  20240004000000_payment_requests_assignments.sql
  20240005000000_transactions_email_log.sql
  20240006000000_ledger_immutability.sql
  20240007000000_payment_indexes.sql
  20240008000000_guardian_email_unique.sql
  20240009000000_ledger_balance_functions.sql
  20240010000000_request_summary.sql
  20240011000000_email_log_type_bounce.sql
  20240012000000_assignment_audit_log.sql
  20240013000000_payouts.sql
  20240014000000_monthly_summary_fn.sql
  ```
- [ ] Verify RLS is enabled on every table (run `select tablename, rowsecurity from pg_tables where schemaname = 'public'` — every row must show `t`)
- [ ] Rotate the `anon` and `service_role` keys — update `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` to the production project URL
- [ ] Enable Supabase Point-in-Time Recovery (PITR) on the production project (Pro plan required)
- [ ] Configure Supabase Auth:
  - Site URL: `https://your-domain.com`
  - Redirect URLs: `https://your-domain.com/auth/callback`
  - Disable "Enable email confirmations" for admin sign-up if using invite-only flow
- [ ] Run the ledger integrity script against production after the first real payment: `npx tsx scripts/check-ledger.ts`

### Secrets — rotation

- [ ] **Rotate `MAGIC_LINK_SECRET`**: generate a new random 32+ char string. Any existing magic links (including dev-mode ones) will be invalidated — that's correct, dev links should never work in production
- [ ] Ensure `.env.local` is in `.gitignore` (it is, but verify no secrets were ever committed: `git log -p -- .env.local`)
- [ ] Check git history for any accidentally committed secrets: `git log -p | grep -E "(sk_|whsec_|re_|service_role)"` — if any found, treat as compromised and rotate immediately
- [ ] Set all production secrets in **Vercel environment variables** (not in code or committed files):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY` (live)
  - `STRIPE_WEBHOOK_SECRET` (live)
  - `RESEND_API_KEY`
  - `RESEND_FROM`
  - `RESEND_WEBHOOK_SECRET`
  - `MAGIC_LINK_SECRET`
  - `NEXT_PUBLIC_APP_URL`
  - `APP_URL`
  - `CRON_SECRET`
  - `TWILIO_ACCOUNT_SID` (optional — leave blank to disable SMS)
  - `TWILIO_AUTH_TOKEN` (optional)
  - `TWILIO_FROM_NUMBER` (optional)
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_DSN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
  - `SENTRY_AUTH_TOKEN` (build-time only; mark as build secret in Vercel)
- [ ] Set `NEXT_PUBLIC_ENABLE_SPIKE=` (empty — feature disabled in production)

---

## IMPORTANT — Complete before first school goes live

### Legal & compliance

- [ ] Solicitor review and sign-off on `/privacy` page (Privacy Notice)
- [ ] Solicitor review and sign-off on `/terms` page (Terms of Service)
- [ ] Data Processing Agreement signed with each school / trust
- [ ] Confirm school's own charging and remissions policy is compatible with School2Pay
- [ ] ICO registration confirmed (if not already registered as a data processor)
- [ ] Confirm DPA agreements in place with: Supabase, Resend, Vercel, Stripe

### Monitoring & alerting

- [ ] Create Sentry project and set DSN in env vars
- [ ] Configure Sentry alert: notify on any error in `/api/stripe/webhook` within 5 minutes
- [ ] Configure Sentry alert: notify on any error in `/api/resend/webhook`
- [ ] Set up Vercel deployment notifications (Slack or email) for failed deployments
- [ ] Verify Sentry is receiving events: trigger a test error from the Sentry SDK after deploy

### Onboarding a school

- [ ] Trust has completed Stripe Connect KYC onboarding (charges enabled, details submitted)
- [ ] At least one admin user created and can log in
- [ ] Students imported via CSV
- [ ] Test payment request created, email sent to a test guardian, payment completed, and ledger checked

### Smoke test

- [ ] Execute SMOKE-TEST.md end-to-end before opening to parents (see that file)

---

## NICE TO HAVE — Before scaling beyond first school

- [ ] Custom domain confirmed in Vercel (with HTTPS)
- [ ] Vercel preview deployments configured to use test-mode Stripe keys only
- [ ] Staging environment with separate Supabase project
- [ ] DB backup tested: restore from PITR to a point in time
- [ ] Rate limiting on public-facing endpoints (`/api/pay/checkout`, `/api/stripe/webhook`)
- [ ] Add `Content-Security-Policy` headers in `next.config.ts`

---

## Post-launch

- [ ] Run `npx tsx scripts/check-ledger.ts` after every batch of payments (ideally nightly in CI)
- [ ] Review Stripe payout reconciliation report (`/reports/payouts`) after each bank transfer
- [ ] Monitor Sentry for new error patterns in the first 48 hours
