import type { Dataset, Match, ValidationIssue } from "../types";
import { issue } from "./shared";

const COUNT_FIELDS = ["home_goals", "away_goals", "home_penalties", "away_penalties"] as const;

function penaltyProblems(m: Match): string[] {
  const problems: string[] = [];
  if (m.decision !== "penalties") {
    if (m.home_penalties !== null || m.away_penalties !== null) {
      problems.push(`penalty counts are set but decision is ${JSON.stringify(m.decision)}`);
    }
    return problems;
  }
  if (m.home_penalties === null || m.away_penalties === null) {
    problems.push("decision is penalties but both penalty counts are required");
  } else if (m.home_penalties === m.away_penalties) {
    problems.push("the shoot-out cannot end tied");
  }
  if (m.home_goals !== m.away_goals) {
    problems.push("a shoot-out requires level goals");
  }
  return problems;
}

/** Rules about the numbers of a match: negative-goals, missing-score, penalties-inconsistent. */
export function checkScores(ds: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const m of ds["matches.json"]) {
    for (const field of COUNT_FIELDS) {
      const value = m[field];
      if (value !== null && value < 0) {
        issues.push(
          issue("negative-goals", "matches.json", m.id, `${field} is negative (${value}).`),
        );
      }
    }
    if (m.status !== "suspended" && (m.home_goals === null || m.away_goals === null)) {
      issues.push(
        issue("missing-score", "matches.json", m.id, `a ${m.status} match needs both goal counts.`),
      );
    }
    const problems = penaltyProblems(m);
    if (problems.length > 0) {
      issues.push(issue("penalties-inconsistent", "matches.json", m.id, problems.join("; ") + "."));
    }
  }
  return issues;
}
