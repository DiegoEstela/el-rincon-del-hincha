import { validate } from "@/data-model/validate";
import type { RuleId, ValidationIssue } from "@/data-model/types";
import { FIXED_NOW, type FixtureDataset } from "./dataset";

export function issuesFor(
  ds: FixtureDataset,
  now: Date = FIXED_NOW,
  rule?: RuleId,
): ValidationIssue[] {
  const issues = validate(ds, { now });
  return rule === undefined ? issues : issues.filter((i) => i.rule === rule);
}

/** "file#recordId" of every issue with the given rule. */
export function where(ds: FixtureDataset, rule: RuleId, now: Date = FIXED_NOW): string[] {
  return issuesFor(ds, now, rule).map((i) => `${i.file}#${i.recordId}`);
}
