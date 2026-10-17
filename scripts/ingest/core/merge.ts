// Ownership merge (ADR 0015, decision 3). An adapter owns the matches whose `source` starts with its
// prefix and replaces all of them; competitions and seasons are upserted by id and never overwritten.
import { isDeepStrictEqual } from "node:util";

type Rec = Record<string, unknown>;
export type Existing = Record<string, unknown[] | undefined>;
export type AdapterRecords = { competitions: Rec[]; seasons: Rec[]; matches: Rec[] };
export type MergeResult = { dataset: Record<string, unknown[]>; conflicts: string[] };

function differingFields(a: Rec, b: Rec): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => !isDeepStrictEqual(a[k], b[k])).sort();
}

function upsert(file: string, existing: Rec[], incoming: Rec[], conflicts: string[]): Rec[] {
  const result = [...existing];
  for (const record of incoming) {
    const current = result.find((r) => r.id === record.id);
    if (current === undefined) {
      result.push(record);
    } else if (!isDeepStrictEqual(current, record)) {
      const fields = differingFields(current, record);
      if (fields.length > 0) {
        conflicts.push(
          `${file}#${String(record.id)} differs from the adapter config in: ${fields.join(", ")}`,
        );
      }
    }
  }
  return result;
}

export function mergeDataset(
  existing: Existing,
  records: AdapterRecords,
  sourcePrefix: string,
): MergeResult {
  const conflicts: string[] = [];
  const dataset: Record<string, unknown[]> = {};
  for (const [file, list] of Object.entries(existing)) dataset[file] = [...(list ?? [])];

  dataset["competitions.json"] = upsert(
    "competitions.json",
    (dataset["competitions.json"] ?? []) as Rec[],
    records.competitions,
    conflicts,
  );
  dataset["seasons.json"] = upsert(
    "seasons.json",
    (dataset["seasons.json"] ?? []) as Rec[],
    records.seasons,
    conflicts,
  );
  const kept = ((dataset["matches.json"] ?? []) as Rec[]).filter(
    (m) => !(typeof m.source === "string" && m.source.startsWith(sourcePrefix)),
  );
  dataset["matches.json"] = [...kept, ...records.matches];
  return { dataset, conflicts };
}
