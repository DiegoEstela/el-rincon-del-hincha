// Methodology: "Match result" and "Suspended matches". Shared by the validator and the
// stats engine. Only types are imported from the data model (no runtime cycle).
import type { Match } from "@/data-model/types";
import type { MatchView } from "./types";

export type Outcome = "W" | "D" | "L";

export type Tally = { played: number; won: number; drawn: number; lost: number };

type Score = { goalsFor: number; goalsAgainst: number; isHome: boolean };

/** Score of a counted match from the club's side; null when it does not count for the club. */
function scoreFor(match: Match, clubId: string): Score | null {
  if (match.status === "suspended") return null;
  const isHome = match.home_id === clubId;
  if (!isHome && match.away_id !== clubId) return null;
  if (match.home_goals === null || match.away_goals === null) return null;
  return isHome
    ? { goalsFor: match.home_goals, goalsAgainst: match.away_goals, isHome }
    : { goalsFor: match.away_goals, goalsAgainst: match.home_goals, isHome };
}

function resultOf(match: Match, score: Score): Outcome {
  if (match.decision === "penalties" || score.goalsFor === score.goalsAgainst) return "D";
  return score.goalsFor > score.goalsAgainst ? "W" : "L";
}

/**
 * Result of a match for a club, or null when it does not count for that club.
 * The score is regulation plus extra time; a penalty shoot-out counts as a draw;
 * suspended matches do not count; administrative results do.
 */
export function outcomeFor(match: Match, clubId: string): Outcome | null {
  const score = scoreFor(match, clubId);
  return score === null ? null : resultOf(match, score);
}

function shootoutFor(match: Match, isHome: boolean): MatchView["shootout"] {
  if (match.decision !== "penalties") return null;
  const own = isHome ? match.home_penalties : match.away_penalties;
  const other = isHome ? match.away_penalties : match.home_penalties;
  if (own === null || other === null) return null;
  return own > other ? "won" : "lost";
}

/**
 * A counted match seen from one club, or null when it does not count for that club.
 * `competitionId` is passed in because resolving it needs the season index.
 */
export function clubView(match: Match, clubId: string, competitionId: string): MatchView | null {
  const score = scoreFor(match, clubId);
  if (score === null) return null;
  return {
    match,
    competitionId,
    rivalId: score.isHome ? match.away_id : match.home_id,
    outcome: resultOf(match, score),
    goalsFor: score.goalsFor,
    goalsAgainst: score.goalsAgainst,
    shootout: shootoutFor(match, score.isHome),
    isAdministrative: match.status === "administrative_result",
  };
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
