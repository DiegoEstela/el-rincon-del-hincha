import { describe, expect, it } from "vitest";
import { issuesFor, where } from "../../../fixtures/data-model/run";
import { validDataset } from "../../../fixtures/data-model/dataset";

describe("duplicate-match", () => {
  it("fails on the same date, competition and pair", () => {
    const ds = validDataset();
    ds["matches.json"].push({ ...ds["matches.json"][0], id: "dup" });
    expect(where(ds, "duplicate-match")).toEqual(["matches.json#dup"]);
  });
  it("names the first record in the message", () => {
    const ds = validDataset();
    ds["matches.json"].push({ ...ds["matches.json"][0], id: "dup" });
    const [issue] = issuesFor(ds, undefined, "duplicate-match");
    expect(issue.message).toContain("m1");
  });
  it("fails when home and away are swapped", () => {
    const ds = validDataset();
    ds["matches.json"].push({
      ...ds["matches.json"][0],
      id: "dup",
      home_id: "club-b",
      away_id: "club-a",
    });
    expect(where(ds, "duplicate-match")).toEqual(["matches.json#dup"]);
  });
  it("gives two issues for three copies", () => {
    const ds = validDataset();
    ds["matches.json"].push({ ...ds["matches.json"][0], id: "dup1" });
    ds["matches.json"].push({ ...ds["matches.json"][0], id: "dup2" });
    expect(where(ds, "duplicate-match")).toEqual(["matches.json#dup1", "matches.json#dup2"]);
  });
  it("passes for the same pair and date in different competitions", () => {
    const ds = validDataset();
    ds["matches.json"].push({
      ...ds["matches.json"][0],
      id: "other",
      season_id: "cup-y-2020",
    });
    expect(where(ds, "duplicate-match")).toEqual([]);
  });
  it("passes for the same pair and competition on a different date", () => {
    const ds = validDataset();
    ds["matches.json"].push({ ...ds["matches.json"][0], id: "later", date: "2020-04-01" });
    expect(where(ds, "duplicate-match")).toEqual([]);
  });
  it("passes for two seasons of the same competition on different dates", () => {
    expect(where(validDataset(), "duplicate-match")).toEqual([]);
  });
  it("skips matches whose season is unknown", () => {
    const ds = validDataset();
    ds["matches.json"][0].season_id = "nope";
    ds["matches.json"].push({ ...ds["matches.json"][0], id: "dup" });
    expect(where(ds, "duplicate-match")).toEqual([]);
  });
});
