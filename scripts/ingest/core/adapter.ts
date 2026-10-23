// The adapter contract (ADR 0015, decision 1) and the orchestration shared by every source:
// load -> normalize -> merge -> validate -> write. Adapters are pure; all I/O goes through here.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { COVERAGE_GAPS } from "../../../src/data-model/coverage-gaps";
import type { CoverageGap } from "../../../src/data-model/coverage-generate";
import { clubSchema, DATASET_FILES, type DatasetFile } from "../../../src/data-model/schemas";
import type {
  Club,
  Competition,
  Match,
  Season,
  Standing,
  Title,
} from "../../../src/data-model/types";
import { deriveCoverage } from "../../lib/coverage-file";
import { commitDataset, type FileSummary } from "./commit";
import { IngestError } from "./errors";
import { mergeDataset } from "./merge";
import { decodeSource, fetchPinned, type FetchOptions, type SourceFile } from "./pinned-fetch";

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
  /** Final tables and titles (plan 0017): written only when the adapter brings them. */
  standings?: Standing[];
  titles?: Title[];
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
  normalize(
    raw: Raw,
    ctx: { clubs: readonly Club[]; existing: Readonly<Record<string, unknown[]>> },
  ): AdapterOutput;
  /** Directory of the pinned input files read when neither `--from` nor `--network` is given. */
  defaultInputDir?: string;
  /** Network loader with the hosts and the size cap of this adapter (default: the generic one). */
  networkLoader?: SourceLoader;
  /** Seasons the adapter may extend after another source last match (ADR 0020, decision 5). */
  extends?: readonly string[];
  /** Seasons another source extends: this adapter is their base (see mergeDataset). */
  extendedBy?: readonly string[];
  /** Read-only comparison with the data already in `data/`; returns the lines of a report. */
  crossCheck?(
    raw: Raw,
    ctx: { clubs: readonly Club[]; dataset: Record<string, unknown[]> },
  ): string[];
};

export const networkLoader: SourceLoader = (file) => fetchPinned(file);

/** A network loader with the hosts and the size cap of one adapter (plan 0017). */
export function networkLoaderFor(options: FetchOptions): SourceLoader {
  return (file) => fetchPinned(file, options);
}

/** Reads `<dir>/<file.name>` and checks it against the pinned sha256, like the network loader. */
export function directoryLoader(dir: string): SourceLoader {
  return async (file) => {
    const path = join(dir, file.name);
    if (!existsSync(path)) throw new Error(`${file.name}: file not found at ${path}`);
    return decodeSource(file, readFileSync(path));
  };
}

export type RunOptions = {
  /** The `data/` directory to read and (unless dryRun) write. */
  dir: string;
  loader: SourceLoader;
  now: Date;
  dryRun?: boolean;
  /** Declared coverage gaps (plan 0014). Defaults to the reviewed list of the project. */
  coverageGaps?: readonly CoverageGap[];
  /** Run the adapter cross-check report instead of writing anything. */
  crossCheck?: boolean;
};

export type RunResult = {
  report: RunReport;
  summary: Record<string, FileSummary>;
  /** Lines of the cross-check report, only in cross-check mode. */
  crossCheck?: string[];
};

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
  const { dir, loader, now, dryRun = false, coverageGaps = COVERAGE_GAPS } = options;
  const existing = readDataset(dir);

  const clubs = (existing["clubs.json"] ?? []).map((c, i) => {
    const parsed = clubSchema.safeParse(c);
    if (!parsed.success) {
      throw new IngestError([`clubs.json: record #${i} is invalid; run pnpm data:validate`]);
    }
    return parsed.data;
  });

  const raw = await adapter.load(loader);
  if (options.crossCheck === true) {
    if (adapter.crossCheck === undefined) {
      throw new IngestError([`adapter ${adapter.id} has no cross-check report`]);
    }
    const lines = adapter.crossCheck(raw, { clubs, dataset: existing });
    return { report: { files: [] }, summary: {}, crossCheck: lines };
  }
  const output = adapter.normalize(raw, { clubs, existing });

  const merged = mergeDataset(
    existing,
    {
      competitions: output.competitions,
      seasons: output.seasons,
      matches: output.matches,
      standings: output.standings,
      titles: output.titles,
    },
    adapter.sourcePrefix,
    { extends: adapter.extends, extendedBy: adapter.extendedBy },
  );
  if (merged.conflicts.length > 0) throw new IngestError(merged.conflicts);

  const files: DatasetFile[] = ["competitions.json", "seasons.json", "matches.json"];
  if (output.standings !== undefined) files.push("standings.json");
  if (output.titles !== undefined) files.push("titles.json");
  // Coverage is derived from what was just merged and written in the same validated commit, so it
  // can never lag behind the matches (ADR 0017). `null` = an input does not parse; the validator
  // reports that, and nothing is written.
  const coverage = deriveCoverage(merged.dataset, coverageGaps);
  if (coverage !== null) {
    merged.dataset["coverage.json"] = coverage;
    files.push("coverage.json");
  }
  const summary = await commitDataset({ dir, dataset: merged.dataset, files, now, dryRun });
  return { report: output.report, summary };
}
