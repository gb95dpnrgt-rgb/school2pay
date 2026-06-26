# Architecture Decisions

## Stripe Connect — Spike (Prompt 1C)

### Charge type: Destination charge (via Checkout `stripeAccount`)

We create the Checkout Session **on behalf of the connected account** using
`{ stripeAccount: accountId }`. This is a "direct charge" variant: the payment
appears on the connected account's balance, and we pull out our application fee
at charge time via `payment_intent_data.application_fee_amount`.

**Alternatives considered:**
- *Destination charges* (platform charges, transfers to connected account) — simpler
  for the platform but means the platform is the merchant of record, not the trust.
  Schools need to be merchant of record so their bank statements show the receipts.
- *Separate charges + transfers* — most flexible but overengineered for MVP.

**Decision:** Direct charge to connected account + application fee. The trust
(connected account) is merchant of record. ✅

---

### Connected account type: Express

Using `controller.stripe_dashboard.type = "express"` which maps to Stripe Express.

**Why Express, not Standard:**
- Standard requires schools to have their own full Stripe account — too much
  friction for a school finance officer to set up.
- Express gives them a hosted, Stripe-managed dashboard for payouts and disputes
  with minimal onboarding steps.
- Custom would require us to build all dispute/payout UI ourselves — out of scope.

**Decision:** Express accounts. ✅

---

### Fee model

| Component | Amount | Who bears it |
|---|---|---|
| Stripe processing (UK consumer card) | ~1.5% + 20p | Connected account (school/trust) |
| School2Pay application fee | 50p flat | Connected account (school/trust) |
| Surcharge to parent | **NONE** | — |

Surcharging consumer card payments has been **illegal in the UK since January 2018**
(Payment Services Regulations 2017 implementing EU PSD2). We gross up the charge
so the school nets the target amount.

**Gross-up formula:**
```
charge_pence = ceil((net_target + stripe_fixed + app_fee) / (1 - stripe_pct))
             = ceil((2500 + 20 + 50) / (1 - 0.015))
             = ceil(2570 / 0.985)
             = 2609p  (£26.09 gross for a £25.00 trip)
```

Note: Stripe's actual rate for UK consumer cards varies (1.5% + 20p is typical
for Mastercard/Visa debit; credit cards may be higher). In production we should
re-verify the blended rate with Stripe account team and consider using Stripe's
[adaptive pricing](https://stripe.com/docs/payments/checkout/adaptive-pricing).

---

### Webhook idempotency

Every inbound Stripe event is checked against `stripe_events(stripe_event_id)`
before processing. Duplicate events (Stripe retries) are acknowledged and
ignored — they never re-trigger business logic.

---

### What must be revisited before live mode

1. **Stripe processing rate** — confirm exact rate for GB consumer + business cards
   with Stripe; update gross-up formula.
2. **Express onboarding UX** — currently redirects to Stripe hosted onboarding.
   Consider embedding with Connect Embedded Components for a smoother in-app flow.
3. **Webhook endpoint URL** — must be registered in Stripe Dashboard pointing to
   `https://ascappilot.vercel.app/api/stripe/webhook` (or production domain).
4. **`STRIPE_SECRET_KEY` live mode** — swap from `sk_test_*` to `sk_live_*` and
   update in Vercel env vars.
5. **Application fee amount** — 50p flat is MVP pricing. Real pricing TBD (may be
   % of transaction or tiered by trust size).
6. **Disputes / refunds** — connected account bears dispute liability (as Express
   merchant of record). Need a dispute-handling runbook before go-live.
7. **Payout schedule** — Express default is daily automatic payouts. Confirm this
   matches school expectations (some may want weekly).
8. **`/spike` page** — remove or hard-gate before any public launch.
