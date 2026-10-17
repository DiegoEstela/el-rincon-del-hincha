// Club-name resolution for adapters (ADR 0012, ADR 0015 decision 6). Collects every problem of a
// run so the report lists all of them at once. Names are never guessed.
import { resolveClubId, type ClubAliases } from "../../../src/data-model/club-aliases";

export type NameLocation = { file: string; line: number; season: string };

export type ClubResolver = {
  /** Club id for a source spelling, or null (and recorded as a problem) when it is unknown. */
  resolve(name: string, at: NameLocation): string | null;
  /** Every problem found so far, sorted and de-duplicated. */
  problems(): string[];
};

export function createClubResolver(clubs: readonly ClubAliases[]): ClubResolver {
  const unknown = new Map<string, NameLocation>();
  // season -> club id -> distinct source spellings seen
  const bySeason = new Map<string, Map<string, Set<string>>>();

  return {
    resolve(name, at) {
      const id = resolveClubId(clubs, name);
      if (id === null) {
        if (!unknown.has(name)) unknown.set(name, at);
        return null;
      }
      const spellings = bySeason.get(at.season) ?? new Map<string, Set<string>>();
      bySeason.set(at.season, spellings);
      const names = spellings.get(id) ?? new Set<string>();
      spellings.set(id, names);
      names.add(name.normalize("NFC").trim());
      return id;
    },
    problems() {
      const list: string[] = [];
      for (const [name, at] of unknown) {
        list.push(`unknown club "${name}" (first seen at ${at.file}:${at.line})`);
      }
      for (const [season, ids] of bySeason) {
        for (const [id, names] of ids) {
          if (names.size < 2) continue;
          const [first, second] = [...names].sort();
          list.push(
            `season ${season}: "${first}" and "${second}" both resolve to the club "${id}"`,
          );
        }
      }
      return list.sort();
    },
  };
}
