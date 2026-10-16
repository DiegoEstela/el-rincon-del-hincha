import { describe, expect, it } from "vitest";
import { isSeasonFullyCovered } from "@/data-model/coverage";
import type { Coverage, Season } from "@/data-model/types";

const season: Season = {
  id: "league-x-2020",
  competition_id: "league-x",
  name: "2020",
  start: "2020-01-01",
  end: "2020-12-31",
  source: "fixture:synthetic",
};
const row = (over: Partial<Coverage> = {}): Coverage => ({
  club_id: "club-a",
  competition_id: "league-x",
  from: "2020-01-01",
  to: null,
  complete: true,
  source: "fixture:synthetic",
  ...over,
});
const covered = (rows: Coverage[]) => isSeasonFullyCovered(rows, "club-a", "league-x", season);

describe("isSeasonFullyCovered", () => {
  it("is true for an ongoing complete range starting at or before the season", () => {
    expect(covered([row()])).toBe(true);
    expect(covered([row({ from: "2019-01-01" })])).toBe(true);
  });
  it("is true for a closed range ending exactly at or after the season end", () => {
    expect(covered([row({ to: "2020-12-31" })])).toBe(true);
    expect(covered([row({ to: "2021-06-30" })])).toBe(true);
  });
  it("is false when the range ends before the season end", () => {
    expect(covered([row({ to: "2020-12-30" })])).toBe(false);
  });
  it("is false when the range starts after the season start", () => {
    expect(covered([row({ from: "2020-01-02" })])).toBe(false);
  });
  it("is false when not complete", () => {
    expect(covered([row({ complete: false })])).toBe(false);
  });
  it("is false for another club or competition", () => {
    expect(covered([row({ club_id: "club-b" })])).toBe(false);
    expect(covered([row({ competition_id: "cup-y" })])).toBe(false);
  });
  it("is true when any of several rows contains the season", () => {
    expect(covered([row({ complete: false }), row({ from: "2019-01-01" })])).toBe(true);
  });
  it("is false with no rows", () => {
    expect(covered([])).toBe(false);
  });
});
