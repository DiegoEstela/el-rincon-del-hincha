// Guards the acceptance criterion "each rule has at least one failing and one passing fixture":
// every rule id has a mutation of the valid dataset that produces exactly that rule.
import { describe, expect, it } from "vitest";
import { RULE_IDS, type RuleId } from "@/data-model/types";
import { validate } from "@/data-model/validate";
import {
  FIXED_NOW,
  makeCoverage,
  validDataset,
  type FixtureDataset,
} from "../../fixtures/data-model/dataset";

type Mutation = (ds: FixtureDataset) => Record<string, unknown>;
const loose = (ds: FixtureDataset) => ds as unknown as Record<string, unknown>;

const MUTATIONS: Record<Exclude<RuleId, "invalid-json">, Mutation> = {
  schema: (ds) => {
    ds["seasons.json"][0].start = "2020-02-30";
    return loose(ds);
  },
  "unknown-file": (ds) => ({ ...loose(ds), "match.json": [] }),
  "missing-source": (ds) => {
    delete (ds["clubs.json"][0] as unknown as Record<string, unknown>).source;
    return loose(ds);
  },
  "duplicate-id": (ds) => {
    ds["clubs.json"].push({ ...ds["clubs.json"][0] });
    return loose(ds);
  },
  "duplicate-match": (ds) => {
    ds["matches.json"].push({ ...ds["matches.json"][6], id: "dup" });
    return loose(ds);
  },
  "unknown-club": (ds) => {
    ds["matches.json"][6].home_id = "club-zzz";
    return loose(ds);
  },
  "unknown-reference": (ds) => {
    ds["matches.json"][6].season_id = "nope";
    return loose(ds);
  },
  "same-club": (ds) => {
    ds["matches.json"][0].away_id = ds["matches.json"][0].home_id;
    return loose(ds);
  },
  "negative-goals": (ds) => {
    ds["matches.json"][6].home_goals = -1;
    return loose(ds);
  },
  "missing-score": (ds) => {
    ds["matches.json"][6].away_goals = null;
    return loose(ds);
  },
  "penalties-inconsistent": (ds) => {
    ds["matches.json"][5].away_penalties = 4;
    return loose(ds);
  },
  "future-played-match": (ds) => {
    ds["matches.json"][0].date = "2026-10-17";
    ds["seasons.json"][0].end = "2026-12-31";
    return loose(ds);
  },
  "date-outside-season": (ds) => {
    ds["matches.json"][0].date = "2019-12-31";
    return loose(ds);
  },
  "invalid-season-range": (ds) => {
    ds["coverage.json"][1].to = "2019-12-31";
    return loose(ds);
  },
  "title-without-support": (ds) => {
    ds["matches.json"][5].is_final = false;
    return loose(ds);
  },
  "unshared-co-champions": (ds) => {
    ds["titles.json"].push({ ...ds["titles.json"][0], id: "t3", club_id: "club-b", shared: true });
    return loose(ds);
  },
  "control-totals": (ds) => {
    ds["standings.json"][0].played = 99;
    ds["coverage.json"][0].complete = false; // keep standings-mismatch out of the picture
    return loose(ds);
  },
  "standings-mismatch": (ds) => {
    ds["standings.json"][0].won = 3;
    ds["standings.json"][0].lost = 0;
    return loose(ds);
  },
  "missing-coverage": (ds) => {
    ds["coverage.json"] = ds["coverage.json"].filter(
      (c) => !(c.club_id === "club-b" && c.competition_id === "cup-y"),
    );
    return loose(ds);
  },
  "coverage-overlap": (ds) => {
    ds["coverage.json"].push(makeCoverage("club-b", "league-x", "2021-01-01", null, false));
    return loose(ds);
  },
  "coverage-overclaim": (ds) => {
    ds["seasons.json"].push({
      id: "league-x-2022",
      competition_id: "league-x",
      name: "2022",
      start: "2022-01-01",
      end: "2022-12-31",
      source: "fixture:synthetic",
    });
    return loose(ds);
  },
};

describe("rule catalogue", () => {
  it("the baseline dataset produces no issue", () => {
    expect(validate(loose(validDataset()), { now: FIXED_NOW })).toEqual([]);
  });

  it("has a mutation for every rule the validator can emit", () => {
    const expected = RULE_IDS.filter((r) => r !== "invalid-json").sort();
    expect(Object.keys(MUTATIONS).sort()).toEqual(expected);
  });

  it.each(Object.entries(MUTATIONS))(
    "rule %s fails on its fixture and only that rule",
    (rule, mutate) => {
      const issues = validate(mutate(validDataset()), { now: FIXED_NOW });
      expect(issues.length).toBeGreaterThan(0);
      expect(new Set(issues.map((i) => i.rule))).toEqual(new Set([rule]));
    },
  );
});
