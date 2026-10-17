// Deterministic JSON for a data file (ADR 0015, decision 5): records sorted by key, object keys in
// schema order, Prettier-stable. The only async part is Prettier itself.
import * as prettier from "prettier";
import { FILE_SCHEMAS, recordKey, type DatasetFile } from "../../../src/data-model/schemas";

function compare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Keeps only the schema keys, in schema order, dropping undefined optionals. */
function orderKeys(file: DatasetFile, record: Record<string, unknown>): Record<string, unknown> {
  const shape = (FILE_SCHEMAS[file] as unknown as { shape: Record<string, unknown> }).shape;
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    if (record[key] !== undefined) ordered[key] = record[key];
  }
  return ordered;
}

export async function serializeRecords(
  file: DatasetFile,
  records: readonly unknown[],
): Promise<string> {
  const keyed = records.map((record, index) => {
    const key = recordKey(file, record);
    if (key === null) throw new Error(`${file}: record #${index} has no usable key`);
    return { key, record: orderKeys(file, record as Record<string, unknown>) };
  });
  keyed.sort((a, b) => compare(a.key, b.key));
  for (let i = 1; i < keyed.length; i++) {
    if (keyed[i].key === keyed[i - 1].key) {
      throw new Error(`${file}: duplicate key "${keyed[i].key}"`);
    }
  }
  const json = JSON.stringify(
    keyed.map((k) => k.record),
    null,
    2,
  );
  return prettier.format(json, { parser: "json", printWidth: 100 });
}
