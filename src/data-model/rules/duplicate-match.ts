import type { Dataset, ValidationIssue } from "../types";
import { indexById, issue } from "./shared";

/**
 * duplicate-match: same date, same competition (via season) and same unordered club pair.
 * One issue per extra record, naming the first one.
 */
export function checkDuplicateMatches(ds: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seasons = indexById(ds["seasons.json"]);
  const firstSeen = new Map<string, string>();

  for (const m of ds["matches.json"]) {
    const season = seasons.get(m.season_id);
    if (season === undefined) continue;
    const pair = [m.home_id, m.away_id].sort().join("|");
    const key = `${m.date}|${season.competition_id}|${pair}`;
    const first = firstSeen.get(key);
    if (first === undefined) {
      firstSeen.set(key, m.id);
    } else {
      issues.push(
        issue(
          "duplicate-match",
          "matches.json",
          m.id,
          `same date, competition and clubs as match "${first}".`,
        ),
      );
    }
  }
  return issues;
}
