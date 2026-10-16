// Pure dataset validator (plan 0003). No I/O, no clock: `now` is injected.
import { DATASET_FILES, FILE_SCHEMAS, recordKey, type DatasetFile } from "./schemas";
import { checkReferences } from "./rules/references";
import { checkScores } from "./rules/scores";
import { checkDates } from "./rules/dates";
import type { Dataset, ValidationIssue } from "./types";

export type ValidateOptions = { now: Date };

type ShapeResult = {
  dataset: Dataset;
  /** Keys of every record per file, including the ones that failed the shape check. */
  knownKeys: Record<DatasetFile, Set<string>>;
  issues: ValidationIssue[];
};

function emptyDataset(): Dataset {
  return {
    "clubs.json": [],
    "competitions.json": [],
    "seasons.json": [],
    "matches.json": [],
    "titles.json": [],
    "movements.json": [],
    "rivalries.json": [],
    "coverage.json": [],
    "standings.json": [],
  };
}

function shapeStage(raw: Record<string, unknown>): ShapeResult {
  const dataset = emptyDataset();
  const knownKeys = Object.fromEntries(DATASET_FILES.map((f) => [f, new Set<string>()])) as Record<
    DatasetFile,
    Set<string>
  >;
  const issues: ValidationIssue[] = [];

  for (const file of Object.keys(raw)) {
    if (!(file in FILE_SCHEMAS)) {
      issues.push({
        rule: "unknown-file",
        file,
        recordId: null,
        message: `"${file}" is not part of the data model; check the file name.`,
      });
    }
  }

  for (const file of DATASET_FILES) {
    const root = raw[file] === undefined ? [] : raw[file];
    if (!Array.isArray(root)) {
      issues.push({
        rule: "schema",
        file,
        recordId: null,
        message: "Root must be a JSON array of records.",
      });
      continue;
    }
    root.forEach((record: unknown, index) => {
      const key = recordKey(file, record);
      if (key !== null) knownKeys[file].add(key);
      const parsed = FILE_SCHEMAS[file].safeParse(record);
      if (parsed.success) {
        (dataset[file] as unknown[]).push(parsed.data);
        return;
      }
      for (const zodIssue of parsed.error.issues) {
        const isSource = zodIssue.path[0] === "source";
        const path = zodIssue.path.join(".");
        issues.push({
          rule: isSource ? "missing-source" : "schema",
          file,
          recordId: key ?? `#${index}`,
          message: isSource
            ? "`source` is required and must be a non-empty string."
            : `${path === "" ? "(record)" : path}: ${zodIssue.message}`,
        });
      }
    });
  }

  return { dataset, knownKeys, issues };
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort(
    (x, y) =>
      compare(x.file, y.file) ||
      compare(x.recordId ?? "", y.recordId ?? "") ||
      compare(x.rule, y.rule) ||
      compare(x.message, y.message),
  );
}

export function validate(
  raw: Record<string, unknown>,
  options: ValidateOptions,
): ValidationIssue[] {
  const { dataset, knownKeys, issues } = shapeStage(raw);
  issues.push(...checkReferences(dataset, knownKeys));
  issues.push(...checkScores(dataset), ...checkDates(dataset, options.now));
  return sortIssues(issues);
}
