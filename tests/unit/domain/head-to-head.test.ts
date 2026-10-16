import { describe, expect, it } from "vitest";
import {
  FIXED_NOW,
  makeCompetition,
  makeCoverage,
  makeMatch,
  makeSeason,
  validDataset,
} from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { whatIsAtStake } from "@/domain/at-stake";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { Dominance } from "@/domain/dominance";
import { headToHead } from "@/domain/head-to-head";
import { fanPeriod } from "@/domain/period";
import type { Match } from "@/data-model/types";

const world = buildStatsIndex(statsDataFrom(statsWorld()));
const from2020 = fanPeriod("2020-01-01", FIXED_NOW);

/** A small dataset where the only matches are the given ones (all in league-x-2020). */
function indexWith(matches: Match[]) {
  const ds = validDataset();
  ds["matches.json"] = matches;
  return buildStatsIndex(statsDataFrom(ds));
}
const game = (
  id: string,
  date: string,
  home: string,
  away: string,
  hg: number | null,
  ag: number | null,
  extra: Partial<Match> = {},
) => makeMatch(id, "league-x-2020", date, home, away, hg, ag, extra);

describe("head-to-head: record, dominance, last match, rivalry", () => {
  const h2h = headToHead(world, "club-a", "club-b", from2020);

  it("returns the record of the pair in the period", () => {
    expect(h2h.record).toMatchObject({
      played: 9,
      won: 6,
      drawn: 1,
      lost: 2,
      goalsFor: 17,
      goalsAgainst: 6,
      balance: 4,
    });
    expect(h2h.record.shootouts).toEqual({ played: 1, won: 1, lost: 0 });
    expect(h2h.record.administrative).toEqual({ count: 1, matchIds: ["w8"] });
    expect(h2h.record.suspendedExcluded).toBe(1);
  });
  it("classifies the dominance from the balance", () => {
    expect(h2h.dominance).toBe(Dominance.Dominates);
    expect(headToHead(world, "club-b", "club-a", from2020).dominance).toBe(Dominance.Dominated);
  });
  it("mirrors the record from the rival's side", () => {
    const mirror = headToHead(world, "club-b", "club-a", from2020).record;
    expect(mirror).toMatchObject({ won: 2, drawn: 1, lost: 6, balance: -4 });
  });
  it("gives the last match by date then id", () => {
    expect(h2h.lastMatch?.match.id).toBe("w8");
  });
  it("breaks a tie on the date by id for the last match", () => {
    const index = indexWith([
      game("b-second", "2020-03-01", "club-a", "club-b", 1, 0),
      game("a-first", "2020-03-01", "club-b", "club-a", 0, 1),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).lastMatch?.match.id).toBe("b-second");
  });
  it("lists the competitions actually included", () => {
    expect(h2h.competitionIds).toEqual(["cup-y", "league-x"]);
  });
  it("finds the rivalry in either order", () => {
    expect(h2h.rivalry).toMatchObject({ is_classic: true });
    expect(headToHead(world, "club-b", "club-a", from2020).rivalry).toMatchObject({
      is_classic: true,
    });
  });
  it("has no rivalry for a pair that is not a rivalry", () => {
    expect(headToHead(world, "club-b", "club-d", from2020).rivalry).toBeNull();
  });
  it("merges the coverage of both clubs: complete coverage of club A covers the pair", () => {
    // Club B alone is only complete from 2022 in league-x; club A is complete from 2020.
    // intl-z has a season in the period and club A played it, but no coverage row exists for it:
    // it is reported as missing, so the notice as a whole is not complete.
    expect(h2h.coverage.competitions.map((c) => [c.competitionId, c.status])).toEqual([
      ["cup-y", "complete"],
      ["intl-z", "missing"],
      ["league-x", "complete"],
    ]);
    expect(h2h.coverage.isComplete).toBe(false);
  });
  it("reports partial coverage when the period starts before both clubs are covered", () => {
    const early = headToHead(world, "club-a", "club-b", fanPeriod("2019-01-01", FIXED_NOW));
    expect(early.coverage.isComplete).toBe(false);
    expect(early.coverage.competitions.find((c) => c.competitionId === "league-x")).toMatchObject({
      competitionId: "league-x",
      status: "partial",
      completeFrom: "2020-01-01",
    });
  });
  it("is not complete when nothing is known about the pair", () => {
    const ds = validDataset();
    ds["matches.json"] = [];
    ds["coverage.json"] = [];
    const index = buildStatsIndex(statsDataFrom(ds));
    const result = headToHead(index, "club-a", "club-b", from2020);
    expect(result.competitionIds).toEqual([]);
    expect(result.coverage.competitions).toEqual([]);
    expect(result.coverage.isComplete).toBe(false);
  });
  it("throws when both ids are the same club", () => {
    expect(() => headToHead(world, "club-a", "club-a", from2020)).toThrow(RangeError);
  });
  it("gives a zero record, no last match and an even dominance when they never met in the period", () => {
    const empty = headToHead(world, "club-a", "club-b", fanPeriod("2025-01-01", FIXED_NOW));
    expect(empty.record.played).toBe(0);
    expect(empty.lastMatch).toBeNull();
    expect(empty.dominance).toBe(Dominance.Even);
    expect(empty.currentStreak).toBeNull();
    expect(empty.bestWinStreak).toBeNull();
    expect(empty.biggestWin).toBeNull();
    expect(empty.biggestLoss).toBeNull();
    expect(empty.finals).toEqual([]);
    // Both competitions have coverage rows overlapping the period, so the notice lists them.
    expect(empty.coverage).toEqual({
      isComplete: true,
      competitions: [
        {
          competitionId: "cup-y",
          status: "complete",
          completeFrom: "2020-01-01",
          completeTo: null,
        },
        {
          competitionId: "league-x",
          status: "complete",
          completeFrom: "2020-01-01",
          completeTo: null,
        },
      ],
    });
  });
  it("is empty for a future start", () => {
    const future = headToHead(world, "club-a", "club-b", fanPeriod("2030-01-01", FIXED_NOW));
    expect(future.record.played).toBe(0);
    expect(future.coverage).toEqual({ isComplete: true, competitions: [] });
  });
  it("respects the competition filter", () => {
    const cups = headToHead(world, "club-a", "club-b", from2020, { competitionIds: ["cup-y"] });
    expect(cups.record.played).toBe(4);
    expect(cups.competitionIds).toEqual(["cup-y"]);
  });
});

describe("head-to-head: streaks, biggest win and loss, finals, what is at stake", () => {
  const h2h = headToHead(world, "club-a", "club-b", from2020);

  it("takes the streaks from the matches of the pair only", () => {
    expect(h2h.currentStreak).toEqual({
      outcome: "W",
      length: 2,
      from: "2024-04-01",
      to: "2024-08-01",
    });
    expect(h2h.bestWinStreak).toEqual({
      outcome: "W",
      length: 3,
      from: "2020-03-01",
      to: "2021-11-01",
    });
  });
  it("does not use the results against other clubs for the pair's current streak", () => {
    const index = indexWith([
      game("g1", "2020-03-01", "club-a", "club-b", 1, 0),
      game("g2", "2020-03-08", "club-a", "club-b", 0, 1),
      game("g3", "2020-03-15", "club-a", "club-c", 3, 0),
      game("g4", "2020-03-22", "club-a", "club-d", 3, 0),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).currentStreak).toMatchObject({
      outcome: "L",
      length: 1,
    });
  });
  it("picks the biggest played win and loss, never the administrative 5-0", () => {
    expect(h2h.biggestWin?.match.id).toBe("w6");
    expect(h2h.biggestLoss?.match.id).toBe("w5");
  });
  it("never picks a shoot-out as the biggest win", () => {
    const index = indexWith([
      game("p", "2020-03-01", "club-a", "club-b", 1, 1, {
        decision: "penalties",
        home_penalties: 5,
        away_penalties: 4,
      }),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).biggestWin).toBeNull();
  });
  it("breaks a tie in margin by goals scored", () => {
    const index = indexWith([
      game("a", "2020-03-01", "club-a", "club-b", 3, 0),
      game("b", "2020-03-08", "club-a", "club-b", 2, 0),
      game("c", "2020-03-15", "club-a", "club-b", 4, 1),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).biggestWin?.match.id).toBe("c");
  });
  it("breaks a tie in margin and goals by the most recent match", () => {
    const index = indexWith([
      game("a", "2020-03-01", "club-a", "club-b", 2, 0),
      game("b", "2020-03-08", "club-b", "club-a", 0, 2),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).biggestWin?.match.id).toBe("b");
  });
  it("keeps an earlier bigger win over a later smaller one", () => {
    const index = indexWith([
      game("a", "2020-03-01", "club-a", "club-b", 5, 0),
      game("b", "2020-03-08", "club-a", "club-b", 1, 0),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).biggestWin?.match.id).toBe("a");
  });
  it("breaks a tie in the biggest loss by the goals of the winning side", () => {
    const index = indexWith([
      game("a", "2020-03-01", "club-a", "club-b", 0, 2),
      game("b", "2020-03-08", "club-a", "club-b", 1, 3),
      game("c", "2020-03-15", "club-a", "club-b", 0, 1),
    ]);
    expect(headToHead(index, "club-a", "club-b", from2020).biggestLoss?.match.id).toBe("b");
  });
  it("has no biggest win or loss when there is no win or no loss", () => {
    const index = indexWith([game("d", "2020-03-01", "club-a", "club-b", 1, 1)]);
    const result = headToHead(index, "club-a", "club-b", from2020);
    expect(result.biggestWin).toBeNull();
    expect(result.biggestLoss).toBeNull();
  });
  it("lists the finals between the two clubs only", () => {
    expect(h2h.finals.map((s) => [s.seasonId, s.winner])).toEqual([
      ["cup-y-2021", "club"],
      ["cup-y-2022", "club"],
    ]);
  });
  it("matches whatIsAtStake of the record", () => {
    expect(h2h.atStake).toEqual(whatIsAtStake(h2h.record));
    expect(h2h.atStake).toMatchObject({ winsToImprove: null, lossesToWorsen: 3 });
    expect(h2h.atStake.nextWinMilestone).toEqual({ milestone: 10, winsNeeded: 4 });
  });
});

describe("head-to-head: which competitions the coverage notice lists", () => {
  const period = fanPeriod("2024-09-01", FIXED_NOW);
  function withCoverage(rows: ReturnType<typeof makeCoverage>[], matches: Match[] = []) {
    const ds = validDataset();
    ds["seasons.json"].push(makeSeason("cup-y-2024", "cup-y", "2024-07-01", "2025-06-30"));
    ds["coverage.json"] = rows;
    ds["matches.json"] = matches;
    return buildStatsIndex(statsDataFrom(ds));
  }
  const statuses = (cov: { competitions: readonly { competitionId: string; status: string }[] }) =>
    cov.competitions.map((c) => [c.competitionId, c.status]);
  it("lists as missing a cup covered for one club only that ended before the period", () => {
    const index = withCoverage([
      makeCoverage("club-a", "league-x", "2020-01-01", null),
      makeCoverage("club-a", "cup-y", "2020-01-01", "2024-08-31"),
    ]);
    const result = headToHead(index, "club-a", "club-b", period);
    expect(statuses(result.coverage)).toEqual([
      ["cup-y", "missing"],
      ["league-x", "complete"],
    ]);
    expect(result.coverage.isComplete).toBe(false);
  });
  it("ignores a competition where neither club has a row or a match, even with a season in the period", () => {
    const ds = validDataset();
    ds["competitions.json"].push(makeCompetition("intl-q", { type: "international" }));
    ds["seasons.json"].push(makeSeason("intl-q-2024", "intl-q", "2024-07-01", "2025-06-30"));
    ds["coverage.json"] = [makeCoverage("club-a", "league-x", "2020-01-01", null)];
    ds["matches.json"] = [];
    const result = headToHead(buildStatsIndex(statsDataFrom(ds)), "club-a", "club-b", period);
    expect(statuses(result.coverage)).toEqual([["league-x", "complete"]]);
    expect(result.coverage.isComplete).toBe(true);
  });
  it("counts a competition where only the rival has rows (any dates)", () => {
    const index = withCoverage([
      makeCoverage("club-a", "league-x", "2020-01-01", null),
      makeCoverage("club-b", "cup-y", "2020-01-01", "2020-12-31"),
    ]);
    const result = headToHead(index, "club-a", "club-b", period);
    expect(statuses(result.coverage)).toEqual([
      ["cup-y", "missing"],
      ["league-x", "complete"],
    ]);
  });
  it("counts a competition where only the rival has a match (any season)", () => {
    const index = withCoverage(
      [makeCoverage("club-a", "league-x", "2020-01-01", null)],
      [makeMatch("old", "cup-y-2020", "2020-05-01", "club-b", "club-c", 1, 0)],
    );
    const result = headToHead(index, "club-a", "club-b", period);
    expect(statuses(result.coverage)).toEqual([
      ["cup-y", "missing"],
      ["league-x", "complete"],
    ]);
    expect(result.coverage.isComplete).toBe(false);
  });
  it("lists as missing a competition the clubs left: rows and matches only before the period", () => {
    const index = withCoverage(
      [
        makeCoverage("club-a", "league-x", "2020-01-01", null),
        makeCoverage("club-a", "cup-y", "2020-01-01", "2020-12-31"),
      ],
      [makeMatch("old", "cup-y-2020", "2020-05-01", "club-a", "club-b", 1, 0)],
    );
    const result = headToHead(index, "club-a", "club-b", period);
    expect(statuses(result.coverage)).toEqual([
      ["cup-y", "missing"],
      ["league-x", "complete"],
    ]);
    expect(result.coverage.isComplete).toBe(false);
  });
  it("lists a competition covered for one club only when it overlaps the period", () => {
    const index = withCoverage([
      makeCoverage("club-a", "league-x", "2020-01-01", null),
      makeCoverage("club-a", "cup-y", "2020-01-01", "2024-12-31", false),
    ]);
    const result = headToHead(index, "club-a", "club-b", period);
    expect(result.coverage.competitions.map((c) => [c.competitionId, c.status])).toEqual([
      ["cup-y", "missing"],
      ["league-x", "complete"],
    ]);
    expect(result.coverage.isComplete).toBe(false);
  });
  it("lists the competitions of the rival's rows too", () => {
    const index = withCoverage([makeCoverage("club-b", "cup-y", "2020-01-01", null)]);
    const result = headToHead(index, "club-a", "club-b", period);
    expect(result.coverage.competitions.map((c) => c.competitionId)).toEqual(["cup-y"]);
    expect(result.coverage.isComplete).toBe(true);
  });
  it("lists nothing for an empty period", () => {
    const index = withCoverage([makeCoverage("club-a", "cup-y", "2020-01-01", null)]);
    const result = headToHead(index, "club-a", "club-b", fanPeriod("2030-01-01", FIXED_NOW));
    expect(result.coverage).toEqual({ isComplete: true, competitions: [] });
  });
});
