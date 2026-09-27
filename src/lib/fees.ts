// Single source of truth for all fee figures used in the app and on /fees page.

// Keep the legacy constant for display purposes (e.g. fees page table showing minimum fee).
// Use calculateApplicationFee(basketPence) everywhere a real basket amount is known.
export const APPLICATION_FEE_PENCE = 40; // minimum tier — used only as a display fallback
export const STRIPE_PERCENT = 0.015;
export const STRIPE_FIXED_PENCE = 20;

/**
 * Tiered per-checkout application fee based on basket value.
 *
 * | Basket        | Fee  |
 * |---------------|------|
 * | Under £10     | 40p  |
 * | £10 – £50     | 60p  |
 * | Over £50      | 75p  |
 *
 * Charged per checkout (not per item) to encourage multi-item baskets.
 */
export function calculateApplicationFee(basketPence: number): number {
  if (basketPence < 1000) return 40;   // under £10
  if (basketPence <= 5000) return 60;  // £10–£50
  return 75;                            // over £50
}

/**
 * Returns the integer pence the school receives after both Stripe and
 * School2Pay fees are deducted from the given charge.
 */
export function estimateNetPence(chargePence: number, appFeePence?: number): number {
  if (chargePence <= 0) throw new Error("chargePence must be positive");
  const appFee = appFeePence ?? calculateApplicationFee(chargePence);
  const stripeFee = Math.ceil(chargePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE;
  return chargePence - stripeFee - appFee;
}

/**
 * Returns the smallest integer charge in pence such that the school receives
 * at least netTargetPence after all fees.
 *
 * Uses the tiered fee for the estimated basket size, then verifies.
 * Formula: ceil((net + fixed_fees) / (1 - percentage_fee))
 */
export function grossUpToNet(netTargetPence: number): number {
  if (netTargetPence <= 0) throw new Error("netTargetPence must be positive");
  // Estimate basket ≈ net (conservative — real charge will be slightly higher)
  const appFee = calculateApplicationFee(netTargetPence);
  const fixedFees = STRIPE_FIXED_PENCE + appFee;
  const raw = (netTargetPence + fixedFees) / (1 - STRIPE_PERCENT);
  let charge = Math.ceil(raw);
  // Guard: due to rounding in estimateNetPence (ceil on stripe %), step up if needed.
  // Re-evaluate appFee at actual charge level in case it crosses a tier boundary.
  while (estimateNetPence(charge, calculateApplicationFee(charge)) < netTargetPence) {
    charge += 1;
  }
  return charge;
}

/** Formats integer pence as a £ string, e.g. 2609 → "£26.09" */
export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Full fee breakdown for a given charge in pence.
 */
export function feeBreakdown(chargePence: number): {
  chargePence: number;
  stripeFee: number;
  appFee: number;
  netPence: number;
} {
  if (chargePence <= 0) throw new Error("chargePence must be positive");
  const appFee = calculateApplicationFee(chargePence);
  const stripeFee = Math.ceil(chargePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE;
  const netPence = chargePence - stripeFee - appFee;
  return { chargePence, stripeFee, appFee, netPence };
}
