import { DATASET_FILES, recordKey, type DatasetFile } from "../schemas";
import type { Dataset, RuleId, ValidationIssue } from "../types";
import { groupBy, indexById, issue } from "./shared";

export type KnownKeys = Record<DatasetFile, Set<string>>;

type Reference = {
  file: DatasetFile;
  field: string;
  target: DatasetFile;
  rule: RuleId;
};

const REFERENCES: Reference[] = [
  {
    file: "seasons.json",
    field: "competition_id",
    target: "competitions.json",
    rule: "unknown-reference",
  },
  { file: "matches.json", field: "season_id", target: "seasons.json", rule: "unknown-reference" },
  { file: "matches.json", field: "home_id", target: "clubs.json", rule: "unknown-club" },
  { file: "matches.json", field: "away_id", target: "clubs.json", rule: "unknown-club" },
  { file: "titles.json", field: "club_id", target: "clubs.json", rule: "unknown-reference" },
  {
    file: "titles.json",
    field: "competition_id",
    target: "competitions.json",
    rule: "unknown-reference",
  },
  { file: "titles.json", field: "season_id", target: "seasons.json", rule: "unknown-reference" },
  { file: "movements.json", field: "club_id", target: "clubs.json", rule: "unknown-reference" },
  { file: "movements.json", field: "season_id", target: "seasons.json", rule: "unknown-reference" },
  { file: "rivalries.json", field: "club_a", target: "clubs.json", rule: "unknown-reference" },
  { file: "rivalries.json", field: "club_b", target: "clubs.json", rule: "unknown-reference" },
  { file: "coverage.json", field: "club_id", target: "clubs.json", rule: "unknown-reference" },
  {
    file: "coverage.json",
    field: "competition_id",
    target: "competitions.json",
    rule: "unknown-reference",
  },
  { file: "standings.json", field: "club_id", target: "clubs.json", rule: "unknown-reference" },
  { file: "standings.json", field: "season_id", target: "seasons.json", rule: "unknown-reference" },
];

/**
 * Referential rules. `knownKeys` includes records that failed the shape check, so a broken
 * club does not make every match that points at it report an unknown club.
 */
export function checkReferences(ds: Dataset, knownKeys: KnownKeys): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const file of DATASET_FILES) {
    const groups = groupBy(ds[file] as unknown[], (r) => recordKey(file, r) as string);
    for (const [key, records] of groups) {
      if (records.length > 1) {
        issues.push(
          issue("duplicate-id", file, key, `${records.length} records share the key "${key}".`),
        );
      }
    }
  }

  for (const ref of REFERENCES) {
    for (const record of ds[ref.file] as Record<string, unknown>[]) {
      const value = record[ref.field] as string;
      if (!knownKeys[ref.target].has(value)) {
        issues.push(
          issue(
            ref.rule,
            ref.file,
            recordKey(ref.file, record),
            `${ref.field} "${value}" does not exist in ${ref.target}.`,
          ),
        );
      }
    }
  }

  for (const match of ds["matches.json"]) {
    if (match.home_id === match.away_id) {
      issues.push(
        issue(
          "same-club",
          "matches.json",
          match.id,
          `home and away are the same club "${match.home_id}".`,
        ),
      );
    }
  }

  const seasons = indexById(ds["seasons.json"]);
  for (const title of ds["titles.json"]) {
    const season = seasons.get(title.season_id);
    if (season !== undefined && season.competition_id !== title.competition_id) {
      issues.push(
        issue(
          "unknown-reference",
          "titles.json",
          title.id,
          `competition_id "${title.competition_id}" differs from the competition of season "${season.id}" ("${season.competition_id}").`,
        ),
      );
    }
  }

  return issues;
}
