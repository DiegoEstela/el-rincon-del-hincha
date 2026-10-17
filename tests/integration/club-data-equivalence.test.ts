// ADR 0018: the screens compute in the browser on one document per club. That is only correct if
// the engine gives the same answer on the slice as on the full dataset, so this is tested, on the
// real data, for every club.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { FILE_SCHEMAS, type DatasetFile } from "@/data-model/schemas";
import type { Dataset } from "@/data-model/types";
import { sliceClubData, statsDataFromClubData } from "@/domain/club-data";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { headToHead } from "@/domain/head-to-head";
import { fanPeriod, narrowPeriod } from "@/domain/period";
import { groupRivals } from "@/domain/rivals";
import type { MatchFilter } from "@/domain/types";

const NOW = new Date("2026-10-17T12:00:00Z");

function load<K extends DatasetFile>(file: K): Dataset[K] {
  const text = readFileSync(join(process.cwd(), "data", file), "utf8");
  return FILE_SCHEMAS[file].array().parse(JSON.parse(text)) as Dataset[K];
}
const optional = <K extends DatasetFile>(file: K): Dataset[K] => {
  try {
    return load(file);
  } catch {
    return [] as unknown as Dataset[K];
  }
};

const full = statsDataFrom({
  "clubs.json": load("clubs.json"),
  "competitions.json": load("competitions.json"),
  "seasons.json": load("seasons.json"),
  "matches.json": load("matches.json"),
  "coverage.json": load("coverage.json"),
  "titles.json": optional("titles.json"),
  "movements.json": optional("movements.json"),
  "rivalries.json": optional("rivalries.json"),
  "standings.json": [],
});
const fullIndex = buildStatsIndex(full);
const clubIds = full.clubs.map((c) => c.id);

const STARTS = ["1880-01-01", "1990-05-20", "2018-08-10", "2020-11-01", "2025-05-05", "2026-10-17"];
const FILTERS: MatchFilter[] = [
  {},
  { competitionTypes: ["league"] },
  { competitionTypes: ["national_cup"] },
  { competitionTypes: ["international"] },
];

describe("a club slice gives the engine the same answers as the full dataset", () => {
  for (const clubId of clubIds) {
    it(`rivals of ${clubId}`, () => {
      const sliceIndex = buildStatsIndex(statsDataFromClubData(sliceClubData(full, clubId)));
      for (const start of STARTS) {
        const period = fanPeriod(start, NOW);
        for (const filter of FILTERS) {
          expect(
            groupRivals(sliceIndex, clubId, period, filter),
            `${start} ${JSON.stringify(filter)}`,
          ).toEqual(groupRivals(fullIndex, clubId, period, filter));
        }
      }
      const narrowed = narrowPeriod(fanPeriod("1990-05-20", NOW), { fromYear: 2019, toYear: 2019 });
      expect(groupRivals(sliceIndex, clubId, narrowed)).toEqual(
        groupRivals(fullIndex, clubId, narrowed),
      );
    });
  }

  const PAIRS: [string, string][] = [
    ["river-plate", "boca-juniors"],
    ["belgrano", "talleres-cordoba"],
    ["arsenal", "racing-club"],
    ["colon", "union"],
    ["san-martin-tucuman", "atletico-tucuman"],
    ["independiente-rivadavia", "godoy-cruz"],
    ["barracas-central", "river-plate"],
    ["aldosivi", "tigre"],
    ["estudiantes-la-plata", "gimnasia-la-plata"],
    ["patronato", "newells-old-boys"],
  ];
  for (const [a, b] of PAIRS) {
    it(`head to head ${a} v ${b} on two merged slices`, () => {
      const merged = buildStatsIndex(
        statsDataFromClubData(sliceClubData(full, a), sliceClubData(full, b)),
      );
      for (const start of STARTS) {
        const period = fanPeriod(start, NOW);
        expect(headToHead(merged, a, b, period)).toEqual(headToHead(fullIndex, a, b, period));
      }
    });
  }
});

describe("size of the per-club documents (ADR 0018)", () => {
  it("keeps every club under 16 KB gzip and 200 KB raw", () => {
    const sizes = clubIds.map((id) => {
      const json = JSON.stringify(sliceClubData(full, id));
      return { id, raw: json.length, gzip: gzipSync(json).length };
    });
    const largest = sizes.reduce((a, b) => (a.gzip >= b.gzip ? a : b));
    console.info(
      `largest club document: ${largest.id}, ${largest.raw} B raw, ${largest.gzip} B gzip`,
    );
    for (const s of sizes) {
      expect(s.gzip, `${s.id} gzip`).toBeLessThan(16 * 1024);
      expect(s.raw, `${s.id} raw`).toBeLessThan(200 * 1024);
    }
  });
});
