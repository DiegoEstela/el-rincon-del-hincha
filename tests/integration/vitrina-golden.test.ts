// Plan 0018, T6: what the vitrina shows for a few clubs on the real data, checked by hand against
// data/titles.json (the champions of the RSSSF list, plus the 2020 Copa final). If the data or the
// engine changes one of them, this fails and someone looks at why.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FILE_SCHEMAS, type DatasetFile } from "@/data-model/schemas";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { fanPeriod } from "@/domain/period";
import { pendingTitles, titleCoverage, titlesBeforePeriod, titlesInPeriod } from "@/domain/titles";

const NOW = new Date("2026-10-23T12:00:00Z");
const TODAY = "2026-10-23";

const load = (file: DatasetFile) =>
  FILE_SCHEMAS[file]
    .array()
    .parse(JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8")));
const index = buildStatsIndex(
  statsDataFrom({
    "clubs.json": load("clubs.json"),
    "competitions.json": load("competitions.json"),
    "seasons.json": load("seasons.json"),
    "matches.json": load("matches.json"),
    "coverage.json": load("coverage.json"),
    "titles.json": load("titles.json"),
    "movements.json": [],
    "rivalries.json": [],
    "standings.json": [],
  } as never),
);
const lit = (club: string, start: string) =>
  titlesInPeriod(index, club, fanPeriod(start, NOW)).map((t) => [t.id, t.awardedOn]);
const pending = (club: string, start: string) =>
  pendingTitles(index, club, fanPeriod(start, NOW)).map((p) => [
    p.competition.id,
    p.status,
    p.windowFirstSeasonId,
    p.windowLastSeasonId,
  ]);

describe("title coverage of the real data", () => {
  const windows = titleCoverage(index, TODAY);

  it("has the first division champions from the Superliga 2018-19 to the 2025 Clausura", () => {
    expect(windows.find((w) => w.competitionId === "primera-division")).toEqual({
      competitionId: "primera-division",
      firstSeasonId: "primera-division-2018-19",
      lastSeasonId: "primera-division-2025-clausura",
      windowStart: "2018-08-10",
      windowEnd: "2025-12-14",
      missingSeasonIds: [],
    });
  });

  it("has only the 2020 edition of the Copa de la Liga, so the other editions are not claimed", () => {
    expect(windows.find((w) => w.competitionId === "copa-de-la-liga-profesional")).toMatchObject({
      firstSeasonId: "copa-de-la-liga-profesional-2020",
      lastSeasonId: "copa-de-la-liga-profesional-2020",
      missingSeasonIds: [],
    });
  });
});

describe("what the shelf shows", () => {
  it("River from 1990: two league titles lit, the Copa de la Liga missing", () => {
    expect(lit("river-plate", "1990-05-20")).toEqual([
      ["primera-division-2021-river-plate", "2021-12-13"],
      ["primera-division-2023-river-plate", "2023-07-30"],
    ]);
    expect(pending("river-plate", "1990-05-20")).toEqual([
      [
        "copa-de-la-liga-profesional",
        "pending",
        "copa-de-la-liga-profesional-2020",
        "copa-de-la-liga-profesional-2020",
      ],
    ]);
  });

  it("Boca from 1990: two league titles and the 2020 Copa, nothing missing", () => {
    expect(lit("boca-juniors", "1990-05-20")).toEqual([
      ["primera-division-2019-20-boca-juniors", "2020-03-09"],
      ["copa-de-la-liga-profesional-2020-boca-juniors", "2021-01-17"],
      ["primera-division-2022-boca-juniors", "2022-10-25"],
    ]);
    expect(pending("boca-juniors", "1990-05-20")).toEqual([]);
  });

  it("Banfield from 2000: nothing lit, both competitions missing", () => {
    expect(lit("banfield", "2000-01-01")).toEqual([]);
    expect(pending("banfield", "2000-01-01").map((p) => [p[0], p[1]])).toEqual([
      ["copa-de-la-liga-profesional", "pending"],
      ["primera-division", "pending"],
    ]);
  });

  it("Racing from mid 2019: the 2018-19 title is before the period, and not counted", () => {
    const period = fanPeriod("2019-06-01", NOW);
    expect(titlesBeforePeriod(index, "racing-club", period).map((t) => t.id)).toEqual([
      "primera-division-2018-19-racing-club",
    ]);
    expect(titlesInPeriod(index, "racing-club", period)).toEqual([]);
    expect(pending("racing-club", "2019-06-01").map((p) => p[0])).toContain("primera-division");
  });

  it("a start after the last loaded champion has no window to claim anything", () => {
    expect(pending("river-plate", "2026-01-01").every((p) => p[1] === "unknown")).toBe(true);
  });
});
