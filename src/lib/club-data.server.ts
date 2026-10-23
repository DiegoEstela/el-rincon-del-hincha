import "server-only";
// The per-club documents the stats screens fetch (plan 0015, ADR 0018). Built from data/ at module
// load, like the club catalog: the files are imported, parsed once with the schemas, and sliced on
// demand. A data file that does not exist yet (movements, rivalries) is simply empty.
import clubsJson from "../../data/clubs.json";
import competitionsJson from "../../data/competitions.json";
import coverageJson from "../../data/coverage.json";
import matchesJson from "../../data/matches.json";
import seasonsJson from "../../data/seasons.json";
import titlesJson from "../../data/titles.json";
import {
  clubSchema,
  competitionSchema,
  coverageSchema,
  matchSchema,
  seasonSchema,
  titleSchema,
} from "@/data-model/schemas";
import { selectableClubIds, sliceClubData, type ClubData } from "@/domain/club-data";
import type { StatsData } from "@/domain/types";

const data: StatsData = {
  clubs: clubSchema.array().parse(clubsJson),
  competitions: competitionSchema.array().parse(competitionsJson),
  seasons: seasonSchema.array().parse(seasonsJson),
  matches: matchSchema.array().parse(matchesJson),
  coverage: coverageSchema.array().parse(coverageJson),
  titles: titleSchema.array().parse(titlesJson),
  movements: [],
  rivalries: [],
};

export const CLUB_IDS: readonly string[] = selectableClubIds(data.clubs);

const known = new Set(CLUB_IDS);

/** The document of a club, or `null` for an id that is not a club. Never throws. */
export function clubDataFor(clubId: string): ClubData | null {
  return known.has(clubId) ? sliceClubData(data, clubId) : null;
}
