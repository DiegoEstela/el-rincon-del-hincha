import { isAfter, isWithin, todayInBuenosAires } from "../dates";
import type { Dataset, ValidationIssue } from "../types";
import { indexById, issue } from "./shared";

/** Rules about dates: future-played-match, date-outside-season, invalid-season-range. */
export function checkDates(ds: Dataset, now: Date): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const today = todayInBuenosAires(now);
  const seasons = indexById(ds["seasons.json"]);

  for (const m of ds["matches.json"]) {
    if (m.status !== "suspended" && isAfter(m.date, today)) {
      issues.push(
        issue(
          "future-played-match",
          "matches.json",
          m.id,
          `a ${m.status} match is dated ${m.date}, after today (${today}).`,
        ),
      );
    }
    const season = seasons.get(m.season_id);
    if (season !== undefined && !isWithin(m.date, season.start, season.end)) {
      issues.push(
        issue(
          "date-outside-season",
          "matches.json",
          m.id,
          `date ${m.date} is outside season "${season.id}" (${season.start} to ${season.end}).`,
        ),
      );
    }
  }

  for (const s of ds["seasons.json"]) {
    if (isAfter(s.start, s.end)) {
      issues.push(
        issue(
          "invalid-season-range",
          "seasons.json",
          s.id,
          `start ${s.start} is after end ${s.end}.`,
        ),
      );
    }
  }
  for (const c of ds["coverage.json"]) {
    if (c.to !== null && isAfter(c.from, c.to)) {
      issues.push(
        issue(
          "invalid-season-range",
          "coverage.json",
          `${c.club_id}/${c.competition_id}/${c.from}`,
          `from ${c.from} is after to ${c.to}.`,
        ),
      );
    }
  }

  return issues;
}
