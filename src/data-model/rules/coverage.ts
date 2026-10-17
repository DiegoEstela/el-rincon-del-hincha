import type { Dataset, ValidationIssue } from "../types";
import { groupBy, issue } from "./shared";

const FILE = "coverage.json";

/**
 * Rules about the coverage table (plan 0014, ADR 0017):
 * - missing-coverage: every club and competition pair has at least one row.
 * - coverage-overlap: the rows of one pair never share a day.
 * - coverage-overclaim: a complete row never reaches a season that has no match at all.
 */
export function checkCoverage(ds: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rows = ds["coverage.json"];

  const withRows = new Set(rows.map((c) => `${c.club_id}/${c.competition_id}`));
  for (const club of ds["clubs.json"]) {
    for (const competition of ds["competitions.json"]) {
      const pair = `${club.id}/${competition.id}`;
      if (!withRows.has(pair)) {
        issues.push(
          issue(
            "missing-coverage",
            FILE,
            pair,
            "no coverage row for this club and competition; run `pnpm data:coverage` to regenerate the table.",
          ),
        );
      }
    }
  }

  for (const group of groupBy(rows, (c) => `${c.club_id}/${c.competition_id}`).values()) {
    const sorted = [...group].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (previous.to === null || previous.to >= current.from) {
        issues.push(
          issue(
            "coverage-overlap",
            FILE,
            `${current.club_id}/${current.competition_id}/${current.from}`,
            `row from ${current.from} overlaps the row from ${previous.from} to ${previous.to ?? "now"}.`,
          ),
        );
      }
    }
  }

  const seasonsWithMatches = new Set(ds["matches.json"].map((m) => m.season_id));
  for (const c of rows) {
    if (!c.complete) continue;
    const empty = ds["seasons.json"].find(
      (s) =>
        s.competition_id === c.competition_id &&
        !seasonsWithMatches.has(s.id) &&
        s.start <= (c.to ?? "9999-12-31") &&
        s.end >= c.from,
    );
    if (empty !== undefined) {
      issues.push(
        issue(
          "coverage-overclaim",
          FILE,
          `${c.club_id}/${c.competition_id}/${c.from}`,
          `complete row from ${c.from} to ${c.to ?? "now"} reaches season "${empty.id}", which has no match loaded.`,
        ),
      );
    }
  }

  return issues;
}
