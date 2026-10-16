import { describe, expect, it } from "vitest";
import {
  FIXED_NOW,
  makeCompetition,
  makeSeason,
  makeTitle,
  validDataset,
} from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { compareFans, fanSummary } from "@/domain/compare-fans";
import type { FixtureDataset } from "../../fixtures/data-model/dataset";

const indexOf = (ds: FixtureDataset) => buildStatsIndex(statsDataFrom(ds));
const world = indexOf(statsWorld());
const fanA = { clubId: "club-a", start: "2020-01-01" };
const fanB = { clubId: "club-b", start: "2020-01-01" };

describe("fanSummary: titles, finals, classics, relegations, streak", () => {
  const a = fanSummary(world, fanA, FIXED_NOW);
  const b = fanSummary(world, fanB, FIXED_NOW);

  it("counts recognized titles in total, international and domestic", () => {
    expect(a).toMatchObject({ totalTitles: 5, internationalTitles: 0, domesticTitles: 5 });
    expect(b).toMatchObject({ totalTitles: 2, internationalTitles: 1, domesticTitles: 1 });
  });
  it("counts a shared title fully", () => {
    // t5 (club A) and t6 (club B) are the same shared league title.
    expect(a.totalTitles).toBe(5);
    expect(b.totalTitles).toBe(2);
  });
  it("counts the 'other' shelf in the total but not in international or domestic", () => {
    const ds = statsWorld();
    ds["competitions.json"].push(makeCompetition("other-q", { type: "other" }));
    ds["seasons.json"].push(makeSeason("other-q-2021", "other-q", "2021-01-01", "2021-12-31"));
    ds["titles.json"].push(makeTitle("t-other", "club-a", "other-q", "other-q-2021", "2021-06-01"));
    const summary = fanSummary(indexOf(ds), fanA, FIXED_NOW);
    expect(summary).toMatchObject({ totalTitles: 6, internationalTitles: 0, domesticTitles: 5 });
  });
  it("ignores unrecognized titles", () => {
    expect(a.totalTitles).toBe(5); // t7 (league-old) is not counted
  });
  it("counts finals won and played", () => {
    expect(a).toMatchObject({ finalsWon: 3, finalsPlayed: 3 });
    expect(b).toMatchObject({ finalsWon: 1, finalsPlayed: 3 });
  });
  it("sums the balance against every classic rival", () => {
    expect(a.classicsBalance).toBe(4); // only club B is a classic; club C is is_classic false
    expect(b.classicsBalance).toBe(-4);
    const ds = statsWorld();
    ds["rivalries.json"].push({
      club_a: "club-a",
      club_b: "club-d",
      is_classic: true,
      source: "fixture:synthetic",
    });
    // A vs D: one loss (m3) and one administrative win (m5) = 0.
    expect(fanSummary(indexOf(ds), fanA, FIXED_NOW).classicsBalance).toBe(4);
    const more = validDataset();
    more["rivalries.json"].push({
      club_a: "club-a",
      club_b: "club-d",
      is_classic: true,
      source: "fixture:synthetic",
    });
    // Valid dataset: A vs B = +2 (m1, m8), A vs D = 0 (m3 L, m5 W).
    expect(fanSummary(indexOf(more), fanA, FIXED_NOW).classicsBalance).toBe(2);
  });
  it("is zero, not null, when a classic exists but was never played in the period", () => {
    const summary = fanSummary(world, { clubId: "club-a", start: "2025-01-01" }, FIXED_NOW);
    expect(summary.classicsBalance).toBe(0);
  });
  it("is null when the club has no classic rival defined", () => {
    const ds = statsWorld();
    ds["rivalries.json"] = [];
    expect(fanSummary(indexOf(ds), fanA, FIXED_NOW).classicsBalance).toBeNull();
  });
  it("counts the relegations inside the period only", () => {
    expect(b.relegations).toBe(1);
    expect(a.relegations).toBe(0);
    expect(
      fanSummary(world, { clubId: "club-b", start: "2023-12-31" }, FIXED_NOW).relegations,
    ).toBe(1);
    expect(
      fanSummary(world, { clubId: "club-b", start: "2024-01-01" }, FIXED_NOW).relegations,
    ).toBe(0);
  });
  it("does not count promotions as relegations", () => {
    const ds = statsWorld();
    ds["movements.json"].push({
      id: "mv-up",
      club_id: "club-b",
      type: "promotion",
      date: "2024-12-31",
      season_id: "league-x-2024",
      source: "fixture:synthetic",
    });
    expect(fanSummary(indexOf(ds), fanB, FIXED_NOW).relegations).toBe(1);
  });
  it("gives the best win streak length, 0 with no matches", () => {
    expect(a.bestStreak).toBe(2);
    expect(b.bestStreak).toBe(2);
    expect(
      fanSummary(world, { clubId: "club-nobody", start: "2020-01-01" }, FIXED_NOW).bestStreak,
    ).toBe(0);
  });
  it("carries its own coverage notice and period", () => {
    expect(a.period).toEqual({ start: "2020-01-01", end: "2026-10-16", isEmpty: false });
    expect(a.coverage.isComplete).toBe(false);
  });
});

describe("compareFans: category scoreboard", () => {
  const result = compareFans(world, fanA, fanB, FIXED_NOW);
  const winners = Object.fromEntries(result.categories.map((c) => [c.id, c.winner]));

  it("compares eight categories with the winner of each", () => {
    expect(winners).toEqual({
      total_titles: "a",
      international_titles: "b",
      domestic_titles: "a",
      finals_won: "a",
      finals_played: "tie",
      classics_balance: "a",
      relegations_suffered: "a",
      best_win_streak: "tie",
    });
  });
  it("marks relegations as lower-is-better and the rest as higher-is-better", () => {
    const better = Object.fromEntries(result.categories.map((c) => [c.id, c.better]));
    expect(better.relegations_suffered).toBe("lower");
    expect(better.total_titles).toBe("higher");
  });
  it("carries the values of each side", () => {
    const relegations = result.categories.find((c) => c.id === "relegations_suffered");
    expect(relegations).toMatchObject({ a: 0, b: 1 });
  });
  it("gives no point for a tie and counts the ties", () => {
    expect(result.scoreboard).toEqual({ a: 5, b: 1, ties: 2 });
  });
  it("lets the lower value win relegations when B has fewer", () => {
    const flipped = compareFans(world, fanB, fanA, FIXED_NOW);
    const relegations = flipped.categories.find((c) => c.id === "relegations_suffered");
    expect(relegations?.winner).toBe("b");
  });
  it("is not applicable when either side has no classic rival defined", () => {
    const ds = statsWorld();
    ds["rivalries.json"] = [
      { club_a: "club-c", club_b: "club-d", is_classic: true, source: "fixture:synthetic" },
    ];
    const partial = compareFans(
      indexOf(ds),
      fanA,
      { clubId: "club-c", start: "2020-01-01" },
      FIXED_NOW,
    );
    const classics = partial.categories.find((c) => c.id === "classics_balance");
    expect(classics).toMatchObject({ a: null, winner: "not_applicable" });
    const mirrored = compareFans(
      indexOf(ds),
      { clubId: "club-c", start: "2020-01-01" },
      fanA,
      FIXED_NOW,
    );
    expect(mirrored.categories.find((c) => c.id === "classics_balance")?.winner).toBe(
      "not_applicable",
    );
    expect(partial.scoreboard.a + partial.scoreboard.b + partial.scoreboard.ties).toBe(7);
  });
  it("produces no total or weighted score, only the categories and the counts", () => {
    expect(Object.keys(result).sort()).toEqual(
      ["a", "b", "categories", "headToHead", "headToHeadReason", "scoreboard"].sort(),
    );
    expect(Object.keys(result.scoreboard).sort()).toEqual(["a", "b", "ties"]);
  });
  it("swapping the fans mirrors the result", () => {
    const flipped = compareFans(world, fanB, fanA, FIXED_NOW);
    expect(flipped.scoreboard).toEqual({ a: 1, b: 5, ties: 2 });
    const mirror = (w: string) => (w === "a" ? "b" : w === "b" ? "a" : w);
    expect(flipped.categories.map((c) => c.winner)).toEqual(
      result.categories.map((c) => mirror(c.winner)),
    );
  });
  it("carries each side's own coverage notice", () => {
    expect(result.a.coverage.isComplete).toBe(false);
    expect(result.b.coverage.competitions.length).toBeGreaterThan(0);
  });
});

describe("compareFans: direct head-to-head from the later start date", () => {
  it("uses the later start, from fan A's perspective", () => {
    const early = { clubId: "club-a", start: "2020-01-01" };
    const late = { clubId: "club-b", start: "2022-01-01" };
    const result = compareFans(world, early, late, FIXED_NOW);
    expect(result.headToHeadReason).toBeNull();
    expect(result.headToHead?.clubId).toBe("club-a");
    // w3, w4, w5, w6 and w8 are inside; m1, m8, w1 and w2 (before 2022) are excluded.
    expect(result.headToHead?.record).toMatchObject({ played: 5, won: 3, drawn: 1, lost: 1 });
    expect(result.headToHead?.lastMatch?.match.id).toBe("w8");
  });
  it("is the same pair of clubs seen from the other fan when swapped", () => {
    const early = { clubId: "club-a", start: "2020-01-01" };
    const late = { clubId: "club-b", start: "2022-01-01" };
    const swapped = compareFans(world, late, early, FIXED_NOW);
    expect(swapped.headToHead?.clubId).toBe("club-b");
    expect(swapped.headToHead?.record).toMatchObject({ played: 5, won: 1, drawn: 1, lost: 3 });
  });
  it("is null with reason same_club when both fans follow the same club, still with a scoreboard", () => {
    const result = compareFans(
      world,
      { clubId: "club-a", start: "2020-01-01" },
      { clubId: "club-a", start: "2022-01-01" },
      FIXED_NOW,
    );
    expect(result.headToHead).toBeNull();
    expect(result.headToHeadReason).toBe("same_club");
    expect(result.categories).toHaveLength(8);
    expect(result.a.totalTitles).toBeGreaterThan(result.b.totalTitles);
  });
});
