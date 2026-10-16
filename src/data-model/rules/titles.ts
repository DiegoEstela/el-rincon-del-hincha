import { isSeasonFullyCovered } from "../coverage";
import type { Dataset, Match, ValidationIssue } from "../types";
import { groupBy, indexById, issue } from "./shared";

/** A match that counts for statistics (methodology: suspended matches do not). */
function isCounted(m: Match): boolean {
  return m.status !== "suspended";
}

/** unshared-co-champions: a season with two or more titles needs every title marked shared. */
function checkCoChampions(ds: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [seasonId, titles] of groupBy(ds["titles.json"], (t) => t.season_id)) {
    if (titles.length < 2) continue;
    for (const t of titles.filter((title) => !title.shared)) {
      issues.push(
        issue(
          "unshared-co-champions",
          "titles.json",
          t.id,
          `season "${seasonId}" has ${titles.length} titles but this one is not marked shared.`,
        ),
      );
    }
  }
  return issues;
}

/**
 * title-without-support: with complete coverage of the season, the champion must appear in
 * a counted match of that season: a final for cups, any counted match for leagues.
 */
function checkTitleSupport(ds: Dataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seasons = indexById(ds["seasons.json"]);
  const competitions = indexById(ds["competitions.json"]);
  const matchesBySeason = groupBy(ds["matches.json"], (m) => m.season_id);

  for (const t of ds["titles.json"]) {
    const season = seasons.get(t.season_id);
    const competition = competitions.get(t.competition_id);
    if (season === undefined || competition === undefined) continue;
    if (!isSeasonFullyCovered(ds["coverage.json"], t.club_id, t.competition_id, season)) continue;

    const supported = (matchesBySeason.get(season.id) ?? []).some(
      (m) =>
        isCounted(m) &&
        (m.home_id === t.club_id || m.away_id === t.club_id) &&
        (competition.type === "league" || m.is_final),
    );
    if (!supported) {
      issues.push(
        issue(
          "title-without-support",
          "titles.json",
          t.id,
          `coverage of "${season.id}" is complete but "${t.club_id}" has no supporting ${
            competition.type === "league" ? "counted match" : "final"
          } in it.`,
        ),
      );
    }
  }
  return issues;
}

export function checkTitles(ds: Dataset): ValidationIssue[] {
  return [...checkCoChampions(ds), ...checkTitleSupport(ds)];
}
