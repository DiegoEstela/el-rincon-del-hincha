// Methodology: "What is at stake". Numbers only; the Spanish sentences belong to the UI.
import {
  classifyDominance,
  Dominance,
  DOMINANCE_THRESHOLDS,
  type DominanceThresholds,
} from "./dominance";
import type { HistoryRecord } from "./types";

/** "Estás a 1 victoria de las 30": the next milestone is a multiple of this step. */
export const WIN_MILESTONE_STEP = 10;

export type AtStake = Readonly<{
  /** Wins (assuming no draws, which do not move the balance) to reach `improvesTo`. */
  winsToImprove: number | null;
  improvesTo: Dominance | null;
  /** Losses to fall to `worsensTo`. */
  lossesToWorsen: number | null;
  worsensTo: Dominance | null;
  /** Next multiple of the step strictly above the current wins. */
  nextWinMilestone: Readonly<{ milestone: number; winsNeeded: number }>;
}>;

type Change = Omit<AtStake, "nextWinMilestone">;

function classChange(balance: number, thresholds: DominanceThresholds): Change {
  switch (classifyDominance(balance, thresholds)) {
    case Dominance.Dominated:
      return {
        winsToImprove: thresholds.dominatedUpTo + 1 - balance,
        improvesTo: Dominance.Even,
        lossesToWorsen: null,
        worsensTo: null,
      };
    case Dominance.Even:
      return {
        winsToImprove: thresholds.dominatesFrom - balance,
        improvesTo: Dominance.Dominates,
        lossesToWorsen: balance - thresholds.dominatedUpTo,
        worsensTo: Dominance.Dominated,
      };
    case Dominance.Dominates:
      return {
        winsToImprove: null,
        improvesTo: null,
        lossesToWorsen: balance - (thresholds.dominatesFrom - 1),
        worsensTo: Dominance.Even,
      };
  }
}

export function whatIsAtStake(
  record: Pick<HistoryRecord, "won" | "balance">,
  thresholds: DominanceThresholds = DOMINANCE_THRESHOLDS,
  step: number = WIN_MILESTONE_STEP,
): AtStake {
  if (!Number.isInteger(step) || step <= 0) {
    throw new RangeError("The win milestone step must be a positive integer.");
  }
  const milestone = (Math.floor(record.won / step) + 1) * step;
  return {
    ...classChange(record.balance, thresholds),
    nextWinMilestone: { milestone, winsNeeded: milestone - record.won },
  };
}
