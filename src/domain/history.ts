// Methodology: "Match result", "Balance", "Suspended matches", "Administrative results".
import type { Competition, Match } from "@/data-model/types";
import { coverageNotice, overlapsPeriod } from "./coverage-notice";
import { competitionById, competitionOf, matchesOf } from "./data";
import { clubView, opponentOf } from "./match-outcome";
import { inPeriod } from "./period";
import type {
  CoverageNotice,
  FanPeriod,
  HistoryRecord,
  MatchFilter,
  MatchView,
  StatsIndex,
} from "./types";

/** True when the competition passes the (optional) id and type filters. */
export function passesFilter(competition: Competition, filter: MatchFilter): boolean {
  return (
    (filter.competitionIds === undefined || filter.competitionIds.includes(competition.id)) &&
    (filter.competitionTypes === undefined || filter.competitionTypes.includes(competition.type))
  );
}

export type ViewSelection = MatchFilter &
  Readonly<{
    /** Only the matches against this club. */
    rivalId?: string;
  }>;

/**
 * The counted matches of a club inside the period (and selection), sorted by date then id,
 * plus the suspended matches that were left out.
 */
export function selectViews(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  selection: ViewSelection = {},
): Readonly<{ views: readonly MatchView[]; suspended: readonly Match[] }> {
  const views: MatchView[] = [];
  const suspended: Match[] = [];
  for (const match of matchesOf(index, clubId)) {
    if (!inPeriod(match.date, period)) continue;
    if (selection.rivalId !== undefined && opponentOf(match, clubId) !== selection.rivalId) {
      continue;
    }
    const competition = competitionOf(index, match);
    if (!passesFilter(competition, selection)) continue;
    if (match.status === "suspended") {
      suspended.push(match);
      continue;
    }
    const view = clubView(match, clubId, competition.id);
    if (view !== null) views.push(view);
  }
  return { views, suspended };
}

export function tallyMatches(
  views: readonly MatchView[],
  suspendedExcluded: number,
): HistoryRecord {
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const shootouts = { played: 0, won: 0, lost: 0 };
  const administrativeIds: string[] = [];
  for (const view of views) {
    if (view.outcome === "W") won += 1;
    else if (view.outcome === "D") drawn += 1;
    else lost += 1;
    goalsFor += view.goalsFor;
    goalsAgainst += view.goalsAgainst;
    if (view.shootout !== null) {
      shootouts.played += 1;
      shootouts[view.shootout] += 1;
    }
    if (view.isAdministrative) administrativeIds.push(view.match.id);
  }
  return {
    played: views.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    balance: won - lost,
    shootouts,
    administrative: { count: administrativeIds.length, matchIds: administrativeIds },
    suspendedExcluded,
  };
}

/**
 * Competitions the coverage notice talks about, the union of:
 * 1. competitions with counted matches in the period;
 * 2. competitions with a coverage row of any club involved that overlaps the period;
 * 3. competitions with a season overlapping the period in which a club involved has any
 *    coverage row (any dates) or any match (any season).
 * A row that ended before the period means the ingestion stopped, not that the competition is
 * irrelevant, so set 3 reports it (as missing unless a complete row covers the period). A club
 * that left a competition (relegation) gets a safe false warning for it. Competitions where no
 * club involved has any row or match stay unlisted. Restricted by the filter afterwards. An
 * empty period overlaps nothing.
 */
export function relevantCompetitionIds(
  index: StatsIndex,
  clubIds: readonly string[],
  period: FanPeriod,
  views: readonly MatchView[],
  filter: MatchFilter,
): string[] {
  const ids = new Set<string>(views.map((view) => view.competitionId));
  for (const row of index.data.coverage) {
    if (clubIds.includes(row.club_id) && overlapsPeriod(row, period)) {
      ids.add(row.competition_id);
    }
  }
  const known = new Set<string>();
  for (const row of index.data.coverage) {
    if (clubIds.includes(row.club_id)) known.add(row.competition_id);
  }
  for (const clubId of clubIds) {
    for (const match of matchesOf(index, clubId)) known.add(competitionOf(index, match).id);
  }
  for (const season of index.data.seasons) {
    if (
      known.has(season.competition_id) &&
      overlapsPeriod({ from: season.start, to: season.end }, period)
    ) {
      ids.add(season.competition_id);
    }
  }
  return [...ids].filter((id) => passesFilter(competitionById(index, id), filter));
}

export type History = Readonly<{
  record: HistoryRecord;
  matches: readonly MatchView[];
  coverage: CoverageNotice;
}>;

export function calculateHistory(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  filter: MatchFilter = {},
): History {
  const { views, suspended } = selectViews(index, clubId, period, filter);
  return {
    record: tallyMatches(views, suspended.length),
    matches: views,
    coverage: coverageNotice(
      index,
      [clubId],
      period,
      relevantCompetitionIds(index, [clubId], period, views, filter),
    ),
  };
}
