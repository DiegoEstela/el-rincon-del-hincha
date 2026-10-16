import { describe, expect, it } from "vitest";
import { where } from "../../../fixtures/data-model/run";
import { validDataset } from "../../../fixtures/data-model/dataset";

describe("future-played-match", () => {
  const now = new Date("2026-10-16T15:00:00Z");

  it("fails for a played match dated tomorrow in Buenos Aires", () => {
    const ds = validDataset();
    ds["matches.json"][0].date = "2026-10-17";
    ds["seasons.json"][0].end = "2026-12-31";
    expect(where(ds, "future-played-match", now)).toEqual(["matches.json#m1"]);
  });
  it("fails for an administrative result in the future", () => {
    const ds = validDataset();
    ds["matches.json"][4].date = "2026-10-17";
    ds["seasons.json"][0].end = "2026-12-31";
    expect(where(ds, "future-played-match", now)).toEqual(["matches.json#m5"]);
  });
  it("passes for a match dated today", () => {
    const ds = validDataset();
    ds["matches.json"][0].date = "2026-10-16";
    ds["seasons.json"][0].end = "2026-12-31";
    expect(where(ds, "future-played-match", now)).toEqual([]);
  });
  it("passes for a future suspended match", () => {
    const ds = validDataset();
    ds["matches.json"][3].date = "2026-10-17";
    ds["seasons.json"][0].end = "2026-12-31";
    expect(where(ds, "future-played-match", now)).toEqual([]);
  });
  it("uses the Buenos Aires day when UTC already says tomorrow", () => {
    const ds = validDataset();
    ds["matches.json"][0].date = "2026-10-16";
    ds["seasons.json"][0].end = "2026-12-31";
    // 02:30Z on the 16th is still the 15th in Buenos Aires: the 16th is the future.
    expect(where(ds, "future-played-match", new Date("2026-10-16T02:30:00Z"))).toEqual([
      "matches.json#m1",
    ]);
  });
});

describe("date-outside-season", () => {
  it("fails one day before the start and one day after the end", () => {
    const ds = validDataset();
    ds["matches.json"][0].date = "2019-12-31";
    ds["matches.json"][1].date = "2021-01-01";
    expect(where(ds, "date-outside-season")).toEqual(["matches.json#m1", "matches.json#m2"]);
  });
  it("passes on the first and last day of the season", () => {
    const ds = validDataset();
    ds["matches.json"][0].date = "2020-01-01";
    ds["matches.json"][1].date = "2020-12-31";
    expect(where(ds, "date-outside-season")).toEqual([]);
  });
  it("skips matches whose season is unknown", () => {
    const ds = validDataset();
    ds["matches.json"][0].season_id = "nope";
    expect(where(ds, "date-outside-season")).toEqual([]);
  });
});

describe("invalid-season-range", () => {
  it("fails when a season starts after it ends", () => {
    const ds = validDataset();
    ds["seasons.json"][0].start = "2021-01-01";
    expect(where(ds, "invalid-season-range")).toEqual(["seasons.json#league-x-2020"]);
  });
  it("fails when coverage starts after it ends", () => {
    const ds = validDataset();
    ds["coverage.json"][0].to = "2019-12-31";
    expect(where(ds, "invalid-season-range")).toEqual(["coverage.json#club-a/league-x/2020-01-01"]);
  });
  it("passes for equal bounds, ongoing coverage and the valid dataset", () => {
    const ds = validDataset();
    ds["seasons.json"][0].end = ds["seasons.json"][0].start;
    ds["matches.json"] = [];
    ds["titles.json"] = [];
    ds["standings.json"] = [];
    expect(where(ds, "invalid-season-range")).toEqual([]);
  });
});
