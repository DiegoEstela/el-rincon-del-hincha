import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  directoryLoader,
  networkLoader,
  runAdapter,
  type Adapter,
  type AdapterOutput,
} from "../../../../scripts/ingest/core/adapter";
import { IngestError } from "../../../../scripts/ingest/core/commit";
import { chooseLoader } from "../../../../scripts/ingest/loader-choice";

const PREFIX = "https://example.org/toy/";
const NOW = new Date("2026-10-17T12:00:00Z");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
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
const match = (id: string, date: string, source = `${PREFIX}toy.txt#L1`) => ({
  id,
  season_id: "liga-2024",
  date,
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
  source,
  verified: false,
});

const base = (): AdapterOutput => ({
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
  matches: [match("2024-05-10-a-b", "2024-05-10") as never],
  report: { files: [] },
});

const toy = (
  output: Partial<AdapterOutput> = {},
  extra: Partial<Adapter<string>> = {},
): Adapter<string> => ({
  id: "toy",
  sourcePrefix: PREFIX,
  load: (loader) => loader({ name: "toy.txt", url: "https://x/toy.txt", sha256: sha("hello") }),
  normalize: () => ({ ...base(), ...output }),
  ...extra,
});

let dir: string;
let inputs: string;
const read = (file: string) => readFileSync(join(dir, file), "utf8");
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "contract-data-"));
  inputs = mkdtempSync(join(tmpdir(), "contract-in-"));
  writeFileSync(join(dir, "clubs.json"), JSON.stringify([club("a"), club("b")]));
  writeFileSync(join(inputs, "toy.txt"), "hello");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(inputs, { recursive: true, force: true });
});

const run = (adapter: Adapter<string>, options: Record<string, unknown> = {}) =>
  runAdapter(adapter, {
    dir,
    loader: directoryLoader(inputs),
    now: NOW,
    coverageGaps: [],
    ...options,
  });

describe("standings and titles in the contract (plan 0017, T8)", () => {
  const standing = {
    club_id: "a",
    season_id: "liga-2024",
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    source: `${PREFIX}toy.txt#table`,
  };
  const title = {
    id: "liga-2024-a",
    club_id: "a",
    competition_id: "liga",
    season_id: "liga-2024",
    awarded_on: "2024-05-10",
    shared: false,
    source: `${PREFIX}toy.txt#champion`,
    verified: false,
  };

  it("writes standings.json and titles.json only when the adapter brings them", async () => {
    await run(toy());
    expect(readdirSync(dir)).not.toContain("standings.json");
    expect(readdirSync(dir)).not.toContain("titles.json");
    await run(toy({ standings: [standing], titles: [title] }));
    expect(JSON.parse(read("standings.json"))).toHaveLength(1);
    expect(JSON.parse(read("titles.json"))).toHaveLength(1);
  });

  it("validates them with the rest: an invalid standing writes nothing", async () => {
    const bad = { ...standing, club_id: "nope" };
    await expect(run(toy({ standings: [bad] }))).rejects.toBeInstanceOf(IngestError);
    expect(readdirSync(dir)).toEqual(["clubs.json"]);
  });

  it("passes the extends seasons to the merge", async () => {
    writeFileSync(
      join(dir, "matches.json"),
      JSON.stringify([match("2024-05-03-a-b", "2024-05-03", "https://example.org/other/x")]),
    );
    await expect(run(toy())).rejects.toThrow(/season liga-2024/);
    const result = await run(toy({}, { extends: ["liga-2024"] }));
    expect(result.summary["matches.json"].added).toBe(1);
  });
});

describe("cross-check mode (plan 0017, T8)", () => {
  it("calls the report hook with the existing dataset and writes nothing", async () => {
    let seen: Record<string, unknown[]> | undefined;
    const adapter = toy(
      {},
      {
        crossCheck: (_raw, ctx) => {
          seen = ctx.dataset;
          return ["only in a: 1"];
        },
      },
    );
    const result = await run(adapter, { crossCheck: true });
    expect(result.crossCheck).toEqual(["only in a: 1"]);
    expect(Object.keys(seen ?? {})).toContain("clubs.json");
    expect(readdirSync(dir)).toEqual(["clubs.json"]);
  });

  it("fails clearly when the adapter has no cross-check", async () => {
    await expect(run(toy(), { crossCheck: true })).rejects.toThrow(/no cross-check/);
  });
});

describe("chooseLoader (plan 0017, T8)", () => {
  const withDefault = toy({}, { defaultInputDir: inputsPlaceholder() });
  function inputsPlaceholder() {
    return "sources/toy";
  }

  it("uses --from when given", async () => {
    const loader = chooseLoader(toy(), { from: inputs, network: false });
    expect(await loader({ name: "toy.txt", url: "https://x", sha256: sha("hello") })).toBe("hello");
  });

  it("uses the default input directory of the adapter without flags", () => {
    const loader = chooseLoader(withDefault, { network: false });
    expect(loader).not.toBe(networkLoader);
  });

  it("uses the network loader of the adapter, or the generic one, with --network or no default", () => {
    const own = async () => "x";
    expect(chooseLoader(toy({}, { networkLoader: own }), { network: true })).toBe(own);
    expect(chooseLoader(withDefault, { network: true })).toBe(networkLoader);
    expect(chooseLoader(toy(), { network: false })).toBe(networkLoader);
  });

  it("rejects --from together with --network", () => {
    expect(() => chooseLoader(toy(), { from: inputs, network: true })).toThrow(/--from/);
  });
});
