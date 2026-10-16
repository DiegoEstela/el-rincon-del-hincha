// Adapter and index over the data model. The engine never sees file names (ADR 0010).
import type { Competition, Dataset, Match, Season } from "@/data-model/types";
import type { StatsData, StatsIndex } from "./types";

export function statsDataFrom(dataset: Dataset): StatsData {
  return {
    clubs: dataset["clubs.json"],
    competitions: dataset["competitions.json"],
    seasons: dataset["seasons.json"],
    matches: dataset["matches.json"],
    titles: dataset["titles.json"],
    movements: dataset["movements.json"],
    rivalries: dataset["rivalries.json"],
    coverage: dataset["coverage.json"],
  };
}

export function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Order used everywhere a list of matches is returned: by date, then id. */
export function byDateThenId(a: Match, b: Match): number {
  return compareText(a.date, b.date) || compareText(a.id, b.id);
}

export function buildStatsIndex(data: StatsData): StatsIndex {
  const matchesByClub = new Map<string, Match[]>();
  for (const match of data.matches) {
    for (const clubId of [match.home_id, match.away_id]) {
      const list = matchesByClub.get(clubId);
      if (list === undefined) matchesByClub.set(clubId, [match]);
      else list.push(match);
    }
  }
  for (const list of matchesByClub.values()) list.sort(byDateThenId);
  return {
    data,
    seasonById: new Map(data.seasons.map((s) => [s.id, s])),
    competitionById: new Map(data.competitions.map((c) => [c.id, c])),
    matchesByClub,
  };
}

/** A competition by id. Data is validated upstream, so a miss throws. */
export function competitionById(index: StatsIndex, id: string): Competition {
  const competition = index.competitionById.get(id);
  if (competition === undefined) throw new Error(`Unknown competition "${id}".`);
  return competition;
}

/** A season by id. Data is validated upstream, so a miss throws. */
export function seasonById(index: StatsIndex, id: string): Season {
  const season = index.seasonById.get(id);
  if (season === undefined) throw new Error(`Unknown season "${id}".`);
  return season;
}

/** The competition of a match, through its season. */
export function competitionOf(index: StatsIndex, match: Match): Competition {
  return competitionById(index, seasonById(index, match.season_id).competition_id);
}

/** Every match of a club (home or away, suspended included), sorted by date then id. */
export function matchesOf(index: StatsIndex, clubId: string): readonly Match[] {
  return index.matchesByClub.get(clubId) ?? [];
}
