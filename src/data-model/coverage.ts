import type { Coverage, Season } from "./types";

/**
 * True when some `complete` coverage row of the club for the competition contains the whole
 * season: `from <= start` and (`to` is null, meaning ongoing, or `to >= end`).
 */
export function isSeasonFullyCovered(
  coverage: Coverage[],
  clubId: string,
  competitionId: string,
  season: Season,
): boolean {
  return coverage.some(
    (c) =>
      c.club_id === clubId &&
      c.competition_id === competitionId &&
      c.complete &&
      c.from <= season.start &&
      (c.to === null || c.to >= season.end),
  );
}
