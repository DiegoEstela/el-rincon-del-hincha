import { describe, expect, it } from "vitest";
import {
  FIXED_NOW,
  makeCompetition,
  makeMatch,
  makeSeason,
  makeTitle,
  validDataset,
} from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { fanPeriod } from "@/domain/period";
import {
  decidingMatch,
  isRecognized,
  pendingTitles,
  titlesInPeriod,
  trophyShelf,
} from "@/domain/titles";
import type { FixtureDataset } from "../../fixtures/data-model/dataset";

const indexOf = (ds: FixtureDataset) => buildStatsIndex(statsDataFrom(ds));
const world = indexOf(statsWorld());
const from2020 = fanPeriod("2020-01-01", FIXED_NOW);

describe("trophyShelf", () => {
  it("puts non-league, non-cup 'other' competitions on the other shelf", () => {
    expect(trophyShelf(makeCompetition("o", { type: "other", scope: "domestic" }))).toBe("other");
    expect(trophyShelf(makeCompetition("o", { type: "other", scope: "international" }))).toBe(
      "other",
    );
  });
  it("puts international scope on the international shelf", () => {
    expect(
      trophyShelf(makeCompetition("i", { type: "international", scope: "international" })),
    ).toBe("international");
    expect(trophyShelf(makeCompetition("l", { type: "league", scope: "international" }))).toBe(
      "international",
    );
  });
  it("puts domestic leagues and cups on the domestic shelf", () => {
    expect(trophyShelf(makeCompetition("l", { type: "league", scope: "domestic" }))).toBe(
      "domestic",
    );
    expect(trophyShelf(makeCompetition("c", { type: "national_cup", scope: "domestic" }))).toBe(
      "domestic",
    );
  });
});

describe("isRecognized", () => {
  it("follows the competition's AFA recognition", () => {
    expect(isRecognized(makeCompetition("a", { afa_recognized: true }))).toBe(true);
    expect(isRecognized(makeCompetition("b", { afa_recognized: false }))).toBe(false);
  });
});

describe("titles in period (a title counts if awarded_on is inside the period)", () => {
  it("counts the recognized titles of club A from 2020, sorted by date then id", () => {
    const titles = titlesInPeriod(world, "club-a", from2020);
    expect(titles.map((t) => t.id)).toEqual(["t2", "t1", "t3", "t5", "t4"]);
  });
  it("counts a title on the start date and not the day before", () => {
    // t2 was awarded on 2020-06-01.
    const on = titlesInPeriod(world, "club-a", fanPeriod("2020-06-01", FIXED_NOW));
    expect(on.map((t) => t.id)).toContain("t2");
    const after = titlesInPeriod(world, "club-a", fanPeriod("2020-06-02", FIXED_NOW));
    expect(after.map((t) => t.id)).not.toContain("t2");
  });
  it("does not count a title after today", () => {
    const early = fanPeriod("2020-01-01", new Date("2020-06-01T02:00:00Z")); // still 2020-05-31
    expect(titlesInPeriod(world, "club-a", early)).toEqual([]);
  });
  it("excludes unrecognized competitions by default", () => {
    expect(titlesInPeriod(world, "club-a", from2020).map((t) => t.id)).not.toContain("t7");
  });
  it("includes them with recognized: false when asked", () => {
    const all = titlesInPeriod(world, "club-a", from2020, { includeUnrecognized: true });
    const t7 = all.find((t) => t.id === "t7");
    expect(t7).toMatchObject({ recognized: false, shelf: "domestic" });
    expect(all.filter((t) => t.id !== "t7").every((t) => t.recognized)).toBe(true);
  });
  it("counts a shared title fully for each co-champion and marks it", () => {
    const a = titlesInPeriod(world, "club-a", from2020).find((t) => t.id === "t5");
    const b = titlesInPeriod(world, "club-b", from2020).find((t) => t.id === "t6");
    expect(a).toMatchObject({ shared: true, season: { id: "league-x-2021" } });
    expect(b).toMatchObject({ shared: true, season: { id: "league-x-2021" } });
  });
  it("carries competition, season, source, shelf and the deciding match", () => {
    const t8 = titlesInPeriod(world, "club-b", from2020).find((t) => t.id === "t8");
    expect(t8).toMatchObject({
      competition: { id: "intl-z" },
      season: { id: "intl-z-2022" },
      source: "fixture:synthetic",
      shelf: "international",
      recognized: true,
      decidingMatch: { id: "w10" },
    });
  });
  it("is empty for a future start", () => {
    expect(titlesInPeriod(world, "club-a", fanPeriod("2030-01-01", FIXED_NOW))).toEqual([]);
  });
  it("ignores titles of other clubs", () => {
    expect(titlesInPeriod(world, "club-c", from2020)).toEqual([]);
  });
});

describe("deciding match of a title", () => {
  it("is the last counted final leg of the club for a cup", () => {
    const cup = world.data.titles.find((t) => t.id === "t3");
    expect(cup && decidingMatch(world, cup)?.id).toBe("w2");
  });
  it("is the last counted match on or before awarded_on for a league", () => {
    const ds = validDataset();
    ds["titles.json"] = [makeTitle("lt", "club-a", "league-x", "league-x-2020", "2020-03-15")];
    const index = indexOf(ds);
    // m1 03-01, m2 03-08, m3 03-15 are on or before; m5 03-29 is after.
    expect(decidingMatch(index, index.data.titles[0])?.id).toBe("m3");
    const dayBefore = { ...index.data.titles[0], awarded_on: "2020-03-14" };
    expect(decidingMatch(index, dayBefore)?.id).toBe("m2");
  });
  it("never returns a suspended match", () => {
    const ds = validDataset();
    ds["titles.json"] = [makeTitle("lt", "club-b", "league-x", "league-x-2020", "2020-03-22")];
    const index = indexOf(ds);
    // m4 (03-22) is suspended, so the last counted match of club-b is m1 (03-01).
    expect(decidingMatch(index, index.data.titles[0])?.id).toBe("m1");
  });
  it("is null when the club has no counted match in the season", () => {
    const ds = validDataset();
    ds["titles.json"] = [makeTitle("lt", "club-c", "cup-y", "cup-y-2020", "2020-07-01")];
    ds["matches.json"] = ds["matches.json"].filter((m) => m.id !== "m6");
    const noCup = indexOf(ds);
    expect(decidingMatch(noCup, noCup.data.titles[0])).toBeNull();
  });
  it("is null for a league title when every match of the season is later than awarded_on", () => {
    const ds = validDataset();
    ds["titles.json"] = [makeTitle("lt", "club-a", "league-x", "league-x-2020", "2020-01-02")];
    const index = indexOf(ds);
    expect(decidingMatch(index, index.data.titles[0])).toBeNull();
  });
  it("ignores non-final matches of the club for a cup", () => {
    const ds = validDataset();
    ds["matches.json"] = [makeMatch("c1", "cup-y-2020", "2020-05-05", "club-a", "club-b", 1, 0)];
    ds["titles.json"] = [makeTitle("ct", "club-a", "cup-y", "cup-y-2020", "2020-06-01")];
    const index = indexOf(ds);
    expect(decidingMatch(index, index.data.titles[0])).toBeNull();
  });
});

describe("pending titles (recognized tournaments played in the period that the club did not win)", () => {
  it("lists the recognized competition with a season in the period and no title", () => {
    const pending = pendingTitles(world, "club-a", from2020);
    expect(pending.map((p) => [p.competition.id, p.shelf, p.seasonsInPeriod])).toEqual([
      ["intl-z", "international", 1],
    ]);
  });
  it("does not list a competition the club won in the period", () => {
    const ids = pendingTitles(world, "club-b", from2020).map((p) => p.competition.id);
    expect(ids).toEqual(["cup-y"]);
  });
  it("counts the seasons of the competition inside the period", () => {
    const [cup] = pendingTitles(world, "club-b", from2020);
    expect(cup.seasonsInPeriod).toBe(3);
  });
  it("does not list a competition whose seasons are all before the period", () => {
    const ids = pendingTitles(world, "club-a", fanPeriod("2023-01-01", FIXED_NOW)).map(
      (p) => p.competition.id,
    );
    expect(ids).toEqual(["league-x"]);
  });
  it("counts a season that straddles the period start as overlapping", () => {
    const [league] = pendingTitles(world, "club-a", fanPeriod("2023-07-01", FIXED_NOW));
    expect(league).toMatchObject({ competition: { id: "league-x" }, seasonsInPeriod: 2 });
  });
  it("does not list unrecognized competitions", () => {
    const ids = pendingTitles(world, "club-c", from2020).map((p) => p.competition.id);
    expect(ids).not.toContain("league-old");
  });
  it("sorts by shelf, then competition id", () => {
    const ids = pendingTitles(world, "club-c", from2020).map((p) => p.competition.id);
    expect(ids).toEqual(["cup-y", "league-x", "intl-z"]);
  });
  it("a title the day before the start does not count as won in the period, later ones do", () => {
    const ids = pendingTitles(world, "club-a", fanPeriod("2020-06-02", FIXED_NOW)).map(
      (p) => p.competition.id,
    );
    expect(ids).not.toContain("cup-y"); // t3 and t4 are inside the period
    const ds = statsWorld();
    ds["titles.json"] = ds["titles.json"].filter((t) => t.id !== "t3" && t.id !== "t4");
    const only = pendingTitles(indexOf(ds), "club-a", fanPeriod("2020-06-02", FIXED_NOW));
    expect(only.map((p) => p.competition.id)).toContain("cup-y");
  });
  it("is empty for a future start", () => {
    expect(pendingTitles(world, "club-a", fanPeriod("2030-01-01", FIXED_NOW))).toEqual([]);
  });
  it("lists the other shelf last for a recognized 'other' competition", () => {
    const ds = statsWorld();
    ds["competitions.json"].push(makeCompetition("other-q", { type: "other" }));
    ds["seasons.json"].push(makeSeason("other-q-2021", "other-q", "2021-01-01", "2021-12-31"));
    const ids = pendingTitles(indexOf(ds), "club-c", from2020).map((p) => p.competition.id);
    expect(ids).toEqual(["cup-y", "league-x", "intl-z", "other-q"]);
  });
});

describe("title ordering", () => {
  it("breaks a tie on awarded_on by title id", () => {
    const ds = statsWorld();
    ds["titles.json"].push(
      makeTitle("t-b", "club-c", "cup-y", "cup-y-2021", "2021-11-08"),
      makeTitle("t-a", "club-c", "league-x", "league-x-2022", "2021-11-08"),
    );
    const ids = titlesInPeriod(indexOf(ds), "club-c", from2020, { includeUnrecognized: true }).map(
      (t) => t.id,
    );
    expect(ids).toEqual(["t-a", "t-b"]);
  });
});
