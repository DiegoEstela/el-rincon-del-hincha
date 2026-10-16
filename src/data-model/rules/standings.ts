import { tallyClubSeason } from "../../domain/match-outcome";
import { isSeasonFullyCovered } from "../coverage";
import type { Dataset, ValidationIssue } from "../types";
import { indexById, issue } from "./shared";

/**
 * control-totals: won + drawn + lost must equal played in each standings row.
 * standings-mismatch: with complete coverage, the tally of the matches must equal the row.
 */
export function checkStandings(ds: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seasons = indexById(ds["seasons.json"]);

  for (const s of ds["standings.json"]) {
    const id = `${s.club_id}/${s.season_id}`;
    if (s.won + s.drawn + s.lost !== s.played) {
      issues.push(
        issue(
          "control-totals",
          "standings.json",
          id,
          `won + drawn + lost (${s.won + s.drawn + s.lost}) differs from played (${s.played}).`,
        ),
      );
    }

    const season = seasons.get(s.season_id);
    if (
      season === undefined ||
      !isSeasonFullyCovered(ds["coverage.json"], s.club_id, season.competition_id, season)
    ) {
      continue;
    }
    const t = tallyClubSeason(ds["matches.json"], s.club_id, s.season_id);
    if (t.played !== s.played || t.won !== s.won || t.drawn !== s.drawn || t.lost !== s.lost) {
      issues.push(
        issue(
          "standings-mismatch",
          "standings.json",
          id,
          `standings say P${s.played} W${s.won} D${s.drawn} L${s.lost} but matches say P${t.played} W${t.won} D${t.drawn} L${t.lost}.`,
        ),
      );
    }
  }
  return issues;
}
