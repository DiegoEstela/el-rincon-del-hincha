// Validate-then-write (ADR 0015, decision 4). Nothing is written unless the full next dataset
// passes the same validator as `pnpm data:validate`.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordKey, type DatasetFile } from "../../../src/data-model/schemas";
import { validate } from "../../../src/data-model/validate";
import { serializeRecords } from "./serialize";

export class IngestError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join("\n"));
    this.name = "IngestError";
  }
}

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
  const pending: { path: string; temp: string }[] = [];
  const tempFiles: string[] = [];
  try {
    for (const file of files) {
      const path = join(dir, file);
      const next = serializeRecords(file, dataset[file] ?? []);
      const text = await next;
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
      const before = existsSync(path) ? readFileSync(path, "utf8") : null;
      if (before === text) continue;
      if (!dryRun) {
        const temp = `${path}.tmp-${process.pid}`;
        writeFileSync(temp, text);
        tempFiles.push(temp);
        pending.push({ path, temp });
      }
    }
    for (const { path, temp } of pending) rename(temp, path);
  } finally {
    for (const temp of tempFiles) rmSync(temp, { force: true });
  }
  return summary;
}
