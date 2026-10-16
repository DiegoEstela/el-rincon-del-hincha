import { describe, expect, it } from "vitest";
import {
  assertThresholds,
  classifyDominance,
  Dominance,
  DOMINANCE_THRESHOLDS,
} from "@/domain/dominance";

describe("dominance thresholds (methodology: +2 or more dominates, -2 or less is dominated)", () => {
  it("pins the default thresholds", () => {
    expect(DOMINANCE_THRESHOLDS).toEqual({ dominatesFrom: 2, dominatedUpTo: -2 });
  });
  it.each([
    [-3, Dominance.Dominated],
    [-2, Dominance.Dominated],
    [-1, Dominance.Even],
    [0, Dominance.Even],
    [1, Dominance.Even],
    [2, Dominance.Dominates],
    [3, Dominance.Dominates],
  ])("classifies a balance of %i as %s", (balance, expected) => {
    expect(classifyDominance(balance)).toBe(expected);
  });
  it("moves the edges with custom thresholds", () => {
    const custom = { dominatesFrom: 3, dominatedUpTo: -3 };
    expect(classifyDominance(2, custom)).toBe(Dominance.Even);
    expect(classifyDominance(3, custom)).toBe(Dominance.Dominates);
    expect(classifyDominance(-2, custom)).toBe(Dominance.Even);
    expect(classifyDominance(-3, custom)).toBe(Dominance.Dominated);
  });
  it("exposes English values, not Spanish labels", () => {
    expect(Object.values(Dominance)).toEqual(["dominates", "even", "dominated"]);
  });
});

describe("assertThresholds", () => {
  it("accepts valid thresholds", () => {
    expect(() => assertThresholds(DOMINANCE_THRESHOLDS)).not.toThrow();
  });
  it("rejects a dominatedUpTo that is not negative (balance 0 must be even)", () => {
    expect(() => assertThresholds({ dominatesFrom: 2, dominatedUpTo: 0 })).toThrow(RangeError);
    expect(() => assertThresholds({ dominatesFrom: 2, dominatedUpTo: 1 })).toThrow(RangeError);
  });
  it("rejects a dominatesFrom that is not positive", () => {
    expect(() => assertThresholds({ dominatesFrom: 0, dominatedUpTo: -2 })).toThrow(RangeError);
    expect(() => assertThresholds({ dominatesFrom: -1, dominatedUpTo: -2 })).toThrow(RangeError);
  });
  it("makes classifyDominance throw with invalid thresholds", () => {
    expect(() => classifyDominance(0, { dominatesFrom: 0, dominatedUpTo: -2 })).toThrow(RangeError);
  });
});
