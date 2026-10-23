import { describe, expect, it } from "vitest";
import { FIXED_NOW, makeMatch, validDataset } from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { fanPeriod } from "@/domain/period";
import { groupRivals } from "@/domain/rivals";
import type { Match } from "@/data-model/types";

const world = buildStatsIndex(statsDataFrom(statsWorld()));
const from2020 = fanPeriod("2020-01-01", FIXED_NOW);

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

describe("rival grouping (5.3 summary cards)", () => {
  const groups = groupRivals(world, "club-a", from2020);

  it("lists every opponent with a counted match once", () => {
    expect(groups.all.map((r) => r.rivalId)).toEqual(["club-b", "club-c", "club-d"]);
  });
  it("groups by dominance: favorable, even, unfavorable", () => {
    expect(groups.favorable.map((r) => r.rivalId)).toEqual(["club-b"]);
    expect(groups.even.map((r) => r.rivalId)).toEqual(["club-c", "club-d"]);
    expect(groups.unfavorable).toEqual([]);
  });
  it("carries the record and dominance of each rival", () => {
    const b = groups.all[0];
    expect(b.dominance).toBe("dominates");
    expect(b.record).toMatchObject({ played: 9, won: 6, drawn: 1, lost: 2, balance: 4 });
    expect(b.record.suspendedExcluded).toBe(1);
    expect(groups.all[1].record).toMatchObject({ played: 3, won: 1, drawn: 2, balance: 1 });
  });
  it("marks classics from the rivalries table, and not the ones marked is_classic false", () => {
    expect(groups.all.find((r) => r.rivalId === "club-b")?.isClassic).toBe(true);
    expect(groups.all.find((r) => r.rivalId === "club-c")?.isClassic).toBe(false);
    expect(groups.all.find((r) => r.rivalId === "club-d")?.isClassic).toBe(false);
  });
  it("marks a classic when the club is on either side of the rivalry row", () => {
    const rows = groupRivals(world, "club-c", from2020).all;
    expect(rows.find((r) => r.rivalId === "club-d")?.isClassic).toBe(true);
    expect(rows.find((r) => r.rivalId === "club-b")?.isClassic).toBe(false);
  });
  it("sorts by balance desc, then played desc", () => {
    const rows = groupRivals(world, "club-c", from2020).all;
    expect(rows.map((r) => [r.rivalId, r.record.balance, r.record.played])).toEqual([
      ["club-d", 0, 3],
      ["club-a", -1, 3],
      ["club-b", -1, 1],
    ]);
  });
  it("sorts by rival id when balance and played are equal", () => {
    const index = indexWith([
      game("g1", "2020-03-01", "club-a", "club-c", 1, 0),
      game("g2", "2020-03-08", "club-a", "club-b", 1, 0),
    ]);
    const rows = groupRivals(index, "club-a", from2020).all;
    expect(rows.map((r) => r.rivalId)).toEqual(["club-b", "club-c"]);
  });
  it("groups a dominated rival as unfavorable", () => {
    const rows = groupRivals(world, "club-b", from2020);
    expect(rows.unfavorable.map((r) => r.rivalId)).toEqual(["club-a"]);
  });
  it("leaves out a rival with only suspended matches", () => {
    const index = indexWith([
      game("s", "2020-03-01", "club-a", "club-b", null, null, { status: "suspended" }),
      game("p", "2020-03-08", "club-a", "club-c", 1, 0),
    ]);
    const result = groupRivals(index, "club-a", from2020);
    expect(result.all.map((r) => r.rivalId)).toEqual(["club-c"]);
  });
  it("counts the suspended matches of each rival on its own row", () => {
    const index = indexWith([
      game("s", "2020-03-01", "club-a", "club-b", null, null, { status: "suspended" }),
      game("p", "2020-03-08", "club-a", "club-b", 1, 0),
      game("q", "2020-03-15", "club-a", "club-c", 1, 0),
    ]);
    const rows = groupRivals(index, "club-a", from2020).all;
    expect(rows.map((r) => r.record.suspendedExcluded)).toEqual([1, 0]);
  });
  it("filters by competition", () => {
    const cups = groupRivals(world, "club-a", from2020, { competitionIds: ["cup-y"] });
    expect(cups.all.map((r) => [r.rivalId, r.record.played])).toEqual([
      ["club-b", 4],
      ["club-c", 1],
    ]);
    expect(cups.coverage.isComplete).toBe(true);
  });
  it("carries the coverage notice of the club once", () => {
    expect(groups.coverage.isComplete).toBe(false);
    expect(groups.coverage.competitions.map((c) => c.competitionId)).toEqual([
      "cup-y",
      "intl-z",
      "league-x",
    ]);
  });
  it("gives empty groups for a club with no matches", () => {
    const empty = groupRivals(world, "club-nobody", from2020);
    expect(empty.all).toEqual([]);
    expect(empty.favorable).toEqual([]);
    expect(empty.even).toEqual([]);
    expect(empty.unfavorable).toEqual([]);
  });
  it("gives empty groups for a future start", () => {
    expect(groupRivals(world, "club-a", fanPeriod("2030-01-01", FIXED_NOW)).all).toEqual([]);
  });
});

describe("opponents are not rivals (ADR 0022, D-B3)", () => {
  function withOpponent() {
    const ds = validDataset();
    ds["clubs.json"].push({
      id: "opponent-z",
      name: "Opponent Z",
      short_name: "Opponent Z",
      aliases: [],
      selectable: false,
      country: "UY",
      source: "fixture:synthetic",
    });
    ds["matches.json"] = [
      game("o1", "2020-03-01", "club-a", "opponent-z", 3, 0),
      game("o2", "2020-03-08", "club-a", "club-b", 1, 0),
    ];
    return buildStatsIndex(statsDataFrom(ds));
  }

  it("leaves the opponent out of the rivals list and the groups", () => {
    const groups = groupRivals(withOpponent(), "club-a", from2020);
    expect(groups.all.map((r) => r.rivalId)).toEqual(["club-b"]);
    const grouped = [...groups.favorable, ...groups.even, ...groups.unfavorable];
    expect(grouped.map((r) => r.rivalId)).toEqual(["club-b"]);
  });
});
