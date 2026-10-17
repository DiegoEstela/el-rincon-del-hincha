import "server-only";
// The per-club documents the stats screens fetch (plan 0015, ADR 0018). Built from data/ at module
// load, like the club catalog: the files are imported, parsed once with the schemas, and sliced on
// demand. A data file that does not exist yet (titles, movements, rivalries) is simply empty.
import clubsJson from "../../data/clubs.json";
import competitionsJson from "../../data/competitions.json";
import coverageJson from "../../data/coverage.json";
import matchesJson from "../../data/matches.json";
import seasonsJson from "../../data/seasons.json";
import {
  clubSchema,
  competitionSchema,
  coverageSchema,
  matchSchema,
  seasonSchema,
} from "@/data-model/schemas";
import { sliceClubData, type ClubData } from "@/domain/club-data";
import type { StatsData } from "@/domain/types";

const data: StatsData = {
  clubs: clubSchema.array().parse(clubsJson),
  competitions: competitionSchema.array().parse(competitionsJson),
  seasons: seasonSchema.array().parse(seasonsJson),
  matches: matchSchema.array().parse(matchesJson),
  coverage: coverageSchema.array().parse(coverageJson),
  titles: [],
  movements: [],
  rivalries: [],
};

export const CLUB_IDS: readonly string[] = data.clubs.map((c) => c.id);

const known = new Set(CLUB_IDS);

/** The document of a club, or `null` for an id that is not a club. Never throws. */
export function clubDataFor(clubId: string): ClubData | null {
  return known.has(clubId) ? sliceClubData(data, clubId) : null;
}
