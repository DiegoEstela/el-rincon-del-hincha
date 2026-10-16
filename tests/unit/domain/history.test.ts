import { describe, expect, it } from "vitest";
import { FIXED_NOW, makeCoverage, makeMatch, validDataset } from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { calculateHistory, tallyMatches } from "@/domain/history";
import { clubView } from "@/domain/match-outcome";
import { fanPeriod } from "@/domain/period";
import type { Match } from "@/data-model/types";
import type { MatchView } from "@/domain/types";

const view = (over: Partial<Match>, clubId = "club-a"): MatchView => {
  const match = makeMatch("v", "league-x-2020", "2020-03-01", "club-a", "club-b", 1, 0, over);
  const result = clubView(match, clubId, "league-x");
  if (result === null) throw new Error("fixture match does not count");
  return result;
};

describe("tallyMatches (match result, balance, shoot-outs, administrative results)", () => {
  it("is all zeros for an empty list", () => {
    expect(tallyMatches([], 0)).toEqual({
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      balance: 0,
      shootouts: { played: 0, won: 0, lost: 0 },
      administrative: { count: 0, matchIds: [] },
      suspendedExcluded: 0,
    });
  });
  it("counts wins, draws and losses with goals for and against", () => {
    const record = tallyMatches(
      [
        view({ id: "w", home_goals: 3, away_goals: 1 }),
        view({ id: "d", home_goals: 2, away_goals: 2 }),
        view({ id: "l", home_goals: 0, away_goals: 1 }),
      ],
      0,
    );
    expect(record).toMatchObject({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 5,
      goalsAgainst: 4,
    });
  });
  it("counts extra time goals but never shoot-out goals", () => {
    const record = tallyMatches(
      [
        view({ decision: "extra_time", home_goals: 3, away_goals: 2 }),
        view({
          decision: "penalties",
          home_goals: 1,
          away_goals: 1,
          home_penalties: 5,
          away_penalties: 4,
        }),
      ],
      0,
    );
    expect(record.goalsFor).toBe(4);
    expect(record.goalsAgainst).toBe(3);
  });
  it("counts a shoot-out as a draw and records it apart, for the right side", () => {
    const won = view({
      decision: "penalties",
      home_goals: 1,
      away_goals: 1,
      home_penalties: 4,
      away_penalties: 3,
    });
    const lost = view({
      decision: "penalties",
      home_goals: 0,
      away_goals: 0,
      home_penalties: 2,
      away_penalties: 3,
    });
    const record = tallyMatches([won, lost], 0);
    expect(record).toMatchObject({ played: 2, won: 0, drawn: 2, lost: 0 });
    expect(record.shootouts).toEqual({ played: 2, won: 1, lost: 1 });
  });
  it("counts administrative results in P/W/D/L and lists them", () => {
    const record = tallyMatches(
      [view({ id: "adm", status: "administrative_result", home_goals: 3, away_goals: 0 })],
      0,
    );
    expect(record).toMatchObject({ played: 1, won: 1 });
    expect(record.administrative).toEqual({ count: 1, matchIds: ["adm"] });
  });
  it("defines balance as wins minus losses; draws do not change it", () => {
    const record = tallyMatches(
      [
        view({ home_goals: 1, away_goals: 0 }),
        view({ home_goals: 1, away_goals: 0 }),
        view({ home_goals: 0, away_goals: 1 }),
        view({ home_goals: 1, away_goals: 1 }),
        view({ home_goals: 1, away_goals: 1 }),
      ],
      0,
    );
    expect(record.balance).toBe(1);
  });
  it("carries the number of suspended matches that were excluded", () => {
    expect(tallyMatches([], 3).suspendedExcluded).toBe(3);
  });
});

describe("calculateHistory on the synthetic world, club A from 2020-01-01", () => {
  const index = buildStatsIndex(statsDataFrom(statsWorld()));
  const period = fanPeriod("2020-01-01", FIXED_NOW);
  const history = calculateHistory(index, "club-a", period);

  it("returns the period rules' P/W/D/L, goals and balance", () => {
    expect(history.record).toMatchObject({
      played: 14,
      won: 8,
      drawn: 3,
      lost: 3,
      goalsFor: 23,
      goalsAgainst: 9,
      balance: 5,
    });
  });
  it("records shoot-outs apart, flags administrative results and counts suspended ones", () => {
    expect(history.record.shootouts).toEqual({ played: 2, won: 2, lost: 0 });
    expect(history.record.administrative).toEqual({ count: 2, matchIds: ["m5", "w8"] });
    expect(history.record.suspendedExcluded).toBe(1);
  });
  it("returns the counted matches sorted by date then id", () => {
    const keys = history.matches.map((v) => `${v.match.date} ${v.match.id}`);
    expect(keys).toEqual([...keys].sort());
    expect(history.matches).toHaveLength(14);
  });
  it("never lists a suspended match", () => {
    expect(history.matches.map((v) => v.match.id)).not.toContain("w7");
  });
  it("reports missing coverage for a competition with matches but no coverage rows", () => {
    expect(history.coverage.isComplete).toBe(false);
    expect(history.coverage.competitions.find((c) => c.competitionId === "intl-z")?.status).toBe(
      "missing",
    );
  });
});

describe("calculateHistory: period bounds", () => {
  const index = buildStatsIndex(statsDataFrom(statsWorld()));
  it("includes a match on the start date", () => {
    const r = calculateHistory(index, "club-a", fanPeriod("2020-03-01", FIXED_NOW)).record;
    expect(r.played).toBe(14);
  });
  it("excludes a match the day before the start", () => {
    const r = calculateHistory(index, "club-a", fanPeriod("2020-03-02", FIXED_NOW)).record;
    expect(r.played).toBe(13);
  });
  it("excludes matches after today in Buenos Aires", () => {
    const early = new Date("2020-03-08T02:00:00Z"); // still 2020-03-07 in Buenos Aires
    expect(calculateHistory(index, "club-a", fanPeriod("2020-01-01", early)).record.played).toBe(1);
    const later = new Date("2020-03-08T03:00:00Z"); // 2020-03-08: the draw on that day counts
    expect(calculateHistory(index, "club-a", fanPeriod("2020-01-01", later)).record.played).toBe(2);
  });
  it("is empty for a future start", () => {
    const history = calculateHistory(index, "club-a", fanPeriod("2030-01-01", FIXED_NOW));
    expect(history.record.played).toBe(0);
    expect(history.record.suspendedExcluded).toBe(0);
    expect(history.matches).toEqual([]);
    expect(history.coverage).toEqual({ isComplete: true, competitions: [] });
  });
  it("gives the same numbers for a start before any data, plus a partial notice", () => {
    const early = calculateHistory(index, "club-a", fanPeriod("2019-06-01", FIXED_NOW));
    const first = calculateHistory(index, "club-a", fanPeriod("2020-01-01", FIXED_NOW));
    expect(early.record).toEqual(first.record);
    expect(early.coverage.isComplete).toBe(false);
    expect(early.coverage.competitions.find((c) => c.competitionId === "league-x")).toEqual({
      competitionId: "league-x",
      status: "partial",
      completeFrom: "2020-01-01",
      completeTo: null,
    });
  });
});

describe("calculateHistory: match filter", () => {
  const index = buildStatsIndex(statsDataFrom(statsWorld()));
  const period = fanPeriod("2020-01-01", FIXED_NOW);
  it("filters by competition id", () => {
    const { record, coverage } = calculateHistory(index, "club-a", period, {
      competitionIds: ["cup-y"],
    });
    expect(record).toMatchObject({ played: 5, won: 2, drawn: 2, lost: 1 });
    expect(coverage).toEqual({
      isComplete: true,
      competitions: [
        {
          competitionId: "cup-y",
          status: "complete",
          completeFrom: "2020-01-01",
          completeTo: null,
        },
      ],
    });
  });
  it("filters by competition type", () => {
    const { record } = calculateHistory(index, "club-a", period, {
      competitionTypes: ["international"],
    });
    expect(record).toMatchObject({ played: 1, won: 1 });
  });
  it("combines both filters", () => {
    const { record } = calculateHistory(index, "club-a", period, {
      competitionIds: ["cup-y", "intl-z"],
      competitionTypes: ["international"],
    });
    expect(record.played).toBe(1);
  });
  it("counts suspended matches only inside the filter", () => {
    const cupOnly = calculateHistory(index, "club-a", period, { competitionIds: ["cup-y"] });
    expect(cupOnly.record.suspendedExcluded).toBe(0);
    const leagueOnly = calculateHistory(index, "club-a", period, { competitionIds: ["league-x"] });
    expect(leagueOnly.record.suspendedExcluded).toBe(1);
  });
});

describe("calculateHistory: edge cases", () => {
  it("gives zeros and an incomplete notice for a club with no matches", () => {
    const index = buildStatsIndex(statsDataFrom(statsWorld()));
    const history = calculateHistory(index, "club-nobody", fanPeriod("2020-01-01", FIXED_NOW));
    expect(history.record.played).toBe(0);
    expect(history.matches).toEqual([]);
    expect(history.coverage).toEqual({ isComplete: false, competitions: [] });
  });
  it("ignores a played match that has no score (invalid data is never counted)", () => {
    const ds = validDataset();
    ds["matches.json"].push(
      makeMatch("broken", "league-x-2020", "2020-04-01", "club-a", "club-b", null, null),
    );
    const withBroken = calculateHistory(
      buildStatsIndex(statsDataFrom(ds)),
      "club-a",
      fanPeriod("2020-01-01", FIXED_NOW),
    );
    const base = calculateHistory(
      buildStatsIndex(statsDataFrom(validDataset())),
      "club-a",
      fanPeriod("2020-01-01", FIXED_NOW),
    );
    expect(withBroken.record).toEqual(base.record);
  });
  it("does not mutate the index", () => {
    const index = buildStatsIndex(statsDataFrom(statsWorld()));
    const before = JSON.stringify([...index.matchesByClub.entries()]);
    calculateHistory(index, "club-a", fanPeriod("2020-01-01", FIXED_NOW));
    expect(JSON.stringify([...index.matchesByClub.entries()])).toBe(before);
  });
});

describe("calculateHistory: which competitions the coverage notice lists", () => {
  it("ignores a competition whose coverage ended before the fan period and has no matches", () => {
    const ds = validDataset();
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2020-01-01", null),
      makeCoverage("club-a", "cup-y", "2015-01-01", "2019-12-31"),
    ];
    ds["matches.json"] = [
      makeMatch("only", "league-x-2020", "2024-10-01", "club-a", "club-b", 1, 0),
    ];
    const index = buildStatsIndex(statsDataFrom(ds));
    const { coverage } = calculateHistory(index, "club-a", fanPeriod("2024-09-01", FIXED_NOW));
    expect(coverage.competitions.map((c) => c.competitionId)).toEqual(["league-x"]);
    expect(coverage.isComplete).toBe(true);
  });
  it("lists a competition covered by a row that overlaps the period even without matches", () => {
    const ds = validDataset();
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2020-01-01", null),
      makeCoverage("club-a", "cup-y", "2015-01-01", "2024-09-30", false),
    ];
    ds["matches.json"] = [];
    const index = buildStatsIndex(statsDataFrom(ds));
    const { coverage } = calculateHistory(index, "club-a", fanPeriod("2024-09-01", FIXED_NOW));
    expect(coverage.competitions.map((c) => c.competitionId)).toEqual(["cup-y", "league-x"]);
    expect(coverage.isComplete).toBe(false);
  });
  it("lists nothing for an empty period", () => {
    const index = buildStatsIndex(statsDataFrom(validDataset()));
    const { coverage } = calculateHistory(index, "club-a", fanPeriod("2030-01-01", FIXED_NOW));
    expect(coverage).toEqual({ isComplete: true, competitions: [] });
  });
});
