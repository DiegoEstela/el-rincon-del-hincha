// Methodology: "Match result" and "Suspended matches". Shared by the validator and, later,
// the stats engine. Only types are imported from the data model (no runtime cycle).
import type { Match } from "@/data-model/types";

export type Outcome = "W" | "D" | "L";

export type Tally = { played: number; won: number; drawn: number; lost: number };

/**
 * Result of a match for a club, or null when it does not count for that club.
 * The score is regulation plus extra time; a penalty shoot-out counts as a draw;
 * suspended matches do not count; administrative results do.
 */
export function outcomeFor(match: Match, clubId: string): Outcome | null {
  if (match.status === "suspended") return null;
  const isHome = match.home_id === clubId;
  if (!isHome && match.away_id !== clubId) return null;
  if (match.home_goals === null || match.away_goals === null) return null;
  if (match.decision === "penalties" || match.home_goals === match.away_goals) return "D";
  const homeWon = match.home_goals > match.away_goals;
  return homeWon === isHome ? "W" : "L";
}

/** P/W/D/L of a club in one season, from the counted matches. */
export function tallyClubSeason(matches: Match[], clubId: string, seasonId: string): Tally {
  const tally: Tally = { played: 0, won: 0, drawn: 0, lost: 0 };
  for (const match of matches) {
    if (match.season_id !== seasonId) continue;
    const outcome = outcomeFor(match, clubId);
    if (outcome === null) continue;
    tally.played += 1;
    if (outcome === "W") tally.won += 1;
    else if (outcome === "D") tally.drawn += 1;
    else tally.lost += 1;
  }
  return tally;
}
