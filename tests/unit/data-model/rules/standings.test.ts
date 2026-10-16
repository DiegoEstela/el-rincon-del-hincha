import { describe, expect, it } from "vitest";
import { issuesFor, where } from "../../../fixtures/data-model/run";
import { validDataset } from "../../../fixtures/data-model/dataset";

describe("control-totals", () => {
  it("fails when won + drawn + lost differs from played", () => {
    const ds = validDataset();
    ds["standings.json"][0].played = 10;
    ds["standings.json"][0].won = 3;
    ds["standings.json"][0].drawn = 3;
    ds["standings.json"][0].lost = 3;
    expect(where(ds, "control-totals")).toEqual(["standings.json#club-a/league-x-2020"]);
  });
  it("passes when they add up (9 = 3 + 3 + 3)", () => {
    const ds = validDataset();
    ds["standings.json"][0].played = 9;
    ds["standings.json"][0].won = 3;
    ds["standings.json"][0].drawn = 3;
    ds["standings.json"][0].lost = 3;
    expect(where(ds, "control-totals")).toEqual([]);
  });
});

describe("standings-mismatch", () => {
  it("passes when the totals equal the tally of the matches", () => {
    expect(where(validDataset(), "standings-mismatch")).toEqual([]);
  });
  it("fails with complete coverage and a different number of wins", () => {
    const ds = validDataset();
    ds["standings.json"][0].won = 3;
    ds["standings.json"][0].drawn = 0;
    const issues = issuesFor(ds, undefined, "standings-mismatch");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("matches say");
  });
  it.each(["played", "drawn", "lost"] as const)("fails when %s differs", (field) => {
    const ds = validDataset();
    ds["standings.json"][0][field] += 1;
    expect(where(ds, "standings-mismatch")).toEqual(["standings.json#club-a/league-x-2020"]);
  });
  it("passes with incomplete coverage even if the numbers differ", () => {
    const ds = validDataset();
    ds["standings.json"][0].won = 3;
    ds["coverage.json"][0].complete = false;
    expect(where(ds, "standings-mismatch")).toEqual([]);
  });
  it("skips standings whose season is unknown", () => {
    const ds = validDataset();
    ds["standings.json"][0].season_id = "nope";
    expect(where(ds, "standings-mismatch")).toEqual([]);
  });
});
