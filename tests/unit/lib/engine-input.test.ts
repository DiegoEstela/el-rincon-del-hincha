import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRivalId, parseRivalsFilter, parseSort } from "@/lib/engine-input";

const bounds = { minYear: 2018, maxYear: 2025, types: ["league", "national_cup"] as const };
const DEFAULT = { fromYear: 2018, toYear: 2025, type: "all" };

describe("parseRivalsFilter", () => {
  it("returns the default for nothing", () => {
    expect(parseRivalsFilter({}, bounds)).toEqual(DEFAULT);
  });

  it("keeps valid years and types", () => {
    expect(parseRivalsFilter({ fromYear: 2020, toYear: 2023, type: "league" }, bounds)).toEqual({
      fromYear: 2020,
      toYear: 2023,
      type: "league",
    });
    expect(parseRivalsFilter({ type: "all" }, bounds).type).toBe("all");
  });

  it("falls back to the default for anything that is not a year inside the bounds", () => {
    for (const bad of [undefined, null, "2020", 2020.5, Number.NaN, 2017, 2026, {}, [], true]) {
      expect(parseRivalsFilter({ fromYear: bad, toYear: bad }, bounds)).toEqual(DEFAULT);
    }
  });

  it("falls back to all for an unknown or unoffered type", () => {
    for (const bad of ["international", "other", "", 1, null, {}, "LEAGUE"]) {
      expect(parseRivalsFilter({ type: bad }, bounds).type).toBe("all");
    }
  });

  it("swaps the years when the first is after the last", () => {
    expect(parseRivalsFilter({ fromYear: 2024, toYear: 2019 }, bounds)).toMatchObject({
      fromYear: 2019,
      toYear: 2024,
    });
  });
});

describe("parseSort", () => {
  it("accepts the three orders and falls back to balance", () => {
    expect(parseSort("balance")).toBe("balance");
    expect(parseSort("played")).toBe("played");
    expect(parseSort("name")).toBe("name");
    for (const bad of ["Name", "", null, undefined, 3, {}, "goals"]) {
      expect(parseSort(bad)).toBe("balance");
    }
  });
});

describe("parseRivalId", () => {
  const options = { clubId: "river-plate", clubIds: new Set(["river-plate", "boca-juniors"]) };

  it("accepts a known rival that is not the club", () => {
    expect(parseRivalId("boca-juniors", options)).toEqual({ ok: true, id: "boca-juniors" });
  });

  it("returns a code, never the input", () => {
    for (const bad of ["nope", "", "../boca-juniors", 3, null, undefined, "x".repeat(10_000)]) {
      const result = parseRivalId(bad, options);
      expect(result).toEqual({ ok: false, code: "unknown_club" });
      expect(JSON.stringify(result)).not.toContain("x".repeat(20));
    }
    expect(parseRivalId("river-plate", options)).toEqual({ ok: false, code: "same_club" });
  });
});

describe("engine-input has no Zod", () => {
  it("does not import zod, which would cost 94 KB gzip in the browser", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/engine-input.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']zod/);
    expect(source).not.toMatch(/from\s+["']@\/data-model\/schemas/);
  });
});
