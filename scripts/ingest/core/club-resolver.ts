// Club-name resolution for adapters (ADR 0012, ADR 0015 decision 6). Collects every problem of a
// run so the report lists all of them at once. Names are never guessed.
import { resolveClubId, type ClubAliases } from "../../../src/data-model/club-aliases";

export type NameLocation = {
  file: string;
  line: number;
  season: string;
  /** Where the name appears ("matches", "table"): the same-season check runs per context. */
  context?: string;
};

export type ResolverOptions = {
  /** Reviewed pairs of spellings of one club that really appear together in a season. */
  variants?: readonly (readonly [string, string])[];
};

export type ClubResolver = {
  /** Club id for a source spelling, or null (and recorded as a problem) when it is unknown. */
  resolve(name: string, at: NameLocation): string | null;
  /** Every problem found so far, sorted and de-duplicated. */
  problems(): string[];
};

const norm = (name: string) => name.normalize("NFC").trim();
const pairKey = (a: string, b: string) => [a, b].sort().join("\u0000");

export function createClubResolver(
  clubs: readonly ClubAliases[],
  options: ResolverOptions = {},
): ClubResolver {
  const allowed = new Set((options.variants ?? []).map(([a, b]) => pairKey(norm(a), norm(b))));
  const unknown = new Map<string, NameLocation>();
  // season + context -> club id -> distinct source spellings seen
  const bySeason = new Map<string, { season: string; ids: Map<string, Set<string>> }>();

  return {
    resolve(name, at) {
      const id = resolveClubId(clubs, name);
      if (id === null) {
        if (!unknown.has(name)) unknown.set(name, at);
        return null;
      }
      const key = `${at.season}\u0000${at.context ?? ""}`;
      const bucket = bySeason.get(key) ?? { season: at.season, ids: new Map() };
      bySeason.set(key, bucket);
      const names = bucket.ids.get(id) ?? new Set<string>();
      bucket.ids.set(id, names);
      names.add(norm(name));
      return id;
    },
    problems() {
      const list: string[] = [];
      for (const [name, at] of unknown) {
        list.push(`unknown club "${name}" (first seen at ${at.file}:${at.line})`);
      }
      for (const { season, ids } of bySeason.values()) {
        for (const [id, names] of ids) {
          const sorted = [...names].sort();
          // Every pair of spellings must be a reviewed variant; report the first pair that is not.
          const bad = sorted.flatMap((a, i) =>
            sorted
              .slice(i + 1)
              .filter((b) => !allowed.has(pairKey(a, b)))
              .map((b) => [a, b] as const),
          )[0];
          if (bad !== undefined) {
            list.push(
              `season ${season}: "${bad[0]}" and "${bad[1]}" both resolve to the club "${id}"`,
            );
          }
        }
      }
      return [...new Set(list)].sort();
    },
  };
}
