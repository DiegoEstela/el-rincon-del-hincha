// Pure generator of the coverage table (plan 0014, ADR 0017). The table is derived from the
// seasons and matches we have plus a short list of declared gaps; nobody writes it by hand.
//
// A row `complete: true` over `[from, to]` means: every match of the club in that competition
// dated in the interval is loaded. It is only ever claimed for a run of consecutive seasons that
// are loaded and that the club played (so a season the club missed always breaks the run).
import { nextDay, previousDay } from "./dates";
import type { Coverage, Dataset } from "./types";

export type CoverageGap = {
  competition_id: string;
  from: string;
  /** `null` = open-ended. */
  to: string | null;
  reason: string;
  source: string;
};

export type CoverageInput = Pick<
  Dataset,
  "clubs.json" | "competitions.json" | "seasons.json" | "matches.json"
>;

type Interval = { from: string; to: string; firstSeason: string; lastSeason: string };

/** Same key the data files are sorted by (KEY_FIELDS), so the generator and the file agree. */
function rowKey(r: Coverage): string {
  return `${r.club_id}/${r.competition_id}/${r.from}`;
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Removes the days of `gap` from `interval`: zero, one or two pieces are left. */
function cut(interval: Interval, gap: CoverageGap): Interval[] {
  const gapEnd = gap.to ?? "9999-12-31";
  if (gapEnd < interval.from || gap.from > interval.to) return [interval];
  const pieces: Interval[] = [];
  if (gap.from > interval.from) pieces.push({ ...interval, to: previousDay(gap.from) });
  if (gapEnd < interval.to) pieces.push({ ...interval, from: nextDay(gapEnd) });
  return pieces;
}

export function generateCoverage(input: CoverageInput, gaps: readonly CoverageGap[]): Coverage[] {
  const competitionIds = new Set(input["competitions.json"].map((c) => c.id));
  for (const g of gaps) {
    if (!competitionIds.has(g.competition_id)) {
      throw new Error(`coverage gap names unknown competition "${g.competition_id}"`);
    }
  }

  // Season load: matches per season, who played, and up to which day the data goes.
  const matchesBySeason = new Map<string, { last: string; clubs: Set<string> }>();
  for (const m of input["matches.json"]) {
    const entry = matchesBySeason.get(m.season_id) ?? { last: m.date, clubs: new Set<string>() };
    if (m.date > entry.last) entry.last = m.date;
    entry.clubs.add(m.home_id);
    entry.clubs.add(m.away_id);
    matchesBySeason.set(m.season_id, entry);
  }

  const out: Coverage[] = [];
  const pairsWithRows = new Set<string>();
  const add = (row: Coverage) => {
    out.push(row);
    pairsWithRows.add(`${row.club_id}/${row.competition_id}`);
  };

  for (const competition of input["competitions.json"]) {
    const seasons = input["seasons.json"]
      .filter((s) => s.competition_id === competition.id)
      .sort((a, b) => compare(a.start, b.start) || compare(a.id, b.id));
    const competitionGaps = gaps.filter((g) => g.competition_id === competition.id);
    const loadedSeasons = seasons.filter((s) => matchesBySeason.has(s.id));

    if (loadedSeasons.length === 0 && competitionGaps.length === 0) {
      throw new Error(
        `competition "${competition.id}" has no loaded season and no declared gap; declare what is missing`,
      );
    }

    // A partial season (data stops before its end) needs its missing tail declared as a gap.
    const loadedThrough = new Map<string, string>();
    for (const s of loadedSeasons) {
      const last = matchesBySeason.get(s.id)!.last;
      const through = last >= s.end ? s.end : last;
      loadedThrough.set(s.id, through);
      if (through < s.end) {
        const tailStart = nextDay(through);
        const declared = competitionGaps.some(
          (g) => g.from <= tailStart && (g.to === null || g.to >= s.end),
        );
        if (!declared) {
          throw new Error(
            `season "${s.id}" is partial (data ends ${through}, season ends ${s.end}) and its missing tail is not inside a declared gap`,
          );
        }
      }
    }

    for (const club of input["clubs.json"]) {
      // Runs of consecutive seasons that are loaded and that the club played.
      const intervals: Interval[] = [];
      let run: Interval | null = null;
      for (const s of seasons) {
        const usable = loadedThrough.has(s.id) && matchesBySeason.get(s.id)!.clubs.has(club.id);
        if (!usable) {
          run = null;
          continue;
        }
        if (run === null) {
          run = {
            from: s.start,
            to: loadedThrough.get(s.id)!,
            firstSeason: s.id,
            lastSeason: s.id,
          };
          intervals.push(run);
        } else {
          run.to = loadedThrough.get(s.id)!;
          run.lastSeason = s.id;
        }
      }

      let remaining = intervals;
      for (const g of competitionGaps) remaining = remaining.flatMap((i) => cut(i, g));
      for (const i of remaining) {
        add({
          club_id: club.id,
          competition_id: competition.id,
          from: i.from,
          to: i.to,
          complete: true,
          source: `derived:${i.firstSeason}..${i.lastSeason}`,
        });
      }

      for (const g of competitionGaps) {
        add({
          club_id: club.id,
          competition_id: competition.id,
          from: g.from,
          to: g.to,
          complete: false,
          source: g.source,
        });
      }

      if (!pairsWithRows.has(`${club.id}/${competition.id}`)) {
        add({
          club_id: club.id,
          competition_id: competition.id,
          from: seasons[0].start,
          to: null,
          complete: false,
          source: "derived:no-season-played",
        });
      }
    }
  }

  return out
    .map((r) => ({
      club_id: r.club_id,
      competition_id: r.competition_id,
      from: r.from,
      to: r.to,
      complete: r.complete,
      source: r.source,
    }))
    .sort((a, b) => compare(rowKey(a), rowKey(b)));
}
