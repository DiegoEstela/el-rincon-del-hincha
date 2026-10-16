import type { z } from "zod";
import type {
  DatasetFile,
  clubSchema,
  competitionSchema,
  coverageSchema,
  matchSchema,
  movementSchema,
  rivalrySchema,
  seasonSchema,
  standingSchema,
  titleSchema,
} from "./schemas";

export type { DatasetFile };
export type Club = z.infer<typeof clubSchema>;
export type Competition = z.infer<typeof competitionSchema>;
export type Season = z.infer<typeof seasonSchema>;
export type Match = z.infer<typeof matchSchema>;
export type Title = z.infer<typeof titleSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type Rivalry = z.infer<typeof rivalrySchema>;
export type Coverage = z.infer<typeof coverageSchema>;
export type Standing = z.infer<typeof standingSchema>;

/** Every rule id the validator can emit. `invalid-json` is emitted by the CLI only. */
export const RULE_IDS = [
  "schema",
  "unknown-file",
  "missing-source",
  "duplicate-id",
  "duplicate-match",
  "unknown-club",
  "unknown-reference",
  "same-club",
  "negative-goals",
  "missing-score",
  "penalties-inconsistent",
  "future-played-match",
  "date-outside-season",
  "invalid-season-range",
  "title-without-support",
  "unshared-co-champions",
  "control-totals",
  "standings-mismatch",
  "invalid-json",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export type ValidationIssue = {
  rule: RuleId;
  file: string;
  recordId: string | null;
  message: string;
};

/** A dataset: one array of records per file. */
export type Dataset = {
  "clubs.json": Club[];
  "competitions.json": Competition[];
  "seasons.json": Season[];
  "matches.json": Match[];
  "titles.json": Title[];
  "movements.json": Movement[];
  "rivalries.json": Rivalry[];
  "coverage.json": Coverage[];
  "standings.json": Standing[];
};
