import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IngestError } from "../../../../../scripts/ingest/core/commit";
import {
  OPENFOOTBALL_COMPETITIONS,
  OPENFOOTBALL_FILES,
  OPENFOOTBALL_SEASONS,
  OPENFOOTBALL_SOURCE_PREFIX,
} from "../../../../../scripts/ingest/openfootball/config";
import { normalizeOpenfootball } from "../../../../../scripts/ingest/openfootball/normalize";
import { parseOpenfootball } from "../../../../../scripts/ingest/openfootball/parse";
import { matchSchema, seasonSchema } from "../../../../../src/data-model/schemas";
import {
  FIXTURE_CLUBS,
  MISSING_NAMES,
  REAL_CLUBS,
} from "../../../../fixtures/ingest/openfootball/clubs";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/openfootball");
const text = (file: string) => readFileSync(join(FIXTURES, file), "utf8");
const parsedAll = OPENFOOTBALL_FILES.map((f) => parseOpenfootball(f.file, text(f.file)));
const out = normalizeOpenfootball(parsedAll, FIXTURE_CLUBS);
const byId = new Map(out.matches.map((m) => [m.id, m]));

describe("normalizeOpenfootball: matches", () => {
  it("produces 2435 schema-valid matches", () => {
    expect(out.matches).toHaveLength(2435);
    for (const m of out.matches) expect(() => matchSchema.parse(m)).not.toThrow();
  });

  it("uses source-neutral ids <date>-<home>-<away>", () => {
    for (const m of out.matches) expect(m.id).toBe(`${m.date}-${m.home_id}-${m.away_id}`);
  });

  it("marks every record as an unverified, played match owned by this adapter", () => {
    for (const m of out.matches) {
      expect(m.verified).toBe(false);
      expect(m.status).toBe("played");
      expect(m.source.startsWith(OPENFOOTBALL_SOURCE_PREFIX)).toBe(true);
    }
  });

  it("points each source at the exact line, which names both teams", { timeout: 30_000 }, () => {
    const lineOf = (file: string, n: number) => text(file).split(/\r?\n/)[n - 1];
    for (const m of out.matches) {
      const [, file, n] = /argentina\/(.+)#L(\d+)$/.exec(m.source) ?? [];
      const line = lineOf(file, Number(n));
      const home = FIXTURE_CLUBS.find((c) => c.id === m.home_id)!;
      const away = FIXTURE_CLUBS.find((c) => c.id === m.away_id)!;
      expect(
        home.aliases.some((a) => line.includes(a)),
        m.id,
      ).toBe(true);
      expect(
        away.aliases.some((a) => line.includes(a)),
        m.id,
      ).toBe(true);
    }
  });

  it("matches the ADR 0003 spot checks", () => {
    expect(byId.get("2022-10-23-boca-juniors-independiente")).toMatchObject({
      home_goals: 2,
      away_goals: 2,
    });
    expect(byId.get("2022-10-23-racing-club-river-plate")).toMatchObject({
      home_goals: 1,
      away_goals: 2,
    });
    expect(byId.get("2023-07-15-river-plate-estudiantes-la-plata")).toMatchObject({
      home_goals: 3,
      away_goals: 1,
    });
  });

  it("records the 2020 final decided on penalties", () => {
    const final = out.matches.find((m) => m.decision === "penalties");
    expect(final).toMatchObject({
      home_id: "boca-juniors",
      away_id: "banfield",
      home_goals: 1,
      away_goals: 1,
      home_penalties: 5,
      away_penalties: 3,
      is_final: true,
      stage: "Final",
      season_id: "copa-de-la-liga-profesional-2020",
    });
    expect(out.matches.filter((m) => m.decision !== null)).toHaveLength(1);
  });

  it("includes the two odd 2020 matches without marking them as finals", () => {
    const copaSud = out.matches.find((m) => m.stage === "Definición Copa Sudamericana");
    expect(copaSud).toMatchObject({
      date: "2021-03-31",
      home_id: "velez-sarsfield",
      away_id: "banfield",
      home_goals: 2,
      away_goals: 3,
      is_final: false,
    });
    const complementacion = out.matches.find((m) => m.stage === "Fase Complementación, Final");
    expect(complementacion).toMatchObject({ home_id: "rosario-central", is_final: false });
    expect(out.matches.filter((m) => m.is_final)).toHaveLength(1);
  });

  it("has no penalty fields on ordinary matches", () => {
    for (const m of out.matches.filter((x) => x.decision === null)) {
      expect([m.home_penalties, m.away_penalties]).toEqual([null, null]);
    }
  });
});

describe("normalizeOpenfootball: seasons and competitions", () => {
  it("returns the approved competitions", () => {
    expect(out.competitions).toEqual([...OPENFOOTBALL_COMPETITIONS]);
  });

  it("derives season dates from the matches of each complete file", () => {
    expect(out.seasons).toHaveLength(8);
    for (const s of out.seasons) expect(() => seasonSchema.parse(s)).not.toThrow();
    const get = (id: string) => out.seasons.find((s) => s.id === id)!;
    expect([get("primera-division-2018-19").start, get("primera-division-2018-19").end]).toEqual([
      "2018-08-10",
      "2019-04-07",
    ]);
    expect([get("primera-division-2024").start, get("primera-division-2024").end]).toEqual([
      "2024-05-10",
      "2024-12-16",
    ]);
    expect(get("copa-de-la-liga-profesional-2020").end).toBe("2021-03-31");
  });

  it("uses the file permalink as the season source", () => {
    const s = out.seasons.find((x) => x.id === "primera-division-2022")!;
    expect(s.source).toMatch(/\/argentina\/2022_ar1\.txt$/);
  });

  it("gives the partial 2025 season its cited end and source", () => {
    const s = out.seasons.find((x) => x.id === "primera-division-2025-apertura")!;
    expect(s.start).toBe("2025-01-23");
    expect(s.end).toBe("2025-06-01");
    expect(s.source).toContain("oldid=175770270");
  });

  it("covers every configured season", () => {
    expect(out.seasons.map((s) => s.id).sort()).toEqual(
      OPENFOOTBALL_SEASONS.map((s) => s.id).sort(),
    );
  });
});

describe("normalizeOpenfootball: report", () => {
  it("lists per file the parsed and header counts and marks the partial one", () => {
    expect(out.report.files).toHaveLength(8);
    for (const f of out.report.files) expect(f.parsed).toBe(f.header);
    const partial = out.report.files.filter((f) => f.partial);
    expect(partial).toEqual([
      expect.objectContaining({
        file: "2025_ar1.txt",
        lastSourceDate: "2025-05-04",
        seasonEnd: "2025-06-01",
      }),
    ]);
  });
});

describe("normalizeOpenfootball: unknown clubs", () => {
  it("stops with every unresolved name, sorted, when the real clubs are used", () => {
    expect.assertions(2);
    try {
      normalizeOpenfootball(parsedAll, REAL_CLUBS);
    } catch (e) {
      expect(e).toBeInstanceOf(IngestError);
      const names = (e as IngestError).problems
        .map((p) => /unknown club "(.+?)"/.exec(p)?.[1])
        .filter(Boolean);
      expect(names).toEqual([...MISSING_NAMES]);
    }
  });
});
