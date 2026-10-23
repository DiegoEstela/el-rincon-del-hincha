// Methodology: "Titles" (a title counts if awarded_on is inside the period; by default only
// officially recognized competitions; a shared title counts fully for each co-champion).
import type { Competition, Match, Season, Title } from "@/data-model/types";
import { competitionById, compareText, matchesOf, seasonById } from "./data";
import { clubView } from "./match-outcome";
import { inPeriod } from "./period";
import type { FanPeriod, MatchView, StatsIndex } from "./types";

/** The three shelves of the trophy cabinet (vitrina). */
export type Shelf = "international" | "domestic" | "other";

export function trophyShelf(competition: Competition): Shelf {
  if (competition.type === "other") return "other";
  return competition.scope === "international" ? "international" : "domestic";
}

/** "Officially recognized" is a property of the competition (ADR 0003, plan 0005 item 2). */
export function isRecognized(competition: Competition): boolean {
  return competition.afa_recognized;
}

/**
 * The match that decided a title seen from the champion, or null when match data is missing
 * (title lists do not depend on match coverage). Cups and international competitions: the club's
 * last counted final leg of the season. Leagues: the club's last counted match of the season on or
 * before `awarded_on`. Suspended matches are never returned.
 */
export function decidingMatchView(index: StatsIndex, title: Title): MatchView | null {
  const competition = competitionById(index, title.competition_id);
  const counted = matchesOf(index, title.club_id)
    .filter((match) => match.season_id === title.season_id)
    .map((match) => clubView(match, title.club_id, title.competition_id))
    .filter((view): view is MatchView => view !== null);
  const candidates =
    competition.type === "league"
      ? counted.filter((view) => view.match.date <= title.awarded_on)
      : counted.filter((view) => view.match.is_final);
  return candidates[candidates.length - 1] ?? null;
}

/** The same match as the record, for callers that do not need the club view. */
export function decidingMatch(index: StatsIndex, title: Title): Match | null {
  return decidingMatchView(index, title)?.match ?? null;
}

export type TitleInPeriod = Readonly<{
  id: string;
  competition: Competition;
  season: Season;
  recognized: boolean;
  /** Shared with a co-champion: the UI marks it. */
  shared: boolean;
  source: string;
  shelf: Shelf;
  decidingMatch: Match | null;
  /** The deciding match from the champion's side (null with the match). */
  decidingView: MatchView | null;
  awardedOn: string;
}>;

export type TitlesOptions = Readonly<{ includeUnrecognized?: boolean }>;

function toTitleInPeriod(index: StatsIndex, title: Title): TitleInPeriod {
  const competition = competitionById(index, title.competition_id);
  return {
    id: title.id,
    competition,
    season: seasonById(index, title.season_id),
    recognized: isRecognized(competition),
    shared: title.shared,
    source: title.source,
    shelf: trophyShelf(competition),
    decidingMatch: decidingMatch(index, title),
    decidingView: decidingMatchView(index, title),
    awardedOn: title.awarded_on,
  };
}

function titlesWhere(
  index: StatsIndex,
  clubId: string,
  keep: (awardedOn: string) => boolean,
  options: TitlesOptions,
): TitleInPeriod[] {
  return index.data.titles
    .filter((title) => title.club_id === clubId && keep(title.awarded_on))
    .map((title) => toTitleInPeriod(index, title))
    .filter((item) => options.includeUnrecognized === true || item.recognized)
    .sort((a, b) => compareText(a.awardedOn, b.awardedOn) || compareText(a.id, b.id));
}

export function titlesInPeriod(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  options: TitlesOptions = {},
): TitleInPeriod[] {
  return titlesWhere(index, clubId, (awardedOn) => inPeriod(awardedOn, period), options);
}

/**
 * The titles of the club before the fan period starts (the boundary day belongs to the period).
 * They are not the fan's, so the screens show them apart and never count them. An empty period
 * (a start after today) has every title before it.
 */
export function titlesBeforePeriod(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  options: TitlesOptions = {},
): TitleInPeriod[] {
  return titlesWhere(
    index,
    clubId,
    (awardedOn) => period.isEmpty || awardedOn < period.start,
    options,
  );
}

/** The other clubs with a title of the same season (a shared title), sorted. */
export function coChampions(index: StatsIndex, title: Title): string[] {
  return index.data.titles
    .filter((other) => other.season_id === title.season_id && other.club_id !== title.club_id)
    .map((other) => other.club_id)
    .sort(compareText);
}

/**
 * Which seasons of a recognized competition have their champion loaded (ADR 0021). Title lists do
 * not depend on match coverage, so this is derived from the titles themselves: the window runs from
 * the first season with a title to the last one. A season inside the window with no title that has
 * already ended is `missing`. A competition with no title has an empty window.
 */
export type TitleWindow = Readonly<{
  competitionId: string;
  firstSeasonId: string | null;
  lastSeasonId: string | null;
  /** Start of the first titled season and end of the last one. */
  windowStart: string | null;
  windowEnd: string | null;
  missingSeasonIds: readonly string[];
}>;

/** `today` is the end of any fan period (the Buenos Aires date). Sorted by competition id. */
export function titleCoverage(index: StatsIndex, today: string): TitleWindow[] {
  const titled = new Set(index.data.titles.map((title) => title.season_id));
  return index.data.competitions
    .filter(isRecognized)
    .map((competition): TitleWindow => {
      const seasons = index.data.seasons
        .filter((season) => season.competition_id === competition.id)
        .sort((a, b) => compareText(a.start, b.start) || compareText(a.id, b.id));
      const first = seasons.findIndex((season) => titled.has(season.id));
      if (first === -1) {
        return {
          competitionId: competition.id,
          firstSeasonId: null,
          lastSeasonId: null,
          windowStart: null,
          windowEnd: null,
          missingSeasonIds: [],
        };
      }
      const last = seasons.length - 1 - [...seasons].reverse().findIndex((s) => titled.has(s.id));
      const inside = seasons.slice(first, last + 1);
      return {
        competitionId: competition.id,
        firstSeasonId: seasons[first].id,
        lastSeasonId: seasons[last].id,
        windowStart: seasons[first].start,
        windowEnd: seasons[last].end,
        missingSeasonIds: inside
          .filter((season) => !titled.has(season.id) && season.end < today)
          .map((season) => season.id),
      };
    })
    .sort((a, b) => compareText(a.competitionId, b.competitionId));
}

export type PendingTitle = Readonly<{
  competition: Competition;
  shelf: Shelf;
  /** Seasons of the competition that overlap the period. */
  seasonsInPeriod: number;
  /**
   * "pending": the competition has champions loaded inside the period and the club is not one of
   * them, so "te falta" is true. "unknown": we have no champion loaded for the period, so nothing
   * can be said (ADR 0021).
   */
  status: "pending" | "unknown";
  /** The first and last season with a champion loaded (null when unknown). */
  windowFirstSeasonId: string | null;
  windowLastSeasonId: string | null;
}>;

/**
 * Recognized competitions played during the period (a season overlaps it) that the club did not
 * win inside the period, each marked pending or unknown by the title window. Sorted by shelf,
 * then competition id. A title before the period does not remove the entry.
 */
export function pendingTitles(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
): PendingTitle[] {
  if (period.isEmpty) return [];
  const won = new Set(titlesInPeriod(index, clubId, period).map((t) => t.competition.id));
  const windows = new Map(titleCoverage(index, period.end).map((w) => [w.competitionId, w]));
  return index.data.competitions
    .filter((competition) => isRecognized(competition) && !won.has(competition.id))
    .map((competition): PendingTitle => {
      const seasonsInPeriod = index.data.seasons.filter(
        (season) =>
          season.competition_id === competition.id &&
          season.start <= period.end &&
          season.end >= period.start,
      ).length;
      const window = windows.get(competition.id)!;
      const overlaps =
        window.windowStart !== null &&
        window.windowEnd !== null &&
        window.windowStart <= period.end &&
        window.windowEnd >= period.start;
      return {
        competition,
        shelf: trophyShelf(competition),
        seasonsInPeriod,
        status: overlaps ? "pending" : "unknown",
        windowFirstSeasonId: overlaps ? window.firstSeasonId : null,
        windowLastSeasonId: overlaps ? window.lastSeasonId : null,
      };
    })
    .filter((pending) => pending.seasonsInPeriod > 0)
    .sort(
      (a, b) => compareText(a.shelf, b.shelf) || compareText(a.competition.id, b.competition.id),
    );
}
