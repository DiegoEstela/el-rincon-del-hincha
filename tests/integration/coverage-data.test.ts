// Real data (data/): the coverage table is what the generator derives, it says what plan 0014
// promised per club, and the statistics engine reads it as the notice screens will show it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COVERAGE_GAPS } from "@/data-model/coverage-gaps";
import { generateCoverage } from "@/data-model/coverage-generate";
import { FILE_SCHEMAS, type DatasetFile } from "@/data-model/schemas";
import type { Dataset } from "@/data-model/types";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { calculateHistory } from "@/domain/history";
import { headToHead } from "@/domain/head-to-head";
import { fanPeriod } from "@/domain/period";
import type { FanPeriod } from "@/domain/types";
import { serializeRecords } from "../../scripts/ingest/core/serialize";

const NOW = new Date("2026-10-17T12:00:00Z");

function load<K extends DatasetFile>(file: K): Dataset[K] {
  const text = readFileSync(join(process.cwd(), "data", file), "utf8");
  return FILE_SCHEMAS[file].array().parse(JSON.parse(text)) as Dataset[K];
}

const clubs = load("clubs.json");
const competitions = load("competitions.json");
const coverage = load("coverage.json");
const input = {
  "clubs.json": clubs,
  "competitions.json": competitions,
  "seasons.json": load("seasons.json"),
  "matches.json": load("matches.json"),
};

describe("data/coverage.json", () => {
  it("is exactly what the generator derives from the data and the declared gaps", async () => {
    expect(coverage).toEqual(generateCoverage(input, COVERAGE_GAPS));
    const text = readFileSync(join(process.cwd(), "data", "coverage.json"), "utf8");
    expect(text).toBe(await serializeRecords("coverage.json", coverage));
  });

  it("has a row for every club and competition (34 x 2) and 232 rows in all", () => {
    expect(clubs).toHaveLength(34);
    expect(competitions.map((c) => c.id)).toEqual([
      "copa-de-la-liga-profesional",
      "primera-division",
    ]);
    for (const club of clubs) {
      for (const competition of competitions) {
        expect(
          coverage.some((r) => r.club_id === club.id && r.competition_id === competition.id),
          `${club.id}/${competition.id}`,
        ).toBe(true);
      }
    }
    expect(coverage).toHaveLength(232);
    expect(coverage.filter((r) => r.complete)).toHaveLength(62);
  });

  it("starts each club's first complete Primera stretch at its first loaded season (ADR 0003)", () => {
    const stretches = (club: string) =>
      coverage
        .filter((r) => r.club_id === club && r.competition_id === "primera-division" && r.complete)
        .map((r) => `${r.from} to ${r.to}`);
    const full = "2018-08-10 to 2025-12-14";
    for (const club of [
      "argentinos-juniors",
      "atletico-tucuman",
      "banfield",
      "boca-juniors",
      "river-plate",
      "velez-sarsfield",
    ]) {
      expect(stretches(club), club).toEqual([full]);
    }
    expect(stretches("central-cordoba-sde")).toEqual(["2019-07-26 to 2025-12-14"]);
    expect(stretches("platense")).toEqual(["2021-07-16 to 2025-12-14"]);
    expect(stretches("barracas-central")).toEqual(["2022-06-03 to 2025-12-14"]);
    expect(stretches("instituto")).toEqual(["2023-01-27 to 2025-12-14"]);
    expect(stretches("deportivo-riestra")).toEqual(["2024-05-10 to 2025-12-14"]);
    expect(stretches("independiente-rivadavia")).toEqual(["2024-05-10 to 2025-12-14"]);
    // Clubs that left and came back have one stretch per stay, never one across the absence.
    expect(stretches("aldosivi")).toEqual(["2018-08-10 to 2022-10-25", "2025-01-23 to 2025-12-14"]);
    expect(stretches("belgrano")).toEqual(["2018-08-10 to 2019-04-07", "2023-01-27 to 2025-12-14"]);
    expect(stretches("tigre")).toEqual(["2018-08-10 to 2019-04-07", "2022-06-03 to 2025-12-14"]);
    expect(stretches("san-martin-san-juan")).toEqual([
      "2018-08-10 to 2019-04-07",
      "2025-01-23 to 2025-12-14",
    ]);
    // Former Primera clubs end where our data for them ends.
    expect(stretches("arsenal")).toEqual(["2019-07-26 to 2023-07-30"]);
    expect(stretches("colon")).toEqual(["2018-08-10 to 2023-07-30"]);
    expect(stretches("patronato")).toEqual(["2018-08-10 to 2022-10-25"]);
    expect(stretches("san-martin-tucuman")).toEqual(["2018-08-10 to 2019-04-07"]);
  });

  it("never marks a day of 2025-12-15 onwards, or a Copa de la Liga edition not loaded, as complete", () => {
    for (const r of coverage.filter((x) => x.complete)) {
      expect(r.to !== null, `${r.club_id} ${r.from}`).toBe(true);
      if (r.competition_id === "primera-division") expect(r.to! <= "2025-12-14").toBe(true);
      if (r.competition_id === "copa-de-la-liga-profesional") {
        expect(r.from).toBe("2020-10-30");
        expect(r.to).toBe("2021-02-11");
      }
    }
  });
});

describe("the engine on the real coverage", () => {
  const index = buildStatsIndex(
    statsDataFrom({
      ...input,
      "titles.json": [],
      "movements.json": [],
      "rivalries.json": [],
      "coverage.json": coverage,
      "standings.json": [],
    }),
  );
  const range = (start: string, end: string): FanPeriod => ({ start, end, isEmpty: false });
  const status = (notice: { competitions: readonly { competitionId: string }[] }, id: string) =>
    notice.competitions.find((c) => c.competitionId === id);

  it("River since 2010: Primera is partial, complete only between 2018-08-10 and 2025-12-14", () => {
    const { coverage: notice } = calculateHistory(
      index,
      "river-plate",
      fanPeriod("2010-01-01", NOW),
    );
    expect(notice.isComplete).toBe(false);
    expect(status(notice, "primera-division")).toEqual({
      competitionId: "primera-division",
      status: "partial",
      completeFrom: "2018-08-10",
      completeTo: "2025-12-14",
    });
  });

  it("River in 2022: Primera complete, the Copa de la Liga 2022 missing, so not complete overall", () => {
    const { coverage: notice } = calculateHistory(
      index,
      "river-plate",
      range("2022-01-01", "2022-12-31"),
    );
    expect(status(notice, "primera-division")).toMatchObject({ status: "complete" });
    expect(status(notice, "copa-de-la-liga-profesional")).toMatchObject({ status: "missing" });
    expect(notice.isComplete).toBe(false);
  });

  it("Belgrano since 2020: Primera is partial and only complete from 2023-01-27", () => {
    const { coverage: notice } = calculateHistory(
      index,
      "belgrano",
      range("2020-01-01", "2026-10-17"),
    );
    expect(status(notice, "primera-division")).toEqual({
      competitionId: "primera-division",
      status: "partial",
      completeFrom: "2023-01-27",
      completeTo: "2025-12-14",
    });
  });

  it("San Martín de Tucumán since 2015: Primera is partial and ends 2019-04-07", () => {
    const { coverage: notice } = calculateHistory(
      index,
      "san-martin-tucuman",
      range("2015-01-01", "2026-10-17"),
    );
    expect(status(notice, "primera-division")).toEqual({
      competitionId: "primera-division",
      status: "partial",
      completeFrom: "2018-08-10",
      completeTo: "2019-04-07",
    });
  });

  it("Vélez between 2020-11-01 and 2021-01-31: the Copa Diego Maradona is complete", () => {
    const { coverage: notice } = calculateHistory(
      index,
      "velez-sarsfield",
      range("2020-11-01", "2021-01-31"),
    );
    expect(status(notice, "copa-de-la-liga-profesional")).toMatchObject({
      status: "complete",
      completeFrom: "2020-10-30",
      completeTo: "2021-02-11",
    });
  });

  it("Barracas v River since 2019: partial, but complete in the 2022-06-03 to 2024-12-16 range", () => {
    const since = headToHead(
      index,
      "barracas-central",
      "river-plate",
      range("2019-01-01", "2026-10-17"),
    );
    expect(status(since.coverage, "primera-division")).toMatchObject({
      status: "partial",
      completeFrom: "2018-08-10",
      completeTo: "2025-12-14",
    });
    const within = headToHead(
      index,
      "barracas-central",
      "river-plate",
      range("2022-06-03", "2024-12-16"),
    );
    expect(status(within.coverage, "primera-division")).toMatchObject({ status: "complete" });
  });
});
