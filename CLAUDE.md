# School2Pay — Project Rules

## Project

School2Pay is a B2B SaaS platform for UK schools to collect payments from parents (trips, clubs, dinners, uniforms — not tuition fees). Schools belong to trusts (the legal entity).

---

## Stack (do not deviate without asking me)

- **Next.js (App Router) + TypeScript**, deployed on Vercel
- **Supabase**: Postgres, Supabase Auth (admin login only), Row Level Security on every table
- **Stripe Connect** for payments: schools (legal entity = trust) are connected accounts and merchants of record; our platform takes an application fee per transaction
- **Resend** for transactional email
- No other services without asking me first.

---

## Data Model

All primary keys `uuid`. All timestamps `timestamptz`.

| Table | Key columns |
|---|---|
| `trusts` | `id`, `legal_name`, `stripe_account_id`, `country` |
| `schools` | `id`, `trust_id` FK, `name`, `urn` |
| `admin_users` | `id`, `school_id` FK, `email` (linked to Supabase Auth user) |
| `students` | `id`, `school_id` FK, `first_name`, `year_group` |
| `guardians` | `id`, `email`, `phone` |
| `guardian_student` | `guardian_id` FK, `student_id` FK, `relationship` |
| `payment_requests` | `id`, `school_id` FK, `title`, `description`, `amount_pence`, `due_date`, `status` |
| `assignments` | `id`, `payment_request_id` FK, `student_id` FK, `amount_due_pence`, `amount_paid_pence`, `status` (`unpaid`/`partial`/`paid`/`waived`) |
| `transactions` | `id`, `guardian_id` FK, `stripe_payment_intent`, `amount_pence`, `status` (`pending`/`succeeded`/`failed`/`refunded`) |
| `transaction_lines` | `id`, `transaction_id` FK, `assignment_id` FK, `amount_pence` |
| `ledger_entries` | `id`, `transaction_id` FK, `account`, `debit_pence`, `credit_pence`, `created_at` |
| `stripe_events` | `id`, `stripe_event_id` (unique), `type`, `processed_at` |

---

## Non-Negotiable Money Rules

1. **All money amounts are INTEGER PENCE.** Never floats, never decimals, anywhere.
2. **Nothing is ever marked paid at checkout/redirect time.** Only a verified Stripe webhook marks anything as paid.
3. **Every webhook handler is idempotent**: check `stripe_events` for the event id before processing; if already processed, do nothing.
4. **`ledger_entries` is append-only**: no `UPDATE` or `DELETE` ever. Corrections are new reversing entries.
5. **Every displayed "amount paid" is derived from `transaction_lines`/`ledger`**, never stored as an independently editable field.
6. **Stripe webhook signatures must be verified on every request.**
7. **Row Level Security**: every school-scoped table must have RLS policies so an admin can only see rows belonging to their own school.

---

## Data Protection

- We hold children's data. Store only: `first_name`, `year_group`, parent `email`/`phone`. **Never** request or store surnames, dates of birth, addresses, medical details, or photos.
- Parent magic links must be **signed**, **single-guardian-scoped**, and **expire within 7 days**.

---

## Fee Model (non-negotiable)

- The school (connected account) bears all fees. Fees are netted off at source by Stripe; we never invoice schools separately.
- Fee components per transaction: Stripe processing fee (~1.5% + 20p for UK consumer cards) + School2Pay application fee (50p flat for MVP).
- **NO SURCHARGING**: we never add a card fee at parent checkout. Surcharging consumer card payments has been illegal in the UK since 2018. The price the parent sees is the price the parent pays.
- Gross-up formula: `charge_pence = ceil((net_target_pence + fixed_fees_pence) / (1 - percentage_fee))`.
- Every money figure shown to an admin must be labelled **gross**, **fees**, or **net**. Never display an unlabelled amount.

---

## Engineering Style

- Small, typed modules. Server-side logic in route handlers / server actions, not client components.
- Write a test for every money-path function (webhook handling, ledger posting, assignment status transitions).
- All secrets in environment variables; create `.env.example` listing every variable needed.
- After completing any task, summarise what was built, list any shortcuts taken, and list what still needs manual testing.
