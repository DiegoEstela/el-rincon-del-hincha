import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitDataset } from "../../../../scripts/ingest/core/commit";
import { serializeRecords } from "../../../../scripts/ingest/core/serialize";

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
const competition = {
  id: "liga",
  name: "Liga",
  type: "league",
  scope: "domestic",
  organizer: "AFA",
  afa_recognized: true,
  source: "https://example.org/c",
};
const season = {
  id: "liga-2024",
  competition_id: "liga",
  name: "Liga 2024",
  start: "2024-01-01",
  end: "2024-12-31",
  source: "https://example.org/s",
};
const match = (id: string, home: string, away: string) => ({
  id,
  season_id: "liga-2024",
  date: "2024-05-10",
  home_id: home,
  away_id: away,
  home_goals: 1,
  away_goals: 0,
  decision: null,
  home_penalties: null,
  away_penalties: null,
  stage: "Fecha 1",
  is_final: false,
  status: "played",
  source: "https://example.org/m",
  verified: false,
});

const FILES = ["competitions.json", "seasons.json", "matches.json"] as const;

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "commit-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const valid = (): Record<string, unknown[]> => ({
  "clubs.json": [club("a"), club("b")],
  "competitions.json": [competition],
  "seasons.json": [season],
  "matches.json": [match("2024-05-10-a-b", "a", "b")],
});
const snapshot = () =>
  Object.fromEntries(
    readdirSync(dir).map((f) => [
      f,
      [readFileSync(join(dir, f), "utf8"), statSync(join(dir, f)).mtimeMs],
    ]),
  );
const temps = () => readdirSync(dir).filter((f) => f.includes(".tmp-"));

describe("commitDataset", () => {
  it("rejects invalid data with every issue and leaves the directory untouched", async () => {
    const bad = valid();
    bad["matches.json"] = [match("m1", "a", "ghost"), match("m2", "a", "ghost2")];
    writeFileSync(join(dir, "matches.json"), "[]\n");
    const before = snapshot();
    await expect(commitDataset({ dir, dataset: bad, files: [...FILES], now: NOW })).rejects.toThrow(
      /unknown-club[\s\S]*unknown-club/,
    );
    expect(snapshot()).toEqual(before);
    expect(temps()).toEqual([]);
  });

  it("writes only changed files, with serializer bytes", async () => {
    await commitDataset({ dir, dataset: valid(), files: [...FILES], now: NOW });
    expect(readFileSync(join(dir, "matches.json"), "utf8")).toBe(
      await serializeRecords("matches.json", valid()["matches.json"] as never),
    );
    expect(readdirSync(dir).sort()).toEqual([...FILES].sort());
    const before = snapshot();
    await new Promise((r) => setTimeout(r, 25));
    const summary = await commitDataset({ dir, dataset: valid(), files: [...FILES], now: NOW });
    expect(snapshot()).toEqual(before);
    expect(summary["matches.json"]).toEqual({ added: 0, removed: 0, unchanged: 1 });
  });

  it("counts added and removed records against the file on disk", async () => {
    await commitDataset({ dir, dataset: valid(), files: [...FILES], now: NOW });
    const next = valid();
    next["matches.json"] = [match("2024-05-10-b-a", "b", "a")];
    const summary = await commitDataset({ dir, dataset: next, files: [...FILES], now: NOW });
    expect(summary["matches.json"]).toEqual({ added: 1, removed: 1, unchanged: 0 });
  });

  it("dry run never writes and reports counts", async () => {
    const summary = await commitDataset({
      dir,
      dataset: valid(),
      files: [...FILES],
      now: NOW,
      dryRun: true,
    });
    expect(readdirSync(dir)).toEqual([]);
    expect(summary["matches.json"]).toEqual({ added: 1, removed: 0, unchanged: 0 });
  });

  it("restores the files already replaced when a later rename fails", async () => {
    await commitDataset({ dir, dataset: valid(), files: [...FILES], now: NOW });
    const before = snapshot();
    const next = valid();
    next["seasons.json"] = [{ ...season, name: "Liga 2024 (edited)" }];
    next["matches.json"] = [match("2024-05-10-b-a", "b", "a")];
    await expect(
      commitDataset({
        dir,
        dataset: next,
        files: [...FILES],
        now: NOW,
        rename: (from, to) => {
          if (to.endsWith("matches.json")) throw new Error("disk full");
          renameSync(from, to);
        },
      }),
    ).rejects.toThrow(/disk full/);
    const after = snapshot();
    for (const f of FILES) expect(after[f][0], f).toBe(before[f][0]);
    expect(temps()).toEqual([]);
  });

  it("cleans up temp files when a rename fails", async () => {
    await expect(
      commitDataset({
        dir,
        dataset: valid(),
        files: [...FILES],
        now: NOW,
        rename: (from, to) => {
          if (to.endsWith("seasons.json")) throw new Error("disk full");
          renameSync(from, to);
        },
      }),
    ).rejects.toThrow(/disk full/);
    expect(temps()).toEqual([]);
  });
});
