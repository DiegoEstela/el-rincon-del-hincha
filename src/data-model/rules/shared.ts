import type { RuleId, ValidationIssue } from "../types";

export function issue(
  rule: RuleId,
  file: string,
  recordId: string | null,
  message: string,
): ValidationIssue {
  return { rule, file, recordId, message };
}

export function indexById<T extends { id: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((r) => [r.id, r]));
}

export function groupBy<T>(records: T[], key: (record: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const k = key(record);
    groups.set(k, [...(groups.get(k) ?? []), record]);
  }
  return groups;
}
