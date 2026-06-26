import { describe, it, expect } from "vitest";
import {
  estimateNetPence,
  grossUpToNet,
  APPLICATION_FEE_PENCE,
  STRIPE_PERCENT,
  STRIPE_FIXED_PENCE,
} from "../src/lib/fees";

describe("estimateNetPence", () => {
  it("returns correct net for £25.00 charge", () => {
    // stripe fee: ceil(2500 * 0.015) + 20 = ceil(37.5) + 20 = 38 + 20 = 58
    // net: 2500 - 58 - 50 = 2392
    expect(estimateNetPence(2500)).toBe(2392);
  });

  it("throws on zero input", () => {
    expect(() => estimateNetPence(0)).toThrow();
  });

  it("throws on negative input", () => {
    expect(() => estimateNetPence(-1)).toThrow();
  });

  it("returns integer", () => {
    const result = estimateNetPence(1000);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("grossUpToNet", () => {
  it("grossUpToNet(2500) nets at least 2500", () => {
    const charge = grossUpToNet(2500);
    expect(estimateNetPence(charge)).toBeGreaterThanOrEqual(2500);
  });

  it("grossUpToNet(2500) is minimal — one less would net below 2500", () => {
    const charge = grossUpToNet(2500);
    expect(estimateNetPence(charge - 1)).toBeLessThan(2500);
  });

  it("throws on zero input", () => {
    expect(() => grossUpToNet(0)).toThrow();
  });

  it("throws on negative input", () => {
    expect(() => grossUpToNet(-100)).toThrow();
  });
});

describe("grossUpToNet round-trip property: £1–£500 in 1p steps", () => {
  it("net never falls below target for any net target in range", () => {
    for (let net = 1; net <= 50000; net++) {
      const charge = grossUpToNet(net);
      const actual = estimateNetPence(charge);
      if (actual < net) {
        throw new Error(
          `grossUpToNet(${net}) = ${charge} but estimateNetPence(${charge}) = ${actual} < ${net}`
        );
      }
    }
  });
});

describe("fee constants are integers", () => {
  it("APPLICATION_FEE_PENCE is a positive integer", () => {
    expect(Number.isInteger(APPLICATION_FEE_PENCE)).toBe(true);
    expect(APPLICATION_FEE_PENCE).toBeGreaterThan(0);
  });

  it("STRIPE_FIXED_PENCE is a positive integer", () => {
    expect(Number.isInteger(STRIPE_FIXED_PENCE)).toBe(true);
    expect(STRIPE_FIXED_PENCE).toBeGreaterThan(0);
  });

  it("STRIPE_PERCENT is between 0 and 1", () => {
    expect(STRIPE_PERCENT).toBeGreaterThan(0);
    expect(STRIPE_PERCENT).toBeLessThan(1);
  });
});
