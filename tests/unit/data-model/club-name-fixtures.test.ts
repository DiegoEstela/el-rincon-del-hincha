import { describe, expect, it } from "vitest";
import {
  KAGGLE_CLUB_NAMES,
  KAGGLE_LOOKALIKE_NAMES,
  OPENFOOTBALL_2025_NAMES,
} from "../../fixtures/clubs/source-names";

describe("club source-name fixtures", () => {
  it("lists the 30 unique openfootball 2025 names", () => {
    expect(OPENFOOTBALL_2025_NAMES).toHaveLength(30);
    expect(new Set(OPENFOOTBALL_2025_NAMES).size).toBe(30);
  });

  it("lists the 29 unique Kaggle names of the same clubs", () => {
    expect(Object.keys(KAGGLE_CLUB_NAMES)).toHaveLength(29);
    expect(new Set(Object.keys(KAGGLE_CLUB_NAMES)).size).toBe(29);
  });

  it("keeps the lookalike Kaggle names disjoint from both lists", () => {
    const known = new Set([...OPENFOOTBALL_2025_NAMES, ...Object.keys(KAGGLE_CLUB_NAMES)]);
    expect(KAGGLE_LOOKALIKE_NAMES).toHaveLength(21);
    for (const name of KAGGLE_LOOKALIKE_NAMES) expect(known.has(name)).toBe(false);
  });
});
