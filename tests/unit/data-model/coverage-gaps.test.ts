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

  it("declares what is not loaded: the tail of each competition and four Copa de la Liga editions", () => {
    expect(COVERAGE_GAPS.map((g) => [g.competition_id, g.from, g.to])).toEqual([
      ["copa-argentina", "2025-11-06", null],
      ["copa-de-la-liga-profesional", "2021-02-12", "2021-06-04"],
      ["copa-de-la-liga-profesional", "2022-02-10", "2022-05-22"],
      ["copa-de-la-liga-profesional", "2023-08-17", "2023-12-16"],
      ["copa-de-la-liga-profesional", "2024-01-25", "2024-05-05"],
      ["primera-division", "2025-12-15", null],
      ["supercopa-argentina", "2025-09-07", null],
      ["supercopa-internacional", "2026-09-27", null],
      ["trofeo-de-campeones", "2025-12-21", null],
    ]);
  });

  it("cites a permanent es.wikipedia revision, or a pinned RSSSF page, for every gap", () => {
    const pinned = (
      JSON.parse(readFileSync(join(process.cwd(), "sources/rsssf/manifest.json"), "utf8")) as {
        pages: { url: string }[];
      }
    ).pages.map((p) => p.url);
    for (const g of COVERAGE_GAPS) {
      const url = new URL(g.source);
      if (url.host === "www.rsssf.org") {
        expect(pinned, g.source).toContain(`${url.origin}${url.pathname}`);
      } else {
        expect(url.host, g.source).toBe("es.wikipedia.org");
        expect(url.searchParams.get("oldid"), g.source).toMatch(/^\d+$/);
      }
    }
  });
});
