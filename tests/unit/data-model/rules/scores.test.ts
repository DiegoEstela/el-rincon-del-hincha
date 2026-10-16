import { describe, expect, it } from "vitest";
import { where } from "../../../fixtures/data-model/run";
import { validDataset } from "../../../fixtures/data-model/dataset";

describe("negative-goals", () => {
  it.each(["home_goals", "away_goals", "home_penalties", "away_penalties"] as const)(
    "fails on negative %s",
    (field) => {
      const ds = validDataset();
      ds["matches.json"][0][field] = -1;
      expect(where(ds, "negative-goals")).toEqual(["matches.json#m1"]);
    },
  );
  it("passes on zero and null", () => {
    const ds = validDataset();
    ds["matches.json"][0].home_goals = 0;
    expect(where(ds, "negative-goals")).toEqual([]);
  });
});

describe("missing-score", () => {
  it("fails for a played match with null goals", () => {
    const ds = validDataset();
    ds["matches.json"][0].home_goals = null;
    expect(where(ds, "missing-score")).toEqual(["matches.json#m1"]);
  });
  it("fails for an administrative result with null goals", () => {
    const ds = validDataset();
    ds["matches.json"][4].away_goals = null;
    expect(where(ds, "missing-score")).toEqual(["matches.json#m5"]);
  });
  it("passes for a suspended match with null goals", () => {
    expect(where(validDataset(), "missing-score")).toEqual([]);
  });
});

describe("penalties-inconsistent", () => {
  const penaltyMatch = () => {
    const ds = validDataset();
    return { ds, m: ds["matches.json"][5] };
  };
  it("passes for a valid shoot-out and for extra time", () => {
    expect(where(validDataset(), "penalties-inconsistent")).toEqual([]);
  });
  it("fails when penalties are decided without both counts", () => {
    const { ds, m } = penaltyMatch();
    m.away_penalties = null;
    expect(where(ds, "penalties-inconsistent")).toEqual(["matches.json#m6"]);
  });
  it("fails when the home count is missing", () => {
    const { ds, m } = penaltyMatch();
    m.home_penalties = null;
    expect(where(ds, "penalties-inconsistent")).toEqual(["matches.json#m6"]);
  });
  it("fails when the goals are not level", () => {
    const { ds, m } = penaltyMatch();
    m.home_goals = 2;
    expect(where(ds, "penalties-inconsistent")).toEqual(["matches.json#m6"]);
  });
  it("fails when the shoot-out is tied", () => {
    const { ds, m } = penaltyMatch();
    m.away_penalties = 4;
    expect(where(ds, "penalties-inconsistent")).toEqual(["matches.json#m6"]);
  });
  it("fails when penalty counts exist without a penalties decision", () => {
    const ds = validDataset();
    ds["matches.json"][6].home_penalties = 3;
    expect(where(ds, "penalties-inconsistent")).toEqual(["matches.json#m7"]);
  });
  it("fails when only the away count is set without a penalties decision", () => {
    const ds = validDataset();
    ds["matches.json"][6].away_penalties = 3;
    expect(where(ds, "penalties-inconsistent")).toEqual(["matches.json#m7"]);
  });
});
