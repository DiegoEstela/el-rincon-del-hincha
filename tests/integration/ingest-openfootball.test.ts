import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as prettier from "prettier";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { directoryLoader, runAdapter } from "../../scripts/ingest/core/adapter";
import { IngestError } from "../../scripts/ingest/core/commit";
import {
  OPENFOOTBALL_COMPETITIONS,
  OPENFOOTBALL_FILES,
  OPENFOOTBALL_SEASONS,
} from "../../scripts/ingest/openfootball/config";
import { createOpenfootballAdapter, openfootballAdapter } from "../../scripts/ingest/openfootball";
import { validate } from "../../src/data-model/validate";
import {
  CLUBS_WITHOUT_COLON,
  COLON_SPELLING,
  FIXTURE_CLUBS,
} from "../fixtures/ingest/openfootball/clubs";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/openfootball");
const NOW = new Date("2026-10-17T12:00:00Z");
// Each run formats about 2,400 records with Prettier, which is slow under a loaded CI runner.
const SLOW = 60_000;

let dir: string;
let inputs: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "of-data-"));
  inputs = mkdtempSync(join(tmpdir(), "of-in-"));
  cpSync(FIXTURES, inputs, { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(inputs, { recursive: true, force: true });
});

const seedClubs = (clubs: unknown[]) =>
  writeFileSync(join(dir, "clubs.json"), JSON.stringify(clubs));
const read = (name: string) => readFileSync(join(dir, name), "utf8");
const snapshot = () =>
  Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(join(dir, f), "utf8")]));
const run = (adapter = openfootballAdapter) =>
  runAdapter(adapter, { dir, loader: directoryLoader(inputs), now: NOW });

describe("openfootball ingestion on fixtures (T16)", () => {
  it(
    "writes a valid dataset, idempotently, keeping foreign records",
    async () => {
      seedClubs(FIXTURE_CLUBS);
      await run();

      const files = Object.fromEntries(
        ["clubs.json", "competitions.json", "seasons.json", "matches.json"].map((f) => [
          f,
          JSON.parse(read(f)) as unknown[],
        ]),
      );
      expect(validate(files, { now: NOW })).toEqual([]);
      expect(files["competitions.json"]).toHaveLength(OPENFOOTBALL_COMPETITIONS.length);
      expect(files["seasons.json"]).toHaveLength(OPENFOOTBALL_SEASONS.length);
      expect(files["matches.json"]).toHaveLength(2435);

      // A match from another source, on a day when Boca does not play, must survive every run.
      const matches = files["matches.json"] as {
        date: string;
        season_id: string;
        home_id: string;
        away_id: string;
      }[];
      const busy = new Set(
        matches
          .filter((m) => m.home_id === "boca-juniors" || m.away_id === "boca-juniors")
          .map((m) => m.date),
      );
      const date = ["2021-07-20", "2021-07-21", "2021-07-22", "2021-07-23"].find(
        (d) => !busy.has(d),
      )!;
      const foreign = {
        id: `${date}-boca-juniors-river-plate`,
        season_id: "primera-division-2021",
        date,
        home_id: "boca-juniors",
        away_id: "river-plate",
        home_goals: 0,
        away_goals: 0,
        decision: null,
        home_penalties: null,
        away_penalties: null,
        stage: "Amistoso",
        is_final: false,
        status: "played",
        source: "https://example.org/other-source",
        verified: true,
      };
      const merged = [...matches, foreign];
      writeFileSync(join(dir, "matches.json"), JSON.stringify(merged));

      const second = await run();
      expect(second.summary["matches.json"]).toMatchObject({ added: 0, removed: 0 });
      const afterSecond = snapshot();
      const third = await run();
      expect(third.summary["matches.json"]).toMatchObject({ added: 0, removed: 0 });
      expect(snapshot()).toEqual(afterSecond);
      expect(
        (JSON.parse(read("matches.json")) as { id: string }[]).some((m) => m.id === foreign.id),
      ).toBe(true);
    },
    SLOW,
  );

  it(
    "produces byte-identical files on two clean runs and Prettier leaves them alone",
    async () => {
      seedClubs(FIXTURE_CLUBS);
      await run();
      const first = snapshot();
      rmSync(join(dir, "matches.json"));
      rmSync(join(dir, "seasons.json"));
      rmSync(join(dir, "competitions.json"));
      await run();
      expect(snapshot()).toEqual(first);
      for (const f of ["competitions.json", "seasons.json", "matches.json"]) {
        expect(await prettier.check(read(f), { parser: "json", printWidth: 100 }), f).toBe(true);
      }
    },
    SLOW,
  );
});

describe("failures leave data untouched (T17)", () => {
  it("rejects a truncated input file", async () => {
    seedClubs(FIXTURE_CLUBS);
    truncateSync(join(inputs, "2022_ar1.txt"), 5000);
    const before = snapshot();
    await expect(run()).rejects.toThrow(/2022_ar1\.txt: sha256 mismatch/);
    expect(snapshot()).toEqual(before);
  });

  it("rejects a file whose header disagrees with its content, even with a refreshed hash", async () => {
    seedClubs(FIXTURE_CLUBS);
    const path = join(inputs, "2024_ar1.txt");
    const edited = readFileSync(path, "utf8").replace("# Matches    378", "# Matches    377");
    writeFileSync(path, edited);
    const config = {
      files: OPENFOOTBALL_FILES.map((f) =>
        f.file === "2024_ar1.txt"
          ? { ...f, sha256: createHash("sha256").update(edited).digest("hex") }
          : f,
      ),
      competitions: OPENFOOTBALL_COMPETITIONS,
      seasons: OPENFOOTBALL_SEASONS,
    };
    const before = snapshot();
    await expect(run(createOpenfootballAdapter(config))).rejects.toThrow(
      /2024_ar1\.txt:1: matches: header says 377, parsed 378/,
    );
    expect(snapshot()).toEqual(before);
  });

  it("lists exactly the unresolved club names when a club is missing", async () => {
    seedClubs(CLUBS_WITHOUT_COLON);
    const before = snapshot();
    const error = await run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(IngestError);
    const names = (error as IngestError).problems.map((p) => /"(.+?)"/.exec(p)?.[1]);
    expect(names).toEqual([COLON_SPELLING]);
    expect(snapshot()).toEqual(before);
  });

  it("stops on a competition that differs from the approved config", async () => {
    seedClubs(FIXTURE_CLUBS);
    writeFileSync(
      join(dir, "competitions.json"),
      JSON.stringify([{ ...OPENFOOTBALL_COMPETITIONS[1], afa_recognized: false }]),
    );
    const before = snapshot();
    await expect(run()).rejects.toThrow(
      /competitions\.json#primera-division differs.*afa_recognized/,
    );
    expect(snapshot()).toEqual(before);
  });

  it("stops on an invalid existing matches.json before merging", async () => {
    seedClubs(FIXTURE_CLUBS);
    writeFileSync(join(dir, "matches.json"), "[ not json");
    const before = snapshot();
    await expect(run()).rejects.toThrow(/matches\.json: invalid JSON/);
    expect(snapshot()).toEqual(before);
  });
});
