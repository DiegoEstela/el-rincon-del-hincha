import { describe, expect, it } from "vitest";
import { makeCoverage, validDataset } from "../../../fixtures/data-model/dataset";
import { issuesFor, where } from "../../../fixtures/data-model/run";

describe("missing-coverage", () => {
  it("passes when every club and competition pair has a row", () => {
    expect(where(validDataset(), "missing-coverage")).toEqual([]);
  });

  it("fails for a pair without a row, naming the generator command", () => {
    const ds = validDataset();
    ds["coverage.json"] = ds["coverage.json"].filter(
      (c) => !(c.club_id === "club-b" && c.competition_id === "cup-y"),
    );
    expect(where(ds, "missing-coverage")).toEqual(["coverage.json#club-b/cup-y"]);
    expect(issuesFor(ds, undefined, "missing-coverage")[0].message).toContain("pnpm data:coverage");
  });

  it("lists every missing pair, one issue each", () => {
    const ds = validDataset();
    ds["coverage.json"] = [];
    expect(where(ds, "missing-coverage")).toHaveLength(8);
  });

  it("accepts an incomplete row as coverage for the pair", () => {
    const ds = validDataset();
    ds["coverage.json"] = ds["coverage.json"].map((c) => ({ ...c, complete: false }));
    expect(where(ds, "missing-coverage")).toEqual([]);
  });

  it("does not count a row of another club or another competition", () => {
    const ds = validDataset();
    ds["coverage.json"] = [makeCoverage("club-a", "league-x", "2020-01-01", null)];
    expect(where(ds, "missing-coverage")).toHaveLength(7);
  });

  it("raises nothing without clubs or without competitions", () => {
    const noClubs = validDataset();
    noClubs["clubs.json"] = [];
    noClubs["coverage.json"] = [];
    expect(where(noClubs, "missing-coverage")).toEqual([]);
    const noCompetitions = validDataset();
    noCompetitions["competitions.json"] = [];
    noCompetitions["coverage.json"] = [];
    expect(where(noCompetitions, "missing-coverage")).toEqual([]);
  });
});

describe("coverage-overlap", () => {
  it("passes for the baseline", () => {
    expect(where(validDataset(), "coverage-overlap")).toEqual([]);
  });

  it("fails when two rows of one pair share a day", () => {
    const ds = validDataset();
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2020-01-01", "2020-06-30"),
      makeCoverage("club-a", "league-x", "2020-06-30", "2020-12-31", false),
    ];
    expect(where(ds, "coverage-overlap")).toEqual(["coverage.json#club-a/league-x/2020-06-30"]);
  });

  it("fails when an open-ended row is followed by another row", () => {
    const ds = validDataset();
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2020-01-01", null),
      makeCoverage("club-a", "league-x", "2025-01-01", null, false),
    ];
    expect(where(ds, "coverage-overlap")).toEqual(["coverage.json#club-a/league-x/2025-01-01"]);
  });

  it("passes for adjacent rows and rows with a gap between them", () => {
    const ds = validDataset();
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2020-01-01", "2020-06-30"),
      makeCoverage("club-a", "league-x", "2020-07-01", "2020-12-31", false),
      makeCoverage("club-a", "league-x", "2022-01-01", null),
    ];
    expect(where(ds, "coverage-overlap")).toEqual([]);
  });

  it("ignores rows of different pairs and does not depend on the order of the file", () => {
    const ds = validDataset();
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2021-01-01", null),
      makeCoverage("club-a", "cup-y", "2020-01-01", null),
      makeCoverage("club-b", "league-x", "2020-01-01", null),
      makeCoverage("club-a", "league-x", "2020-01-01", "2020-12-31"),
    ];
    expect(where(ds, "coverage-overlap")).toEqual([]);
  });
});

describe("coverage-overclaim", () => {
  it("passes for the baseline", () => {
    expect(where(validDataset(), "coverage-overclaim")).toEqual([]);
  });

  it("fails when a complete row reaches a season of its competition that has no match", () => {
    const ds = validDataset();
    ds["seasons.json"].push({
      id: "league-x-2022",
      competition_id: "league-x",
      name: "2022",
      start: "2022-01-01",
      end: "2022-12-31",
      source: "fixture:synthetic",
    });
    expect(where(ds, "coverage-overclaim")).toEqual(["coverage.json#club-a/league-x/2020-01-01"]);
    expect(issuesFor(ds, undefined, "coverage-overclaim")[0].message).toContain("league-x-2022");
  });

  it("does not fail for an incomplete row", () => {
    const ds = validDataset();
    ds["seasons.json"].push({
      id: "league-x-2022",
      competition_id: "league-x",
      name: "2022",
      start: "2022-01-01",
      end: "2022-12-31",
      source: "fixture:synthetic",
    });
    ds["coverage.json"] = ds["coverage.json"].map((c) => ({ ...c, complete: false }));
    expect(where(ds, "coverage-overclaim")).toEqual([]);
  });

  it("ignores empty seasons of another competition and seasons outside the row", () => {
    const ds = validDataset();
    ds["seasons.json"].push({
      id: "cup-y-1999",
      competition_id: "cup-y",
      name: "1999",
      start: "1999-01-01",
      end: "1999-12-31",
      source: "fixture:synthetic",
    });
    ds["coverage.json"] = [
      makeCoverage("club-a", "league-x", "2020-01-01", "2021-12-31"),
      makeCoverage("club-a", "cup-y", "2020-01-01", "2020-12-31"),
    ];
    expect(where(ds, "coverage-overclaim")).toEqual([]);
  });

  it("fails when a closed complete row only touches the empty season on its last day", () => {
    const ds = validDataset();
    ds["seasons.json"].push({
      id: "league-x-2022",
      competition_id: "league-x",
      name: "2022",
      start: "2022-01-01",
      end: "2022-12-31",
      source: "fixture:synthetic",
    });
    ds["coverage.json"] = [makeCoverage("club-a", "league-x", "2020-01-01", "2022-01-01")];
    expect(where(ds, "coverage-overclaim")).toEqual(["coverage.json#club-a/league-x/2020-01-01"]);
  });
});
