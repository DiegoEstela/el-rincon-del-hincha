import { describe, expect, it } from "vitest";
import { FIXED_NOW } from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { validate } from "@/data-model/validate";

describe("statsWorld", () => {
  it("is valid data, so engine tests always run on records the validator accepts", () => {
    expect(validate(statsWorld(), { now: FIXED_NOW })).toEqual([]);
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
