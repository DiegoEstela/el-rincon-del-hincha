// Methodology: "Dominance". Thresholds live in a configurable constant.

export const Dominance = { Dominates: "dominates", Even: "even", Dominated: "dominated" } as const;
export type Dominance = (typeof Dominance)[keyof typeof Dominance];

export type DominanceThresholds = Readonly<{
  /** Balance at or above this dominates. */
  dominatesFrom: number;
  /** Balance at or below this is dominated. */
  dominatedUpTo: number;
}>;

export const DOMINANCE_THRESHOLDS: DominanceThresholds = { dominatesFrom: 2, dominatedUpTo: -2 };

/** A balance of 0 must always be even, so the edges must straddle zero. */
export function assertThresholds(thresholds: DominanceThresholds): void {
  if (!(thresholds.dominatedUpTo < 0 && thresholds.dominatesFrom > 0)) {
    throw new RangeError("Dominance thresholds need dominatedUpTo < 0 < dominatesFrom.");
  }
}

export function classifyDominance(
  balance: number,
  thresholds: DominanceThresholds = DOMINANCE_THRESHOLDS,
): Dominance {
  assertThresholds(thresholds);
  if (balance >= thresholds.dominatesFrom) return Dominance.Dominates;
  if (balance <= thresholds.dominatedUpTo) return Dominance.Dominated;
  return Dominance.Even;
}
