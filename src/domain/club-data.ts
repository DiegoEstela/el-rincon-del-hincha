// The slice of the dataset one club needs (plan 0015, ADR 0018): every match of the club, its own
// rows of the other tables and the small tables everyone shares. The server serves it as one JSON
// document per club; the browser rebuilds `StatsData` from one document, or from two for a
// head-to-head. The engine cannot tell a slice from the full dataset, and a test proves it.
import type {
  Club,
  Competition,
  Coverage,
  Match,
  Movement,
  Rivalry,
  Season,
  Title,
} from "@/data-model/types";
import { byDateThenId, compareText } from "./data";
import type { StatsData } from "./types";

export const CLUB_DATA_VERSION = 1;

export type ClubData = Readonly<{
  v: typeof CLUB_DATA_VERSION;
  clubId: string;
  /** The club and every opponent that appears in its matches, sorted by id. */
  clubs: readonly Club[];
  competitions: readonly Competition[];
  seasons: readonly Season[];
  /** Every match of the club (suspended included), by date then id. */
  matches: readonly Match[];
  coverage: readonly Coverage[];
  titles: readonly Title[];
  movements: readonly Movement[];
  rivalries: readonly Rivalry[];
}>;

const byId = <T extends { id: string }>(a: T, b: T) => compareText(a.id, b.id);
const coverageKey = (c: Coverage) => `${c.club_id}/${c.competition_id}/${c.from}`;
const rivalryKey = (r: Rivalry) => `${r.club_a}~${r.club_b}`;

/** Keeps the first record of each key, then sorts. */
function unique<T>(
  records: readonly T[],
  key: (record: T) => string,
  order: (a: T, b: T) => number,
): T[] {
  const seen = new Map<string, T>();
  for (const record of records) if (!seen.has(key(record))) seen.set(key(record), record);
  return [...seen.values()].sort(order);
}

export function sliceClubData(data: StatsData, clubId: string): ClubData {
  if (!data.clubs.some((c) => c.id === clubId)) throw new RangeError("Unknown club.");
  const matches = data.matches
    .filter((m) => m.home_id === clubId || m.away_id === clubId)
    .sort(byDateThenId);
  const wanted = new Set([clubId, ...matches.flatMap((m) => [m.home_id, m.away_id])]);
  return {
    v: CLUB_DATA_VERSION,
    clubId,
    clubs: data.clubs.filter((c) => wanted.has(c.id)).sort(byId),
    competitions: [...data.competitions].sort(byId),
    seasons: [...data.seasons].sort(byId),
    matches,
    coverage: data.coverage
      .filter((c) => c.club_id === clubId)
      .sort((a, b) => compareText(coverageKey(a), coverageKey(b))),
    titles: data.titles.filter((t) => t.club_id === clubId).sort(byId),
    movements: data.movements.filter((m) => m.club_id === clubId).sort(byId),
    rivalries: data.rivalries
      .filter((r) => r.club_a === clubId || r.club_b === clubId)
      .sort((a, b) => compareText(rivalryKey(a), rivalryKey(b))),
  };
}

/** Rebuilds `StatsData` from one or more slices, without duplicates and in a stable order. */
export function statsDataFromClubData(...docs: readonly ClubData[]): StatsData {
  return {
    clubs: unique(
      docs.flatMap((d) => d.clubs),
      (c) => c.id,
      byId,
    ),
    competitions: unique(
      docs.flatMap((d) => d.competitions),
      (c) => c.id,
      byId,
    ),
    seasons: unique(
      docs.flatMap((d) => d.seasons),
      (s) => s.id,
      byId,
    ),
    matches: unique(
      docs.flatMap((d) => d.matches),
      (m) => m.id,
      byDateThenId,
    ),
    coverage: unique(
      docs.flatMap((d) => d.coverage),
      coverageKey,
      (a, b) => compareText(coverageKey(a), coverageKey(b)),
    ),
    titles: unique(
      docs.flatMap((d) => d.titles),
      (t) => t.id,
      byId,
    ),
    movements: unique(
      docs.flatMap((d) => d.movements),
      (m) => m.id,
      byId,
    ),
    rivalries: unique(
      docs.flatMap((d) => d.rivalries),
      rivalryKey,
      (a, b) => compareText(rivalryKey(a), rivalryKey(b)),
    ),
  };
}
