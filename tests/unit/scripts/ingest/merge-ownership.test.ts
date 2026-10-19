import { describe, expect, it } from "vitest";
import { mergeDataset } from "../../../../scripts/ingest/core/merge";

const A = "https://example.org/a/";
const B = "https://example.org/b/";
const match = (id: string, season: string, date: string, source: string) => ({
  id,
  season_id: season,
  date,
  home_id: "x",
  away_id: "y",
  source,
});
const standing = (club: string, season: string, source: string, won = 1) => ({
  club_id: club,
  season_id: season,
  played: 1,
  won,
  drawn: 0,
  lost: 0,
  source,
});
const title = (id: string, source: string) => ({ id, source });
const none = { competitions: [], seasons: [], matches: [] };

describe("standings and titles ownership (plan 0017, T5)", () => {
  it("replaces the standings and titles of the adapter and keeps the others", () => {
    const existing = {
      "standings.json": [standing("x", "s1", A), standing("y", "s2", B)],
      "titles.json": [title("t-a", A), title("t-b", B)],
    };
    const result = mergeDataset(
      existing,
      { ...none, standings: [standing("x", "s1", A, 2)], titles: [title("t-a2", A)] },
      A,
    );
    expect(result.conflicts).toEqual([]);
    expect(result.dataset["standings.json"]).toEqual([
      standing("y", "s2", B),
      standing("x", "s1", A, 2),
    ]);
    expect(result.dataset["titles.json"]).toEqual([title("t-b", B), title("t-a2", A)]);
  });

  it("is a conflict when an incoming standing key belongs to another prefix", () => {
    const result = mergeDataset(
      { "standings.json": [standing("x", "s1", B)] },
      { ...none, standings: [standing("x", "s1", A)] },
      A,
    );
    expect(result.conflicts).toEqual([
      expect.stringMatching(/standings\.json#x\/s1.*already owned by/),
    ]);
  });

  it("is a conflict when an incoming title id belongs to another prefix", () => {
    const result = mergeDataset(
      { "titles.json": [title("t1", B)] },
      { ...none, titles: [title("t1", A)] },
      A,
    );
    expect(result.conflicts).toEqual([expect.stringMatching(/titles\.json#t1.*already owned by/)]);
  });

  it("does not touch standings or titles when the adapter brings none", () => {
    const existing = { "standings.json": [standing("x", "s1", B)], "titles.json": [title("t", B)] };
    const result = mergeDataset(existing, none, A);
    expect(result.dataset["standings.json"]).toEqual(existing["standings.json"]);
    expect(result.dataset["titles.json"]).toEqual(existing["titles.json"]);
  });

  it("leaves the matches behavior as it was", () => {
    const result = mergeDataset(
      { "matches.json": [match("m1", "s1", "2020-01-01", A), match("m2", "s2", "2020-01-02", B)] },
      { ...none, matches: [match("m3", "s1", "2020-01-03", A)] },
      A,
    );
    expect(result.dataset["matches.json"]).toEqual([
      match("m2", "s2", "2020-01-02", B),
      match("m3", "s1", "2020-01-03", A),
    ]);
  });
});

describe("one source per season and extends (plan 0017, T6)", () => {
  const existing = {
    "matches.json": [match("o1", "s1", "2025-05-03", B), match("o2", "s1", "2025-05-04", B)],
  };

  it("is a conflict for a match in a season that has matches of another prefix", () => {
    const result = mergeDataset(
      existing,
      { ...none, matches: [match("r1", "s1", "2025-06-01", A)] },
      A,
    );
    expect(result.conflicts).toEqual([
      expect.stringMatching(/season s1.*https:\/\/example\.org\/b\/.*https:\/\/example\.org\/a\//),
    ]);
  });

  it("lets an extends season take matches dated strictly after the other source", () => {
    const result = mergeDataset(
      existing,
      { ...none, matches: [match("r1", "s1", "2025-05-05", A)] },
      A,
      { extends: ["s1"] },
    );
    expect(result.conflicts).toEqual([]);
    expect(result.dataset["matches.json"]).toHaveLength(3);
  });

  it("is a conflict for an extends match on or before the last match of the other source", () => {
    const result = mergeDataset(
      existing,
      { ...none, matches: [match("r1", "s1", "2025-05-04", A)] },
      A,
      { extends: ["s1"] },
    );
    expect(result.conflicts).toEqual([expect.stringMatching(/season s1.*2025-05-04/)]);
  });

  it("keeps the extends rule scoped to the listed season", () => {
    const result = mergeDataset(
      { "matches.json": [match("o1", "s1", "2025-05-03", B), match("o9", "s2", "2025-05-03", B)] },
      { ...none, matches: [match("r1", "s2", "2025-06-01", A)] },
      A,
      { extends: ["s1"] },
    );
    expect(result.conflicts).toHaveLength(1);
  });

  it("ignores the own previous matches when it runs again", () => {
    const again = {
      "matches.json": [match("o1", "s1", "2025-05-03", B), match("r1", "s1", "2025-05-05", A)],
    };
    const result = mergeDataset(
      again,
      { ...none, matches: [match("r1", "s1", "2025-05-05", A)] },
      A,
      { extends: ["s1"] },
    );
    expect(result.conflicts).toEqual([]);
  });

  it("does not fire for a season without matches of another source", () => {
    const result = mergeDataset(
      existing,
      { ...none, matches: [match("r1", "s9", "2025-06-01", A)] },
      A,
    );
    expect(result.conflicts).toEqual([]);
  });

  it("reports one conflict per season, not one per match", () => {
    const result = mergeDataset(
      existing,
      {
        ...none,
        matches: [match("r1", "s1", "2025-06-01", A), match("r2", "s1", "2025-06-02", A)],
      },
      A,
    );
    expect(result.conflicts).toHaveLength(1);
  });
});
