// Ownership merge (ADR 0015, decision 3). An adapter owns the matches whose `source` starts with its
// prefix and replaces all of them; competitions and seasons are upserted by id and never overwritten.
import { isDeepStrictEqual } from "node:util";

type Rec = Record<string, unknown>;
export type Existing = Record<string, unknown[] | undefined>;
export type AdapterRecords = {
  competitions: Rec[];
  seasons: Rec[];
  matches: Rec[];
  /** Replaced by prefix like the matches; a key owned by another prefix is a conflict. */
  standings?: Rec[];
  titles?: Rec[];
};
export type MergeOptions = {
  /**
   * Seasons the adapter may extend: matches dated strictly after the last match of the other
   * source pass. Every other season belongs to one source only (plan 0017, ADR 0020).
   */
  extends?: readonly string[];
};
export type MergeResult = { dataset: Record<string, unknown[]>; conflicts: string[] };

function differingFields(a: Rec, b: Rec): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => !isDeepStrictEqual(a[k], b[k])).sort();
}

function upsert(file: string, existing: Rec[], incoming: Rec[], conflicts: string[]): Rec[] {
  const result = [...existing];
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const record of incoming) {
    const current = byId.get(record.id);
    if (current === undefined) {
      result.push(record);
      byId.set(record.id, record);
    } else {
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

const owns = (record: Rec, prefix: string) =>
  typeof record.source === "string" && record.source.startsWith(prefix);

/** Replaces the records with the prefix; a key already held by another prefix is a conflict. */
function replaceOwned(
  file: string,
  existing: Rec[],
  incoming: Rec[],
  keyOf: (record: Rec) => string,
  prefix: string,
  conflicts: string[],
): Rec[] {
  const kept = existing.filter((r) => !owns(r, prefix));
  const heldBy = new Map(kept.map((r) => [keyOf(r), r]));
  for (const record of incoming) {
    const other = heldBy.get(keyOf(record));
    if (other !== undefined) {
      conflicts.push(
        `${file}#${keyOf(record)} is already owned by ${String(other.source)}; the adapter ${prefix} cannot take it`,
      );
    }
  }
  return [...kept, ...incoming];
}

/** One conflict per season where the adapter writes matches that another source already holds. */
function checkSeasonOwnership(
  kept: Rec[],
  incoming: Rec[],
  prefix: string,
  extendable: ReadonlySet<string>,
  conflicts: string[],
): void {
  const others = new Map<string, Rec[]>();
  for (const m of kept) {
    const list = others.get(String(m.season_id)) ?? [];
    list.push(m);
    others.set(String(m.season_id), list);
  }
  const reported = new Set<string>();
  for (const m of incoming) {
    const season = String(m.season_id);
    const held = others.get(season);
    if (held === undefined || reported.has(season)) continue;
    const last = held.map((h) => String(h.date)).sort()[held.length - 1];
    if (extendable.has(season) && String(m.date) > last) continue;
    reported.add(season);
    const how = extendable.has(season)
      ? `it may only add matches after ${last} (found ${String(m.date)})`
      : "a season has one source only";
    conflicts.push(
      `season ${season}: holds matches of ${String(held[0].source)}, and the adapter ${prefix} brings more; ${how}`,
    );
  }
}

export function mergeDataset(
  existing: Existing,
  records: AdapterRecords,
  sourcePrefix: string,
  options: MergeOptions = {},
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
  const kept = ((dataset["matches.json"] ?? []) as Rec[]).filter((m) => !owns(m, sourcePrefix));
  checkSeasonOwnership(
    kept,
    records.matches,
    sourcePrefix,
    new Set(options.extends ?? []),
    conflicts,
  );
  dataset["matches.json"] = [...kept, ...records.matches];

  if (records.standings !== undefined) {
    dataset["standings.json"] = replaceOwned(
      "standings.json",
      (dataset["standings.json"] ?? []) as Rec[],
      records.standings,
      (r) => `${String(r.club_id)}/${String(r.season_id)}`,
      sourcePrefix,
      conflicts,
    );
  }
  if (records.titles !== undefined) {
    dataset["titles.json"] = replaceOwned(
      "titles.json",
      (dataset["titles.json"] ?? []) as Rec[],
      records.titles,
      (r) => String(r.id),
      sourcePrefix,
      conflicts,
    );
  }
  return { dataset, conflicts };
}
