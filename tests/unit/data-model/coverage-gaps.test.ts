import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COVERAGE_GAPS } from "@/data-model/coverage-gaps";
import { competitionSchema } from "@/data-model/schemas";

const competitions = competitionSchema
  .array()
  .parse(JSON.parse(readFileSync(join(process.cwd(), "data", "competitions.json"), "utf8")));

describe("COVERAGE_GAPS", () => {
  it("gives every gap a source URL, a reason and valid dates", () => {
    for (const g of COVERAGE_GAPS) {
      expect(new URL(g.source).protocol, g.source).toBe("https:");
      expect(g.reason.trim().length, g.source).toBeGreaterThan(10);
      expect(g.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (g.to !== null) {
        expect(g.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(g.from <= g.to, `${g.competition_id} ${g.from}`).toBe(true);
      }
    }
  });

  it("only names competitions that exist in data/competitions.json", () => {
    const ids = new Set(competitions.map((c) => c.id));
    for (const g of COVERAGE_GAPS) expect(ids.has(g.competition_id), g.competition_id).toBe(true);
  });

  it("never overlaps two gaps of one competition and keeps them sorted", () => {
    const sorted = [...COVERAGE_GAPS].sort(
      (a, b) => a.competition_id.localeCompare(b.competition_id) || a.from.localeCompare(b.from),
    );
    expect(COVERAGE_GAPS).toEqual(sorted);
    for (let i = 1; i < COVERAGE_GAPS.length; i++) {
      const [prev, cur] = [COVERAGE_GAPS[i - 1], COVERAGE_GAPS[i]];
      if (prev.competition_id !== cur.competition_id) continue;
      expect(prev.to !== null && prev.to < cur.from, `${prev.from} and ${cur.from}`).toBe(true);
    }
  });

  it("declares the 2025 Apertura tail and the four Copa de la Liga editions that are not loaded", () => {
    expect(COVERAGE_GAPS.map((g) => [g.competition_id, g.from, g.to])).toEqual([
      ["copa-de-la-liga-profesional", "2021-02-12", "2021-06-04"],
      ["copa-de-la-liga-profesional", "2022-02-10", "2022-05-22"],
      ["copa-de-la-liga-profesional", "2023-08-17", "2023-12-16"],
      ["copa-de-la-liga-profesional", "2024-01-25", "2024-05-05"],
      ["primera-division", "2025-05-05", null],
    ]);
  });

  it("cites a permanent es.wikipedia revision for every Phase 1 gap", () => {
    for (const g of COVERAGE_GAPS) {
      const url = new URL(g.source);
      expect(url.host, g.source).toBe("es.wikipedia.org");
      expect(url.searchParams.get("oldid"), g.source).toMatch(/^\d+$/);
    }
  });
});
