// Adapter and index over the data model. The engine never sees file names (ADR 0010).
import type { Competition, Dataset, Match } from "@/data-model/types";
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

function compare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Order used everywhere a list of matches is returned: by date, then id. */
export function byDateThenId(a: Match, b: Match): number {
  return compare(a.date, b.date) || compare(a.id, b.id);
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

/** The competition of a match, through its season. Data is validated upstream, so a miss throws. */
export function competitionOf(index: StatsIndex, match: Match): Competition {
  const season = index.seasonById.get(match.season_id);
  if (season === undefined) throw new Error(`Unknown season "${match.season_id}".`);
  const competition = index.competitionById.get(season.competition_id);
  if (competition === undefined) {
    throw new Error(`Unknown competition "${season.competition_id}".`);
  }
  return competition;
}
