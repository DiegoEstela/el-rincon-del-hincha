// Plan 0017, T23: the RSSSF adapter end to end on real, reduced excerpts, writing into a temporary
// copy of data/. The aliases below are the page spellings of the 2025 clubs; in the real data they
// are added in A2 once Diego approves the list.
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { directoryLoader, runAdapter } from "../../scripts/ingest/core/adapter";
import { IngestError } from "../../scripts/ingest/core/errors";
import { createRsssfAdapter } from "../../scripts/ingest/rsssf";
import type { TournamentConfig } from "../../scripts/ingest/rsssf/config";
import { manifestSchema } from "../../scripts/ingest/rsssf/manifest";
import { OPENFOOTBALL_ONLY_GAPS } from "../fixtures/ingest/openfootball/gaps";

const NOW = new Date("2026-10-20T12:00:00Z");
const FIXTURE = join(process.cwd(), "tests/fixtures/ingest/rsssf/clausura-2025.txt");
const PAGE = "https://www.rsssf.org/tablesa/arg2025.html";
const SLOW = 120_000;

const ALIASES: Record<string, string> = {
  "AA Argentinos Juniors": "argentinos-juniors",
  "CA Aldosivi": "aldosivi",
  "CA Barracas Central": "barracas-central",
  "CA Belgrano": "belgrano",
  "CA Boca Juniors": "boca-juniors",
  "CA Central Córdoba (Sant. Estero)": "central-cordoba-sde",
  "CA Huracán": "huracan",
  "CA Lanús": "lanus",
  "CA River Plate": "river-plate",
  "CA Rosario Central": "rosario-central",
  "CA San Lorenzo de Almagro": "san-lorenzo",
  "CA Talleres": "talleres-cordoba",
  "CA Tigre": "tigre",
  "CA Unión": "union",
  "CA Vélez Sarsfield": "velez-sarsfield",
  "CD Godoy Cruz Antonio Tomba": "godoy-cruz",
  "Club Estudiantes de La Plata": "estudiantes-la-plata",
  "Club de Gimnasia y Esgrima LP": "gimnasia-la-plata",
  "Deportivo Riestra AFBC": "deportivo-riestra",
  "Instituto ACC": "instituto",
  "Racing Club": "racing-club",
};

const excerptBytes = readFileSync(FIXTURE);
const sha = createHash("sha256").update(excerptBytes).digest("hex");

const manifest = manifestSchema.parse({
  version: 1,
  pages: [
    {
      url: PAGE,
      retrieved_on: "2026-10-19",
      sha256: sha,
      bytes: excerptBytes.length,
      encoding: "windows-1252",
      authors: ["Osvaldo José Gorgazzi"],
      last_updated: "7 Oct 2026",
      layout: "full-names-2017",
      excerpts: [
        { name: "1clausura", start: '<a name="1clausura">', end: '<a name="1first">', sha256: sha },
      ],
      ignore: [],
      variants: [],
      tableExceptions: [],
    },
  ],
});

const tournament: TournamentConfig = {
  id: "primera-division-2025-clausura",
  competition_id: "primera-division",
  name: "Torneo Clausura 2025",
  page: "arg2025",
  excerpt: "1clausura",
  window: { from: "2025-07-01", to: "2025-12-31" },
  mode: { kind: "own" },
  // The fixture is a reduced excerpt: its table cannot add up to its few matches.
  tableCoversSeason: false,
};

let dir: string;
let inputs: string;
const read = (file: string) => readFileSync(join(dir, file), "utf8");
const adapter = () => createRsssfAdapter({ tournaments: [tournament], manifest: () => manifest });

/** Clubs with the RSSSF aliases (as in data/) or without them (to see the unknown names). */
function seedClubs(withAliases = true) {
  const clubs = JSON.parse(read("clubs.json")) as { id: string; aliases: string[] }[];
  for (const club of clubs) {
    club.aliases = club.aliases.filter((alias) => ALIASES[alias] !== club.id);
  }
  if (withAliases) {
    for (const [alias, id] of Object.entries(ALIASES)) {
      clubs.find((c) => c.id === id)!.aliases.push(alias);
    }
  }
  writeFileSync(join(dir, "clubs.json"), JSON.stringify(clubs));
}

/** The data before RSSSF: openfootball only, so this test owns every RSSSF record. */
function withoutRsssf() {
  const own = (r: { source: string }) => r.source.startsWith("https://www.rsssf.org/");
  for (const file of ["matches.json", "seasons.json", "titles.json"]) {
    const kept = (JSON.parse(read(file)) as { source: string }[]).filter((r) => !own(r));
    writeFileSync(join(dir, file), JSON.stringify(kept));
  }
  rmSync(join(dir, "standings.json"), { force: true });
  // The cups come from RSSSF only: without their seasons they would have no coverage either.
  const cups = new Set([
    "copa-argentina",
    "supercopa-argentina",
    "supercopa-internacional",
    "trofeo-de-campeones",
  ]);
  const competitions = (JSON.parse(read("competitions.json")) as { id: string }[]).filter(
    (c) => !cups.has(c.id),
  );
  writeFileSync(join(dir, "competitions.json"), JSON.stringify(competitions));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rsssf-data-"));
  inputs = mkdtempSync(join(tmpdir(), "rsssf-in-"));
  cpSync(join(process.cwd(), "data"), dir, { recursive: true });
  withoutRsssf();
  cpSync(FIXTURE, join(inputs, "arg2025.1clausura.txt"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(inputs, { recursive: true, force: true });
});

const run = () =>
  runAdapter(adapter(), {
    dir,
    loader: directoryLoader(inputs),
    now: NOW,
    coverageGaps: OPENFOOTBALL_ONLY_GAPS,
  });

describe("RSSSF ingestion on a real excerpt (T23)", () => {
  it(
    "adds the season and the matches and leaves the openfootball records alone",
    async () => {
      seedClubs();
      const before = JSON.parse(read("matches.json")) as { source: string }[];
      const result = await run();
      expect(result.summary["matches.json"]).toMatchObject({ removed: 0 });
      expect(result.summary["matches.json"].added).toBe(20);

      const after = JSON.parse(read("matches.json")) as { source: string; season_id: string }[];
      const own = after.filter((m) => m.source.startsWith("https://www.rsssf.org/tablesa/"));
      expect(own.every((m) => m.season_id === "primera-division-2025-clausura")).toBe(true);
      expect(after.filter((m) => !m.source.startsWith("https://www.rsssf.org/")).length).toBe(
        before.length,
      );
      const seasons = JSON.parse(read("seasons.json")) as { id: string }[];
      expect(seasons.map((s) => s.id)).toContain("primera-division-2025-clausura");
    },
    SLOW,
  );

  it(
    "gives the same bytes on a second run",
    async () => {
      seedClubs();
      await run();
      const first = ["matches.json", "seasons.json", "coverage.json"].map(read);
      const second = await run();
      expect(second.summary["matches.json"]).toMatchObject({ added: 0, removed: 0 });
      expect(["matches.json", "seasons.json", "coverage.json"].map(read)).toEqual(first);
    },
    SLOW,
  );

  it(
    "stops with the hash message when a byte of the excerpt changes, and writes nothing",
    async () => {
      seedClubs();
      const before = readdirSync(dir).map((f) => [f, read(f)]);
      writeFileSync(
        join(inputs, "arg2025.1clausura.txt"),
        Buffer.concat([excerptBytes, Buffer.from(" ")]),
      );
      await expect(run()).rejects.toThrow(/sha256 mismatch/);
      expect(readdirSync(dir).map((f) => [f, read(f)])).toEqual(before);
    },
    SLOW,
  );

  it(
    "lists every unknown club with the excerpt and line, and writes nothing",
    async () => {
      seedClubs(false);
      const before = read("matches.json");
      const error = await run().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(IngestError);
      const problems = (error as IngestError).problems;
      const unknown = problems.filter((p) => p.startsWith("unknown club"));
      expect(unknown.length).toBeGreaterThan(10);
      expect(unknown[0]).toMatch(/^unknown club ".*" \(first seen at arg2025\.1clausura:\d+\)$/);
      expect(read("matches.json")).toBe(before);
    },
    SLOW,
  );

  it(
    "stops on a season already in data/ with different fields",
    async () => {
      seedClubs();
      const seasons = JSON.parse(read("seasons.json")) as Record<string, unknown>[];
      seasons.push({
        id: "primera-division-2025-clausura",
        competition_id: "primera-division",
        name: "Otro nombre",
        start: "2025-07-11",
        end: "2025-12-14",
        source: "https://example.org/x",
      });
      writeFileSync(join(dir, "seasons.json"), JSON.stringify(seasons));
      await expect(run()).rejects.toThrow(/differs from the adapter config/);
    },
    SLOW,
  );

  it(
    "never writes a record of a competition other than the first division",
    async () => {
      seedClubs();
      await run();
      const seasons = JSON.parse(read("seasons.json")) as {
        id: string;
        competition_id: string;
        source: string;
      }[];
      for (const s of seasons.filter((x) => x.source.startsWith("https://www.rsssf.org/"))) {
        expect(s.competition_id).toBe("primera-division");
      }
    },
    SLOW,
  );

  it("reports a layout without a parser instead of guessing", async () => {
    seedClubs();
    const other = manifestSchema.parse({
      ...manifest,
      pages: [{ ...manifest.pages[0], layout: "plain-2000s" }],
    });
    const guarded = createRsssfAdapter({ tournaments: [tournament], manifest: () => other });
    await expect(
      runAdapter(guarded, { dir, loader: directoryLoader(inputs), now: NOW }),
    ).rejects.toThrow(/no parser yet/);
  });

  it("reports a tournament that is not in the manifest", async () => {
    seedClubs();
    const missing = createRsssfAdapter({
      tournaments: [{ ...tournament, excerpt: "nope" }],
      manifest: () => manifest,
    });
    await expect(
      runAdapter(missing, { dir, loader: directoryLoader(inputs), now: NOW }),
    ).rejects.toThrow(/not in the manifest/);
  });
});
