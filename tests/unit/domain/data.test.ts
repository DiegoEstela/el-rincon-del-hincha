import { describe, expect, it } from "vitest";
import { validDataset, makeMatch } from "../../fixtures/data-model/dataset";
import {
  buildStatsIndex,
  competitionOf,
  matchesOf,
  seasonById,
  statsDataFrom,
} from "@/domain/data";

describe("statsDataFrom", () => {
  it("maps each dataset file to its field and leaves the file names out", () => {
    const ds = validDataset();
    const data = statsDataFrom(ds);
    expect(data.clubs).toBe(ds["clubs.json"]);
    expect(data.competitions).toBe(ds["competitions.json"]);
    expect(data.seasons).toBe(ds["seasons.json"]);
    expect(data.matches).toBe(ds["matches.json"]);
    expect(data.titles).toBe(ds["titles.json"]);
    expect(data.movements).toBe(ds["movements.json"]);
    expect(data.rivalries).toBe(ds["rivalries.json"]);
    expect(data.coverage).toBe(ds["coverage.json"]);
    expect(Object.keys(data)).not.toContain("standings");
  });
});

describe("buildStatsIndex", () => {
  const ds = validDataset();
  ds["matches.json"].push(
    makeMatch("a-late", "league-x-2020", "2020-03-01", "club-a", "club-c", 1, 0),
    makeMatch("a-early", "cup-y-2020", "2020-03-01", "club-d", "club-a", 1, 0),
  );
  const index = buildStatsIndex(statsDataFrom(ds));

  it("indexes seasons and competitions by id", () => {
    expect(index.seasonById.get("league-x-2020")?.competition_id).toBe("league-x");
    expect(index.competitionById.get("cup-y")?.type).toBe("national_cup");
  });
  it("lists the matches of a club as home or away, suspended ones included", () => {
    const ids = (index.matchesByClub.get("club-b") ?? []).map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m4");
    expect(ids).toContain("m8");
  });
  it("sorts each club's matches by date, then id", () => {
    const sameDay = (index.matchesByClub.get("club-a") ?? [])
      .filter((m) => m.date === "2020-03-01")
      .map((m) => m.id);
    expect(sameDay).toEqual(["a-early", "a-late", "m1"]);
    const dates = (index.matchesByClub.get("club-a") ?? []).map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
  });
  it("leaves a club without matches out of the map", () => {
    const empty = validDataset();
    empty["clubs.json"].push({ ...empty["clubs.json"][0], id: "club-lonely" });
    expect(buildStatsIndex(statsDataFrom(empty)).matchesByClub.has("club-lonely")).toBe(false);
  });
  it("does not mutate the input arrays", () => {
    const before = ds["matches.json"].map((m) => m.id);
    buildStatsIndex(statsDataFrom(ds));
    expect(ds["matches.json"].map((m) => m.id)).toEqual(before);
  });
});

describe("competitionOf", () => {
  const index = buildStatsIndex(statsDataFrom(validDataset()));
  it("resolves the competition through the season", () => {
    expect(
      competitionOf(index, makeMatch("x", "cup-y-2020", "2020-06-01", "club-a", "club-b", 1, 0)),
    ).toMatchObject({
      id: "cup-y",
    });
  });
  it("throws on an unknown season", () => {
    expect(() =>
      competitionOf(index, makeMatch("x", "nope", "2020-06-01", "club-a", "club-b", 1, 0)),
    ).toThrow(/season/);
  });
  it("throws when the season points to an unknown competition", () => {
    const ds = validDataset();
    ds["seasons.json"][0] = { ...ds["seasons.json"][0], competition_id: "ghost" };
    const broken = buildStatsIndex(statsDataFrom(ds));
    expect(() =>
      competitionOf(
        broken,
        makeMatch("x", "league-x-2020", "2020-06-01", "club-a", "club-b", 1, 0),
      ),
    ).toThrow(/competition/);
  });
});

describe("seasonById and matchesOf", () => {
  const index = buildStatsIndex(statsDataFrom(validDataset()));
  it("finds a season and throws on an unknown one", () => {
    expect(seasonById(index, "league-x-2020").competition_id).toBe("league-x");
    expect(() => seasonById(index, "nope")).toThrow(/season/);
  });
  it("lists the matches of a club, or nothing for a club without matches", () => {
    expect(matchesOf(index, "club-a").length).toBeGreaterThan(0);
    expect(matchesOf(index, "club-nobody")).toEqual([]);
  });
});
