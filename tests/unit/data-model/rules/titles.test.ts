import { describe, expect, it } from "vitest";
import { where } from "../../../fixtures/data-model/run";
import { validDataset, type FixtureDataset } from "../../../fixtures/data-model/dataset";

function withoutMatches(ds: FixtureDataset, keep: string[]): FixtureDataset {
  ds["matches.json"] = ds["matches.json"].filter(
    (m) => m.season_id !== "league-x-2020" || keep.includes(m.id),
  );
  return ds;
}

describe("unshared-co-champions", () => {
  const second = (ds: FixtureDataset, shared: boolean) =>
    ds["titles.json"].push({
      ...ds["titles.json"][0],
      id: "t3",
      club_id: "club-b",
      shared,
    });

  it("fails on the unshared title when a season has two titles", () => {
    const ds = validDataset();
    second(ds, true);
    expect(where(ds, "unshared-co-champions")).toEqual(["titles.json#t1"]);
  });
  it("fails on both when neither is shared", () => {
    const ds = validDataset();
    second(ds, false);
    expect(where(ds, "unshared-co-champions")).toEqual(["titles.json#t1", "titles.json#t3"]);
  });
  it("passes when both are shared", () => {
    const ds = validDataset();
    ds["titles.json"][0].shared = true;
    second(ds, true);
    expect(where(ds, "unshared-co-champions")).toEqual([]);
  });
  it("passes for a single title, shared or not", () => {
    const ds = validDataset();
    expect(where(ds, "unshared-co-champions")).toEqual([]);
    ds["titles.json"][0].shared = true;
    expect(where(ds, "unshared-co-champions")).toEqual([]);
  });
});

describe("title-without-support", () => {
  it("passes for the valid dataset (league match and cup final)", () => {
    expect(where(validDataset(), "title-without-support")).toEqual([]);
  });
  it("fails when coverage is complete and the club has no match in the season", () => {
    const ds = withoutMatches(validDataset(), []);
    expect(where(ds, "title-without-support")).toEqual(["titles.json#t1"]);
  });
  it("passes for a league when the club only played away", () => {
    const ds = withoutMatches(validDataset(), ["m2"]);
    expect(where(ds, "title-without-support")).toEqual([]);
  });
  it("fails for a league when the only match is suspended", () => {
    const ds = withoutMatches(validDataset(), ["m4"]);
    ds["titles.json"][0].club_id = "club-b"; // club-b only has the suspended m4 in that season
    ds["coverage.json"][0].club_id = "club-b";
    expect(where(ds, "title-without-support")).toEqual(["titles.json#t1"]);
  });
  it("fails for a cup when the club played but never a final", () => {
    const ds = validDataset();
    ds["matches.json"][5].is_final = false;
    expect(where(ds, "title-without-support")).toEqual(["titles.json#t2"]);
  });
  it("passes for a cup when the final is played by the club as the away side", () => {
    const ds = validDataset();
    ds["matches.json"][5].home_id = "club-c";
    ds["matches.json"][5].away_id = "club-a";
    expect(where(ds, "title-without-support")).toEqual([]);
  });
  it("passes when coverage is incomplete", () => {
    const ds = withoutMatches(validDataset(), []);
    ds["coverage.json"][0].complete = false;
    expect(where(ds, "title-without-support")).toEqual([]);
  });
  it("passes when coverage ends before the season end", () => {
    const ds = withoutMatches(validDataset(), []);
    ds["coverage.json"][0].to = "2020-06-30";
    expect(where(ds, "title-without-support")).toEqual([]);
  });
  it("passes when coverage starts after the season start", () => {
    const ds = withoutMatches(validDataset(), []);
    ds["coverage.json"][0].from = "2020-02-01";
    expect(where(ds, "title-without-support")).toEqual([]);
  });
  it("passes when there is no coverage row for the club and competition", () => {
    const ds = withoutMatches(validDataset(), []);
    ds["coverage.json"] = [];
    expect(where(ds, "title-without-support")).toEqual([]);
  });
  it("accepts a closed coverage range that contains the season", () => {
    const ds = withoutMatches(validDataset(), []);
    ds["coverage.json"][0].to = "2020-12-31";
    expect(where(ds, "title-without-support")).toEqual(["titles.json#t1"]);
  });
  it("skips titles with an unknown season or competition", () => {
    const ds = withoutMatches(validDataset(), []);
    ds["titles.json"][0].season_id = "nope";
    ds["titles.json"][1].competition_id = "nope";
    expect(where(ds, "title-without-support")).toEqual([]);
  });
});
