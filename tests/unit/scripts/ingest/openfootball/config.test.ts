import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPENFOOTBALL_COMMIT,
  OPENFOOTBALL_COMPETITIONS,
  OPENFOOTBALL_FILES,
  OPENFOOTBALL_SEASONS,
  OPENFOOTBALL_SOURCE_PREFIX,
  fileUrl,
  mapStage,
  permalink,
} from "../../../../../scripts/ingest/openfootball/config";
import { competitionSchema } from "../../../../../src/data-model/schemas";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/openfootball");
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("openfootball config", () => {
  it("pins a full commit sha", () => {
    expect(OPENFOOTBALL_COMMIT).toMatch(/^[0-9a-f]{40}$/);
  });

  it("matches the recorded fixtures byte for byte", () => {
    for (const f of OPENFOOTBALL_FILES) {
      const bytes = readFileSync(join(FIXTURES, f.file));
      expect(createHash("sha256").update(bytes).digest("hex"), f.file).toBe(f.sha256);
    }
  });

  it("has one season per file and every season points at a configured competition", () => {
    expect(OPENFOOTBALL_FILES).toHaveLength(8);
    const competitionIds = new Set(OPENFOOTBALL_COMPETITIONS.map((c) => c.id));
    expect(OPENFOOTBALL_SEASONS).toHaveLength(8);
    for (const s of OPENFOOTBALL_SEASONS) {
      expect(competitionIds.has(s.competition_id), s.id).toBe(true);
      expect(
        OPENFOOTBALL_FILES.some((f) => f.file === s.file),
        s.id,
      ).toBe(true);
    }
  });

  it("uses slug ids", () => {
    for (const id of [
      ...OPENFOOTBALL_COMPETITIONS.map((c) => c.id),
      ...OPENFOOTBALL_SEASONS.map((s) => s.id),
    ]) {
      expect(id).toMatch(SLUG);
    }
  });

  it("builds valid competitions with approved flags and permanent Wikipedia sources", () => {
    for (const c of OPENFOOTBALL_COMPETITIONS) {
      expect(() => competitionSchema.parse(c)).not.toThrow();
      expect(c.afa_recognized).toBe(true);
      expect(c.organizer).toBe("AFA");
      expect(c.source).toMatch(/^https:\/\/es\.wikipedia\.org\/w\/index\.php\?title=.+&oldid=\d+$/);
    }
    expect(OPENFOOTBALL_COMPETITIONS.map((c) => [c.id, c.type])).toEqual([
      ["copa-de-la-liga-profesional", "national_cup"],
      ["primera-division", "league"],
    ]);
  });

  it("uses the approved season ids and names", () => {
    expect(OPENFOOTBALL_SEASONS.map((s) => [s.id, s.competition_id, s.name])).toEqual([
      ["primera-division-2018-19", "primera-division", "Superliga 2018-19"],
      ["primera-division-2019-20", "primera-division", "Superliga 2019-20"],
      [
        "copa-de-la-liga-profesional-2020",
        "copa-de-la-liga-profesional",
        "Copa Diego Armando Maradona 2020",
      ],
      ["primera-division-2021", "primera-division", "Liga Profesional 2021"],
      ["primera-division-2022", "primera-division", "Liga Profesional 2022"],
      ["primera-division-2023", "primera-division", "Liga Profesional 2023"],
      ["primera-division-2024", "primera-division", "Liga Profesional 2024"],
      ["primera-division-2025-apertura", "primera-division", "Torneo Apertura 2025"],
    ]);
  });

  it("gives the partial 2025 season a cited end date", () => {
    const s = OPENFOOTBALL_SEASONS.find((x) => x.id === "primera-division-2025-apertura");
    expect(s?.partial).toEqual({ end: "2025-06-01", source: expect.stringContaining("oldid=") });
    expect(OPENFOOTBALL_SEASONS.filter((x) => x.partial)).toHaveLength(1);
  });

  it("builds permalinks inside the owned prefix", () => {
    expect(fileUrl("2024_ar1.txt")).toBe(
      `https://raw.githubusercontent.com/openfootball/south-america/${OPENFOOTBALL_COMMIT}/argentina/2024_ar1.txt`,
    );
    const link = permalink("2024_ar1.txt", 17);
    expect(link).toBe(
      `https://github.com/openfootball/south-america/blob/${OPENFOOTBALL_COMMIT}/argentina/2024_ar1.txt#L17`,
    );
    expect(link.startsWith(OPENFOOTBALL_SOURCE_PREFIX)).toBe(true);
    expect(permalink("2024_ar1.txt")).not.toContain("#");
  });
});

describe("mapStage", () => {
  it.each([
    ["Matchday 7", "Fecha 7", false],
    ["1° Semestre, Matchday 3", "Fecha 3", false],
    ["Group C", "Zona C", false],
    ["Fase Campeón, Gruppe 2", "Fase Campeón, Zona 2", false],
    ["Fase Campeón, Final", "Final", true],
    ["Fase Complementación, Gruppe 1", "Fase Complementación, Zona 1", false],
    ["Fase Complementación, Final", "Fase Complementación, Final", false],
    ["Copa Sud, Final", "Definición Copa Sudamericana", false],
  ])("%s -> %s (final: %s)", (heading, stage, isFinal) => {
    expect(mapStage(heading)).toEqual({ stage, is_final: isFinal });
  });

  it("throws on a heading that is not in the table", () => {
    expect(() => mapStage("Semifinal")).toThrow(/unknown stage heading "Semifinal"/);
  });
});
