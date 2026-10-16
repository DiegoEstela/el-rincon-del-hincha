import { describe, expect, it } from "vitest";
import { issuesFor, where } from "../../../fixtures/data-model/run";
import { validDataset } from "../../../fixtures/data-model/dataset";

describe("duplicate-id", () => {
  it("fails on repeated ids, naming the file", () => {
    const ds = validDataset();
    ds["clubs.json"].push({ ...ds["clubs.json"][0] });
    expect(where(ds, "duplicate-id")).toEqual(["clubs.json#club-a"]);
  });
  it("fails on repeated composite keys", () => {
    const ds = validDataset();
    ds["standings.json"].push({ ...ds["standings.json"][0] });
    expect(where(ds, "duplicate-id")).toEqual(["standings.json#club-a/league-x-2020"]);
  });
  it("passes on the valid dataset", () => {
    expect(where(validDataset(), "duplicate-id")).toEqual([]);
  });
});

describe("unknown-club / same-club", () => {
  it("flags an unknown home club", () => {
    const ds = validDataset();
    ds["matches.json"][0].home_id = "club-zzz";
    expect(where(ds, "unknown-club")).toEqual(["matches.json#m1"]);
    expect(issuesFor(ds)[0].message).toContain("home_id");
  });
  it("flags an unknown away club", () => {
    const ds = validDataset();
    ds["matches.json"][0].away_id = "club-zzz";
    const issues = issuesFor(ds, undefined, "unknown-club");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("away_id");
  });
  it("flags home and away being the same club", () => {
    const ds = validDataset();
    ds["matches.json"][0].away_id = "club-a";
    expect(where(ds, "same-club")).toEqual(["matches.json#m1"]);
  });
  it("does not flag the same club when both are unknown (only unknown-club)", () => {
    const ds = validDataset();
    ds["matches.json"][0].home_id = "club-zzz";
    ds["matches.json"][0].away_id = "club-zzz";
    expect(where(ds, "unknown-club")).toHaveLength(2);
  });
  it("passes on the valid dataset", () => {
    const ds = validDataset();
    expect(where(ds, "unknown-club")).toEqual([]);
    expect(where(ds, "same-club")).toEqual([]);
  });
});

describe("unknown-reference", () => {
  it("flags the season of a match", () => {
    const ds = validDataset();
    ds["matches.json"][0].season_id = "nope";
    expect(where(ds, "unknown-reference")).toEqual(["matches.json#m1"]);
  });
  it("flags the competition of a season", () => {
    const ds = validDataset();
    ds["seasons.json"][0].competition_id = "nope";
    expect(where(ds, "unknown-reference")).toContain("seasons.json#league-x-2020");
  });
  it("flags club and season of a title", () => {
    const ds = validDataset();
    ds["titles.json"][0].club_id = "nope";
    ds["titles.json"][1].season_id = "nope";
    expect(where(ds, "unknown-reference")).toEqual(["titles.json#t1", "titles.json#t2"]);
  });
  it("flags a title whose competition differs from its season's", () => {
    const ds = validDataset();
    ds["titles.json"][0].competition_id = "cup-y";
    const issues = issuesFor(ds, undefined, "unknown-reference");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("league-x");
  });
  it("flags coverage, rivalry, movement and standings references", () => {
    const ds = validDataset();
    ds["coverage.json"][0].club_id = "nope";
    ds["rivalries.json"][0].club_b = "nope";
    ds["movements.json"][0].season_id = "nope";
    ds["standings.json"][0].season_id = "nope";
    expect(where(ds, "unknown-reference")).toEqual([
      "coverage.json#nope/league-x/2020-01-01",
      "movements.json#mv1",
      "rivalries.json#club-a~nope",
      "standings.json#club-a/nope",
    ]);
  });
  it("passes on the valid dataset", () => {
    expect(where(validDataset(), "unknown-reference")).toEqual([]);
  });
});
