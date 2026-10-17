// The adapter contract (ADR 0015, decision 1) and the orchestration shared by every source:
// load -> normalize -> merge -> validate -> write. Adapters are pure; all I/O goes through here.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { clubSchema, DATASET_FILES, type DatasetFile } from "../../../src/data-model/schemas";
import type { Club, Competition, Match, Season } from "../../../src/data-model/types";
import { commitDataset, type FileSummary } from "./commit";
import { IngestError } from "./errors";
import { mergeDataset } from "./merge";
import { checkSha256, fetchPinned, type SourceFile } from "./pinned-fetch";

export type FileReport = {
  file: string;
  /** Matches parsed and matches the header announced (they are equal when the run succeeds). */
  parsed: number;
  header: number;
  first: string;
  last: string;
  partial: boolean;
  lastSourceDate: string;
  seasonEnd: string;
};

export type RunReport = { files: FileReport[] };

export type AdapterOutput = {
  competitions: Competition[];
  seasons: Season[];
  matches: Match[];
  report: RunReport;
};

/** Reads one pinned input file as text, verifying its sha256. */
export type SourceLoader = (file: SourceFile) => Promise<string>;

export type Adapter<Raw> = {
  id: string;
  /** Matches whose `source` starts with this are owned (replaced) by the adapter. */
  sourcePrefix: string;
  load(loader: SourceLoader): Promise<Raw>;
  /** Pure: no I/O, no clock. Throws IngestError for problems the data owner must fix. */
  normalize(raw: Raw, ctx: { clubs: readonly Club[] }): AdapterOutput;
};

export const networkLoader: SourceLoader = (file) => fetchPinned(file);

/** Reads `<dir>/<file.name>` and checks it against the pinned sha256, like the network loader. */
export function directoryLoader(dir: string): SourceLoader {
  return async (file) => {
    const path = join(dir, file.name);
    if (!existsSync(path)) throw new Error(`${file.name}: file not found at ${path}`);
    const bytes = readFileSync(path);
    checkSha256(file, bytes);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  };
}

export type RunOptions = {
  /** The `data/` directory to read and (unless dryRun) write. */
  dir: string;
  loader: SourceLoader;
  now: Date;
  dryRun?: boolean;
};

export type RunResult = { report: RunReport; summary: Record<string, FileSummary> };

function readDataset(dir: string): Record<string, unknown[]> {
  const dataset: Record<string, unknown[]> = {};
  if (!existsSync(dir)) throw new Error(`data directory not found: ${dir}`);
  const present = new Set(readdirSync(dir));
  for (const file of DATASET_FILES) {
    if (!present.has(file)) continue;
    const text = readFileSync(join(dir, file), "utf8").replace(/^﻿/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new IngestError([`${file}: invalid JSON (${(e as Error).message})`]);
    }
    if (!Array.isArray(parsed)) throw new IngestError([`${file}: root must be an array`]);
    dataset[file] = parsed;
  }
  return dataset;
}

export async function runAdapter<Raw>(
  adapter: Adapter<Raw>,
  options: RunOptions,
): Promise<RunResult> {
  const { dir, loader, now, dryRun = false } = options;
  const existing = readDataset(dir);

  const clubs = (existing["clubs.json"] ?? []).map((c, i) => {
    const parsed = clubSchema.safeParse(c);
    if (!parsed.success) {
      throw new IngestError([`clubs.json: record #${i} is invalid; run pnpm data:validate`]);
    }
    return parsed.data;
  });

  const raw = await adapter.load(loader);
  const output = adapter.normalize(raw, { clubs });

  const merged = mergeDataset(
    existing,
    { competitions: output.competitions, seasons: output.seasons, matches: output.matches },
    adapter.sourcePrefix,
  );
  if (merged.conflicts.length > 0) throw new IngestError(merged.conflicts);

  const files: DatasetFile[] = ["competitions.json", "seasons.json", "matches.json"];
  const summary = await commitDataset({ dir, dataset: merged.dataset, files, now, dryRun });
  return { report: output.report, summary };
}
