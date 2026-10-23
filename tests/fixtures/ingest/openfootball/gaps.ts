// Declared coverage gaps for a run of the openfootball adapter on its own (plan 0017): its 2025
// Apertura stops at the group stage, so the tail from 2025-05-05 is a gap until RSSSF fills it. The
// real list starts the gap after the 2025 Clausura, because both sources are loaded together.
import { COVERAGE_GAPS } from "../../../../src/data-model/coverage-gaps";
import type { CoverageGap } from "../../../../src/data-model/coverage-generate";

export const OPENFOOTBALL_ONLY_GAPS: readonly CoverageGap[] = COVERAGE_GAPS.map((gap) =>
  gap.competition_id === "primera-division"
    ? {
        ...gap,
        from: "2025-05-05",
        reason: "Without RSSSF the 2025 Apertura knockout stage and what follows are not loaded.",
      }
    : gap,
);
