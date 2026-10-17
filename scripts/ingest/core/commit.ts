// Validate-then-write (ADR 0015, decision 4). Nothing is written unless the full next dataset
// passes the same validator as `pnpm data:validate`.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordKey, type DatasetFile } from "../../../src/data-model/schemas";
import { validate } from "../../../src/data-model/validate";
import { IngestError } from "./errors";
import { serializeRecords } from "./serialize";

export { IngestError };

export type FileSummary = { added: number; removed: number; unchanged: number };

export type CommitOptions = {
  dir: string;
  /** The complete next dataset (every file, so cross-file rules can run). */
  dataset: Record<string, unknown[]>;
  /** The files this run is allowed to write. */
  files: DatasetFile[];
  now: Date;
  dryRun?: boolean;
  /** Injectable for failure tests. */
  rename?: (from: string, to: string) => void;
};

function readKeys(file: DatasetFile, path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const keys = new Set<string>();
  if (Array.isArray(parsed)) {
    for (const r of parsed) {
      const key = recordKey(file, r);
      if (key !== null) keys.add(key);
    }
  }
  return keys;
}

type Pending = { path: string; temp: string; previous: string | null };

/** Puts back every file that was already replaced, or removes it if it did not exist before. */
function restore(done: Pending[]): void {
  for (const { path, previous } of done.reverse()) {
    if (previous === null) rmSync(path, { force: true });
    else writeFileSync(path, previous);
  }
}

export async function commitDataset(options: CommitOptions): Promise<Record<string, FileSummary>> {
  const { dir, dataset, files, now, dryRun = false, rename = renameSync } = options;

  const issues = validate(dataset, { now });
  if (issues.length > 0) {
    throw new IngestError(
      issues.map(
        (i) => `[${i.rule}] ${i.file}${i.recordId === null ? "" : `#${i.recordId}`}: ${i.message}`,
      ),
    );
  }

  const summary: Record<string, FileSummary> = {};
  const pending: Pending[] = [];
  try {
    for (const file of files) {
      const path = join(dir, file);
      const text = await serializeRecords(file, dataset[file] ?? []);
      const oldKeys = readKeys(file, path);
      const newKeys = new Set(
        (dataset[file] ?? []).map((r) => recordKey(file, r)).filter((k): k is string => k !== null),
      );
      const unchanged = [...newKeys].filter((k) => oldKeys.has(k)).length;
      summary[file] = {
        added: newKeys.size - unchanged,
        removed: oldKeys.size - unchanged,
        unchanged,
      };
      const previous = existsSync(path) ? readFileSync(path, "utf8") : null;
      if (previous === text || dryRun) continue;
      // Always start from a fresh temp file: `wx` never follows a symlink or reuses a stale file.
      const temp = `${path}.tmp-${process.pid}`;
      rmSync(temp, { force: true });
      writeFileSync(temp, text, { flag: "wx" });
      pending.push({ path, temp, previous });
    }

    const replaced: Pending[] = [];
    try {
      for (const item of pending) {
        rename(item.temp, item.path);
        replaced.push(item);
      }
    } catch (error) {
      restore(replaced);
      throw error;
    }
  } finally {
    for (const { temp } of pending) rmSync(temp, { force: true });
  }
  return summary;
}
