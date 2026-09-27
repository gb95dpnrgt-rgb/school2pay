import { describe, it, expect } from "vitest";
import { calculateApplicationFee, grossUpToNet, estimateNetPence, feeBreakdown } from "../fees";

// ── calculateApplicationFee ────────────────────────────────────────────────────

describe("calculateApplicationFee", () => {
  it("returns 40p for baskets under £10", () => {
    expect(calculateApplicationFee(0)).toBe(40);
    expect(calculateApplicationFee(1)).toBe(40);
    expect(calculateApplicationFee(999)).toBe(40);   // £9.99
  });

  it("returns 40p at the £0 boundary", () => {
    expect(calculateApplicationFee(0)).toBe(40);
  });

  it("returns 60p at exactly £10 (1000p)", () => {
    expect(calculateApplicationFee(1000)).toBe(60);
  });

  it("returns 60p for baskets £10–£50", () => {
    expect(calculateApplicationFee(1000)).toBe(60);
    expect(calculateApplicationFee(2500)).toBe(60);  // £25
    expect(calculateApplicationFee(5000)).toBe(60);  // £50 exactly
  });

  it("returns 75p for baskets over £50 (5001p+)", () => {
    expect(calculateApplicationFee(5001)).toBe(75);
    expect(calculateApplicationFee(10000)).toBe(75); // £100
    expect(calculateApplicationFee(50000)).toBe(75); // £500
  });

  it("returns 75p at the £50 boundary exclusive (5001p)", () => {
    expect(calculateApplicationFee(5000)).toBe(60); // £50.00 → mid tier
    expect(calculateApplicationFee(5001)).toBe(75); // £50.01 → top tier
  });
});

// ── estimateNetPence ───────────────────────────────────────────────────────────

describe("estimateNetPence", () => {
  it("uses tiered fee when no appFeePence provided", () => {
    // £25 charge → 60p app fee, 1.5%+20p Stripe = ceil(2500*0.015)+20 = 38+20 = 58p
    // net = 2500 - 58 - 60 = 2382
    expect(estimateNetPence(2500)).toBe(2382);
  });

  it("uses provided appFeePence when given", () => {
    const stripeFee = Math.ceil(2500 * 0.015) + 20; // 58
    expect(estimateNetPence(2500, 50)).toBe(2500 - stripeFee - 50);
  });

  it("throws for non-positive charge", () => {
    expect(() => estimateNetPence(0)).toThrow();
    expect(() => estimateNetPence(-1)).toThrow();
  });
});

// ── grossUpToNet ───────────────────────────────────────────────────────────────

describe("grossUpToNet", () => {
  it("gross-up and net-back is idempotent for small baskets (40p fee tier)", () => {
    const net = 500; // £5 net target
    const charge = grossUpToNet(net);
    expect(estimateNetPence(charge, calculateApplicationFee(charge))).toBeGreaterThanOrEqual(net);
  });

  it("gross-up and net-back is idempotent for mid baskets (60p fee tier)", () => {
    const net = 2000; // £20 net target
    const charge = grossUpToNet(net);
    expect(estimateNetPence(charge, calculateApplicationFee(charge))).toBeGreaterThanOrEqual(net);
  });

  it("gross-up and net-back is idempotent for large baskets (75p fee tier)", () => {
    const net = 6000; // £60 net target
    const charge = grossUpToNet(net);
    expect(estimateNetPence(charge, calculateApplicationFee(charge))).toBeGreaterThanOrEqual(net);
  });

  it("always returns integers", () => {
    [100, 999, 1000, 2500, 5000, 5001, 10000].forEach((net) => {
      expect(Number.isInteger(grossUpToNet(net))).toBe(true);
    });
  });

  it("throws for non-positive net target", () => {
    expect(() => grossUpToNet(0)).toThrow();
    expect(() => grossUpToNet(-1)).toThrow();
  });
});

// ── feeBreakdown ───────────────────────────────────────────────────────────────

describe("feeBreakdown", () => {
  it("uses tiered app fee", () => {
    const bd = feeBreakdown(2500);
    expect(bd.appFee).toBe(60); // £25 → 60p
  });

  it("components sum to charge", () => {
    [500, 2500, 6000].forEach((charge) => {
      const bd = feeBreakdown(charge);
      expect(bd.stripeFee + bd.appFee + bd.netPence).toBe(charge);
    });
  });

  it("throws for non-positive charge", () => {
    expect(() => feeBreakdown(0)).toThrow();
  });
});
