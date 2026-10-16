// Methodology: "Titles" (a title counts if awarded_on is inside the period; by default only
// officially recognized competitions; a shared title counts fully for each co-champion).
import type { Competition, Match, Season, Title } from "@/data-model/types";
import { competitionById, compareText, matchesOf, seasonById } from "./data";
import { outcomeFor } from "./match-outcome";
import { inPeriod } from "./period";
import type { FanPeriod, StatsIndex } from "./types";

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
 * The match that decided a title, or null when match data is missing (title lists do not
 * depend on match coverage). Cups and international competitions: the club's last counted
 * final leg of the season. Leagues: the club's last counted match of the season on or before
 * `awarded_on`. Suspended matches are never returned.
 */
export function decidingMatch(index: StatsIndex, title: Title): Match | null {
  const competition = competitionById(index, title.competition_id);
  const counted = matchesOf(index, title.club_id).filter(
    (match) => match.season_id === title.season_id && outcomeFor(match, title.club_id) !== null,
  );
  const candidates =
    competition.type === "league"
      ? counted.filter((match) => match.date <= title.awarded_on)
      : counted.filter((match) => match.is_final);
  return candidates[candidates.length - 1] ?? null;
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
  awardedOn: string;
}>;

export type TitlesOptions = Readonly<{ includeUnrecognized?: boolean }>;

export function titlesInPeriod(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  options: TitlesOptions = {},
): TitleInPeriod[] {
  return index.data.titles
    .filter((title) => title.club_id === clubId && inPeriod(title.awarded_on, period))
    .map((title): TitleInPeriod => {
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
        awardedOn: title.awarded_on,
      };
    })
    .filter((item) => options.includeUnrecognized === true || item.recognized)
    .sort((a, b) => compareText(a.awardedOn, b.awardedOn) || compareText(a.id, b.id));
}

export type PendingTitle = Readonly<{
  competition: Competition;
  shelf: Shelf;
  /** Seasons of the competition that overlap the period. */
  seasonsInPeriod: number;
}>;

/**
 * Recognized competitions played during the period (a season overlaps it) that the club did
 * not win inside the period. Sorted by shelf, then competition id.
 */
export function pendingTitles(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
): PendingTitle[] {
  if (period.isEmpty) return [];
  const won = new Set(titlesInPeriod(index, clubId, period).map((t) => t.competition.id));
  return index.data.competitions
    .filter((competition) => isRecognized(competition) && !won.has(competition.id))
    .map((competition): PendingTitle => {
      const seasonsInPeriod = index.data.seasons.filter(
        (season) =>
          season.competition_id === competition.id &&
          season.start <= period.end &&
          season.end >= period.start,
      ).length;
      return { competition, shelf: trophyShelf(competition), seasonsInPeriod };
    })
    .filter((pending) => pending.seasonsInPeriod > 0)
    .sort(
      (a, b) => compareText(a.shelf, b.shelf) || compareText(a.competition.id, b.competition.id),
    );
}
