// Single source of truth for all fee figures used in the app and on /fees page.
export const APPLICATION_FEE_PENCE = 50;
export const STRIPE_PERCENT = 0.015;
export const STRIPE_FIXED_PENCE = 20;

/**
 * Returns the integer pence the school receives after both Stripe and
 * School2Pay fees are deducted from the given charge.
 */
export function estimateNetPence(chargePence: number): number {
  if (chargePence <= 0) throw new Error("chargePence must be positive");
  const stripeFee = Math.ceil(chargePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE;
  return chargePence - stripeFee - APPLICATION_FEE_PENCE;
}

/**
 * Returns the smallest integer charge in pence such that the school receives
 * at least netTargetPence after all fees.
 *
 * Formula: ceil((net + fixed_fees) / (1 - percentage_fee))
 * where fixed_fees = STRIPE_FIXED_PENCE + APPLICATION_FEE_PENCE
 */
export function grossUpToNet(netTargetPence: number): number {
  if (netTargetPence <= 0) throw new Error("netTargetPence must be positive");
  const fixedFees = STRIPE_FIXED_PENCE + APPLICATION_FEE_PENCE;
  const raw = (netTargetPence + fixedFees) / (1 - STRIPE_PERCENT);
  let charge = Math.ceil(raw);
  // Guard: due to rounding in estimateNetPence (ceil on stripe %), step up if needed.
  while (estimateNetPence(charge) < netTargetPence) {
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
  const stripeFee = Math.ceil(chargePence * STRIPE_PERCENT) + STRIPE_FIXED_PENCE;
  const netPence = chargePence - stripeFee - APPLICATION_FEE_PENCE;
  return { chargePence, stripeFee, appFee: APPLICATION_FEE_PENCE, netPence };
}
