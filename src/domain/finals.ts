// Methodology: "Finals". A final can have several legs; the winner of the series is the
// shoot-out winner when the last leg went to penalties, otherwise the higher aggregate.
import { compareText, competitionOf, matchesOf } from "./data";
import { passesFilter } from "./history";
import { clubView } from "./match-outcome";
import { inPeriod } from "./period";
import { isRecognized } from "./titles";
import type { FanPeriod, MatchFilter, MatchView, StatsIndex } from "./types";

export type SeriesWinner = "club" | "rival" | null;

export type FinalSeries = Readonly<{
  seasonId: string;
  competitionId: string;
  rivalId: string;
  /** Counted legs (suspended ones ignored), sorted by date then id. */
  legs: readonly MatchView[];
  /** null when undetermined: tied aggregate without a shoot-out. */
  winner: SeriesWinner;
}>;

export type FinalsOptions = MatchFilter &
  Readonly<{
    /** Default false: only finals of recognized competitions. */
    includeUnrecognized?: boolean;
    /** Only the finals against this club. */
    rivalId?: string;
  }>;

/** Winner of a series from the club's view; `legs` must be non-empty and sorted. */
export function seriesWinner(legs: readonly MatchView[]): SeriesWinner {
  const last = legs[legs.length - 1];
  if (last.shootout !== null) return last.shootout === "won" ? "club" : "rival";
  const goalsFor = legs.reduce((sum, leg) => sum + leg.goalsFor, 0);
  const goalsAgainst = legs.reduce((sum, leg) => sum + leg.goalsAgainst, 0);
  if (goalsFor === goalsAgainst) return null;
  return goalsFor > goalsAgainst ? "club" : "rival";
}

/**
 * The final series of a club. A series belongs to the period when its last counted leg is
 * inside it (legs before the period start still decide the winner).
 */
export function finalSeries(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  options: FinalsOptions = {},
): FinalSeries[] {
  const groups = new Map<string, MatchView[]>();
  for (const match of matchesOf(index, clubId)) {
    if (!match.is_final) continue;
    const competition = competitionOf(index, match);
    if (!passesFilter(competition, options)) continue;
    if (options.includeUnrecognized !== true && !isRecognized(competition)) continue;
    const view = clubView(match, clubId, competition.id);
    if (view === null) continue;
    if (options.rivalId !== undefined && view.rivalId !== options.rivalId) continue;
    const key = `${match.season_id}|${view.rivalId}`;
    const legs = groups.get(key);
    if (legs === undefined) groups.set(key, [view]);
    else legs.push(view);
  }
  const series: FinalSeries[] = [];
  for (const legs of groups.values()) {
    const last = legs[legs.length - 1];
    if (!inPeriod(last.match.date, period)) continue;
    series.push({
      seasonId: last.match.season_id,
      competitionId: last.competitionId,
      rivalId: last.rivalId,
      legs,
      winner: seriesWinner(legs),
    });
  }
  return series.sort(
    (a, b) =>
      compareText(a.legs[a.legs.length - 1].match.date, b.legs[b.legs.length - 1].match.date) ||
      compareText(a.seasonId, b.seasonId),
  );
}
