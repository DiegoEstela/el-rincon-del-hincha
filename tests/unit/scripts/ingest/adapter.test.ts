import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  directoryLoader,
  runAdapter,
  type Adapter,
  type AdapterOutput,
} from "../../../../scripts/ingest/core/adapter";
import { IngestError } from "../../../../scripts/ingest/core/commit";

const PREFIX = "https://example.org/toy/";
const NOW = new Date("2026-10-17T12:00:00Z");
const club = (id: string) => ({
  id,
  name: id,
  short_name: id,
  aliases: [id],
  colors: { primary: "#112233", secondary: "#445566" },
  jersey_pattern: "solid",
  founded: 1900,
  city: "X",
  source: "https://example.org/club",
});

const toy = (override: Partial<AdapterOutput> = {}): Adapter<string> => ({
  id: "toy",
  sourcePrefix: PREFIX,
  load: (loader) => loader({ name: "toy.txt", url: "https://x/toy.txt", sha256: sha("hello") }),
  normalize: () => ({
    competitions: [
      {
        id: "liga",
        name: "Liga",
        type: "league",
        scope: "domestic",
        organizer: "AFA",
        afa_recognized: true,
        source: "https://example.org/c",
      },
    ],
    seasons: [
      {
        id: "liga-2024",
        competition_id: "liga",
        name: "Liga 2024",
        start: "2024-01-01",
        end: "2024-05-10",
        source: "https://example.org/s",
      },
    ],
    matches: [
      {
        id: "2024-05-10-a-b",
        season_id: "liga-2024",
        date: "2024-05-10",
        home_id: "a",
        away_id: "b",
        home_goals: 1,
        away_goals: 0,
        decision: null,
        home_penalties: null,
        away_penalties: null,
        stage: "Fecha 1",
        is_final: false,
        status: "played",
        source: `${PREFIX}toy.txt#L1`,
        verified: false,
      },
    ],
    report: { files: [] },
    ...override,
  }),
});

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

let dir: string;
let inputs: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "adapter-data-"));
  inputs = mkdtempSync(join(tmpdir(), "adapter-in-"));
  writeFileSync(join(dir, "clubs.json"), JSON.stringify([club("a"), club("b")]));
  writeFileSync(join(inputs, "toy.txt"), "hello");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(inputs, { recursive: true, force: true });
});

describe("directoryLoader", () => {
  const file = { name: "toy.txt", url: "https://x/toy.txt", sha256: sha("hello") };

  it("reads a file and checks its sha256", async () => {
    expect(await directoryLoader(inputs)(file)).toBe("hello");
  });

  it("rejects a file whose content changed", async () => {
    writeFileSync(join(inputs, "toy.txt"), "tampered");
    await expect(directoryLoader(inputs)(file)).rejects.toThrow(/sha256 mismatch/);
  });

  it("names the path when the file is missing", async () => {
    await expect(directoryLoader(join(inputs, "nope"))(file)).rejects.toThrow(
      /toy\.txt.*not found/,
    );
  });
});

describe("runAdapter", () => {
  it("loads, normalizes, merges and writes the three files", async () => {
    const result = await runAdapter(toy(), {
      dir,
      loader: directoryLoader(inputs),
      now: NOW,
      coverageGaps: [],
    });
    expect(result.summary["matches.json"]).toEqual({ added: 1, removed: 0, unchanged: 0 });
    expect(readdirSync(dir).sort()).toEqual([
      "clubs.json",
      "competitions.json",
      "coverage.json",
      "matches.json",
      "seasons.json",
    ]);
    const rerun = await runAdapter(toy(), {
      dir,
      loader: directoryLoader(inputs),
      now: NOW,
      coverageGaps: [],
    });
    expect(rerun.summary["matches.json"]).toEqual({ added: 0, removed: 0, unchanged: 1 });
  });

  it("regenerates coverage.json in the same run, from the data it just merged", async () => {
    await runAdapter(toy(), { dir, loader: directoryLoader(inputs), now: NOW, coverageGaps: [] });
    const rows = JSON.parse(readFileSync(join(dir, "coverage.json"), "utf8")) as {
      club_id: string;
      complete: boolean;
      source: string;
    }[];
    expect(rows.map((r) => [r.club_id, r.complete, r.source])).toEqual([
      ["a", true, "derived:liga-2024..liga-2024"],
      ["b", true, "derived:liga-2024..liga-2024"],
    ]);
  });

  it("writes nothing when a record is malformed, and the validator says why", async () => {
    // deriveCoverage returns null for records that do not parse, so no coverage is derived and
    // the validator in the commit step is the one that rejects the run.
    const bad = { ...toy().normalize("", { clubs: [] }).matches[0], home_goals: "two" };
    await expect(
      runAdapter(toy({ matches: [bad as never] }), {
        dir,
        loader: directoryLoader(inputs),
        now: NOW,
        coverageGaps: [],
      }),
    ).rejects.toThrow(/\[schema\]/);
    expect(readdirSync(dir)).toEqual(["clubs.json"]);
  });

  it("stops, writing nothing, when the coverage cannot be derived", async () => {
    const partial = toy();
    const normalize = partial.normalize;
    partial.normalize = (raw, ctx) => {
      const out = normalize(raw, ctx);
      return { ...out, seasons: out.seasons.map((x) => ({ ...x, end: "2024-12-31" })) };
    };
    await expect(
      runAdapter(partial, { dir, loader: directoryLoader(inputs), now: NOW, coverageGaps: [] }),
    ).rejects.toThrow(/coverage:.*liga-2024.*partial/);
    expect(readdirSync(dir)).toEqual(["clubs.json"]);
  });

  it("does not write in a dry run", async () => {
    await runAdapter(toy(), {
      dir,
      loader: directoryLoader(inputs),
      now: NOW,
      coverageGaps: [],
      dryRun: true,
    });
    expect(readdirSync(dir)).toEqual(["clubs.json"]);
  });

  it("stops on invalid existing JSON before merging", async () => {
    writeFileSync(join(dir, "matches.json"), "{ not json");
    await expect(
      runAdapter(toy(), { dir, loader: directoryLoader(inputs), now: NOW, coverageGaps: [] }),
    ).rejects.toBeInstanceOf(IngestError);
  });

  it("fails when the data directory does not exist", async () => {
    await expect(
      runAdapter(toy(), {
        dir: join(dir, "missing"),
        loader: directoryLoader(inputs),
        now: NOW,
        coverageGaps: [],
      }),
    ).rejects.toThrow(/data directory not found/);
  });

  it("stops on a reference conflict and leaves the files as they were", async () => {
    writeFileSync(
      join(dir, "competitions.json"),
      JSON.stringify([
        {
          id: "liga",
          name: "Liga",
          type: "league",
          scope: "domestic",
          organizer: "AFA",
          afa_recognized: false,
          source: "https://example.org/c",
        },
      ]),
    );
    const before = readFileSync(join(dir, "competitions.json"), "utf8");
    await expect(
      runAdapter(toy(), { dir, loader: directoryLoader(inputs), now: NOW, coverageGaps: [] }),
    ).rejects.toThrow(/differs from the adapter config in: afa_recognized/);
    expect(readFileSync(join(dir, "competitions.json"), "utf8")).toBe(before);
    expect(readdirSync(dir).sort()).toEqual(["clubs.json", "competitions.json"]);
  });
});
