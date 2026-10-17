import { describe, expect, it } from "vitest";
import { FIXED_NOW } from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { validate } from "@/data-model/validate";

describe("statsWorld", () => {
  it("is valid data, so engine tests always run on records the validator accepts", () => {
    // The world deliberately gives no coverage row to the competitions `intl-z` and `league-old`, so
    // the engine's `missing` status can be tested. The only thing the validator may say about it is
    // that those pairs lack a row (rule missing-coverage, plan 0014); every other rule must pass.
    const world = statsWorld();
    const issues = validate(world, { now: FIXED_NOW });
    expect(new Set(issues.map((i) => i.rule))).toEqual(new Set(["missing-coverage"]));
    expect(issues.map((i) => i.recordId).sort()).toEqual(
      world["clubs.json"]
        .flatMap((c) => ["intl-z", "league-old"].map((k) => `${c.id}/${k}`))
        .sort(),
    );
  });
  it("is fictional: every record carries the synthetic source", () => {
    const sources = Object.values(statsWorld()).flatMap((rows) =>
      rows.map((row: { source: string }) => row.source),
    );
    expect(new Set(sources)).toEqual(new Set(["fixture:synthetic"]));
  });
  it("returns a fresh copy each call", () => {
    const a = statsWorld();
    a["matches.json"].length = 0;
    expect(statsWorld()["matches.json"].length).toBeGreaterThan(0);
  });
});
