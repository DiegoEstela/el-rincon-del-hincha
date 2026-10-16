import { describe, expect, it } from "vitest";
import {
  FIXED_NOW,
  makeCompetition,
  makeMatch,
  makeSeason,
} from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { finalSeries, seriesWinner } from "@/domain/finals";
import { clubView } from "@/domain/match-outcome";
import { fanPeriod } from "@/domain/period";
import type { FixtureDataset } from "../../fixtures/data-model/dataset";
import type { Match } from "@/data-model/types";

const period = fanPeriod("2020-01-01", FIXED_NOW);
const indexOf = (ds: FixtureDataset) => buildStatsIndex(statsDataFrom(ds));
const world = indexOf(statsWorld());

const leg = (
  id: string,
  seasonId: string,
  date: string,
  home: string,
  away: string,
  hg: number | null,
  ag: number | null,
  extra: Partial<Match> = {},
) =>
  makeMatch(id, seasonId, date, home, away, hg, ag, { stage: "Final", is_final: true, ...extra });

describe("final series: the winner of a final", () => {
  it("is the shoot-out winner of a single-leg final, even though it is a draw in P/W/D/L", () => {
    const series = finalSeries(world, "club-a", period).find((s) => s.seasonId === "cup-y-2020");
    expect(series).toMatchObject({ rivalId: "club-c", winner: "club" });
    expect(series?.legs[0].outcome).toBe("D");
  });
  it("is decided on aggregate in a two-leg final", () => {
    const series = finalSeries(world, "club-a", period).find((s) => s.seasonId === "cup-y-2021");
    expect(series?.legs).toHaveLength(2);
    expect(series?.winner).toBe("club");
  });
  it("is the shoot-out winner when the second leg goes to penalties", () => {
    const series = finalSeries(world, "club-a", period).find((s) => s.seasonId === "cup-y-2022");
    expect(series).toMatchObject({ winner: "club" });
  });
  it("mirrors the result from the other club", () => {
    const winners = finalSeries(world, "club-b", period).map((s) => s.winner);
    expect(winners).toEqual(["rival", "rival", "club"]);
  });
  it("is null when the aggregate is tied without a shoot-out", () => {
    const ds = statsWorld();
    ds["seasons.json"].push(makeSeason("cup-y-2023", "cup-y", "2023-01-01", "2023-12-31"));
    ds["matches.json"].push(
      leg("t1", "cup-y-2023", "2023-11-01", "club-a", "club-b", 1, 0),
      leg("t2", "cup-y-2023", "2023-11-08", "club-b", "club-a", 1, 0),
    );
    const series = finalSeries(indexOf(ds), "club-a", period).find(
      (s) => s.seasonId === "cup-y-2023",
    );
    expect(series?.winner).toBeNull();
  });
  it("seriesWinner gives the rival when the club loses the shoot-out or the aggregate", () => {
    const asView = (match: Match) => {
      const view = clubView(match, "club-a", "cup-y");
      if (view === null) throw new Error("does not count");
      return view;
    };
    const lostPens = asView(
      leg("p", "cup-y-2020", "2020-06-01", "club-a", "club-b", 0, 0, {
        decision: "penalties",
        home_penalties: 2,
        away_penalties: 4,
      }),
    );
    const lostAggregate = asView(leg("g", "cup-y-2020", "2020-06-01", "club-a", "club-b", 0, 1));
    expect(seriesWinner([lostPens])).toBe("rival");
    expect(seriesWinner([lostAggregate])).toBe("rival");
  });
});

describe("final series: which finals belong to the period and the filters", () => {
  it("ignores a suspended leg", () => {
    const ds = statsWorld();
    ds["seasons.json"].push(makeSeason("cup-y-2024", "cup-y", "2024-01-01", "2024-12-31"));
    ds["matches.json"].push(
      leg("u1", "cup-y-2024", "2024-11-01", "club-a", "club-b", 2, 0),
      leg("u2", "cup-y-2024", "2024-11-08", "club-b", "club-a", null, null, {
        status: "suspended",
      }),
    );
    const series = finalSeries(indexOf(ds), "club-a", period).find(
      (s) => s.seasonId === "cup-y-2024",
    );
    expect(series?.legs).toHaveLength(1);
    expect(series?.winner).toBe("club");
  });
  it("belongs to the period of its last leg when it straddles the period start", () => {
    // cup-y-2021: first leg 2021-11-01, second leg 2021-11-08.
    const inside = finalSeries(world, "club-a", fanPeriod("2021-11-05", FIXED_NOW));
    expect(inside.find((s) => s.seasonId === "cup-y-2021")).toMatchObject({ winner: "club" });
    expect(inside.find((s) => s.seasonId === "cup-y-2021")?.legs).toHaveLength(2);
    const outside = finalSeries(world, "club-a", fanPeriod("2021-11-09", FIXED_NOW));
    expect(outside.find((s) => s.seasonId === "cup-y-2021")).toBeUndefined();
  });
  it("ignores matches that are not finals", () => {
    const ids = finalSeries(world, "club-a", period).map((s) => s.seasonId);
    expect(ids).toEqual(["cup-y-2020", "cup-y-2021", "cup-y-2022"]);
  });
  it("lists only finals of recognized competitions by default", () => {
    const ds = statsWorld();
    ds["competitions.json"].push(
      makeCompetition("cup-u", { type: "national_cup", afa_recognized: false }),
    );
    ds["seasons.json"].push(makeSeason("cup-u-2021", "cup-u", "2021-01-01", "2021-12-31"));
    ds["matches.json"].push(leg("x1", "cup-u-2021", "2021-05-01", "club-a", "club-b", 2, 0));
    const index = indexOf(ds);
    expect(finalSeries(index, "club-a", period).map((s) => s.seasonId)).not.toContain("cup-u-2021");
    const all = finalSeries(index, "club-a", period, { includeUnrecognized: true });
    expect(all.map((s) => s.seasonId)).toContain("cup-u-2021");
  });
  it("can be limited to the finals against one rival", () => {
    const ids = finalSeries(world, "club-a", period, { rivalId: "club-b" }).map((s) => s.seasonId);
    expect(ids).toEqual(["cup-y-2021", "cup-y-2022"]);
  });
  it("can be limited by competition id or type", () => {
    expect(
      finalSeries(world, "club-b", period, { competitionTypes: ["international"] }),
    ).toHaveLength(1);
    expect(finalSeries(world, "club-b", period, { competitionIds: ["cup-y"] })).toHaveLength(2);
  });
  it("is empty for a future start", () => {
    expect(finalSeries(world, "club-a", fanPeriod("2030-01-01", FIXED_NOW))).toEqual([]);
  });
  it("is sorted by the date of the last leg, then by season", () => {
    const dates = finalSeries(world, "club-a", period).map(
      (s) => s.legs[s.legs.length - 1].match.date,
    );
    expect(dates).toEqual([...dates].sort());
  });
});

describe("final series ordering", () => {
  it("breaks a tie on the last leg date by season id", () => {
    const ds = statsWorld();
    ds["competitions.json"].push(makeCompetition("cup-z", { type: "national_cup" }));
    ds["seasons.json"].push(
      makeSeason("cup-z-2023", "cup-z", "2023-01-01", "2023-12-31"),
      makeSeason("cup-y-2023", "cup-y", "2023-01-01", "2023-12-31"),
    );
    ds["matches.json"].push(
      leg("z1", "cup-z-2023", "2023-11-01", "club-a", "club-c", 1, 0),
      leg("y1", "cup-y-2023", "2023-11-01", "club-a", "club-b", 1, 0),
    );
    const ids = finalSeries(indexOf(ds), "club-a", fanPeriod("2023-01-01", FIXED_NOW)).map(
      (s) => s.seasonId,
    );
    expect(ids).toEqual(["cup-y-2023", "cup-z-2023"]);
  });
});
