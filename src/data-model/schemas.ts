// Zod schemas for every entity of the data model (ADR 0009). All strict: unknown keys fail.
import { z } from "zod";

const date = z.iso.date();
const slug = z.string().min(1);
const source = z.string().trim().min(1);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const count = z.number().int();
const nullableCount = count.nullable();

const clubFields = {
  id: slug,
  name: z.string().min(1),
  short_name: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  colors: z.strictObject({ primary: hex, secondary: hex, tertiary: hex.optional() }).optional(),
  jersey_pattern: z
    .enum(["solid", "vertical_stripes", "sash", "hoops", "halves", "other"])
    .optional(),
  founded: count.optional(),
  city: z.string().min(1).optional(),
  /** Absent means selectable. `false` marks an opponent that only appears in matches (ADR 0022). */
  selectable: z.boolean().optional(),
  /** ISO 3166 alpha-2; only for opponents. */
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  source,
};

/**
 * A selectable club needs its kit data; an opponent needs a country and nothing else. The same
 * rules are check constraints in supabase/migrations/20261023120000_clubs_opponents.sql: change
 * both together.
 */
export const clubSchema = z.strictObject(clubFields).superRefine((club, ctx) => {
  if (club.selectable === false) {
    if (club.country === undefined) {
      ctx.addIssue({ code: "custom", path: ["country"], message: "an opponent needs a country" });
    }
    return;
  }
  for (const key of ["colors", "jersey_pattern", "founded", "city"] as const) {
    if (club[key] === undefined) {
      ctx.addIssue({ code: "custom", path: [key], message: "a selectable club needs " + key });
    }
  }
  if (club.country !== undefined) {
    ctx.addIssue({ code: "custom", path: ["country"], message: "only opponents have a country" });
  }
});

export const competitionSchema = z.strictObject({
  id: slug,
  name: z.string().min(1),
  type: z.enum(["league", "national_cup", "international", "other"]),
  scope: z.enum(["domestic", "international"]),
  organizer: z.string().min(1),
  afa_recognized: z.boolean(),
  notes: z.string().optional(),
  source,
});

export const seasonSchema = z.strictObject({
  id: slug,
  competition_id: slug,
  name: z.string().min(1),
  start: date,
  end: date,
  source,
});

export const matchSchema = z.strictObject({
  id: slug,
  season_id: slug,
  date,
  home_id: slug,
  away_id: slug,
  home_goals: nullableCount,
  away_goals: nullableCount,
  decision: z.enum(["penalties", "extra_time"]).nullable(),
  home_penalties: nullableCount,
  away_penalties: nullableCount,
  stage: z.string(),
  is_final: z.boolean(),
  status: z.enum(["played", "suspended", "administrative_result"]),
  source,
  verified: z.boolean(),
});

export const titleSchema = z.strictObject({
  id: slug,
  club_id: slug,
  competition_id: slug,
  season_id: slug,
  awarded_on: date,
  shared: z.boolean(),
  source,
  verified: z.boolean(),
});

export const movementSchema = z.strictObject({
  id: slug,
  club_id: slug,
  type: z.enum(["relegation", "promotion"]),
  date,
  season_id: slug,
  source,
});

export const rivalrySchema = z.strictObject({
  club_a: slug,
  club_b: slug,
  is_classic: z.boolean(),
  name: z.string().optional(),
  source,
});

export const coverageSchema = z.strictObject({
  club_id: slug,
  competition_id: slug,
  from: date,
  to: date.nullable(),
  complete: z.boolean(),
  source,
});

export const standingSchema = z.strictObject({
  club_id: slug,
  season_id: slug,
  played: count.nonnegative(),
  won: count.nonnegative(),
  drawn: count.nonnegative(),
  lost: count.nonnegative(),
  source,
});

export const FILE_SCHEMAS = {
  "clubs.json": clubSchema,
  "competitions.json": competitionSchema,
  "seasons.json": seasonSchema,
  "matches.json": matchSchema,
  "titles.json": titleSchema,
  "movements.json": movementSchema,
  "rivalries.json": rivalrySchema,
  "coverage.json": coverageSchema,
  "standings.json": standingSchema,
} as const;

export type DatasetFile = keyof typeof FILE_SCHEMAS;

export const DATASET_FILES = Object.keys(FILE_SCHEMAS) as DatasetFile[];

/** Fields that identify a record, and the separator used to join them. */
export const KEY_FIELDS: Readonly<
  Record<DatasetFile, { readonly fields: readonly string[]; readonly separator: string }>
> = {
  "clubs.json": { fields: ["id"], separator: "" },
  "competitions.json": { fields: ["id"], separator: "" },
  "seasons.json": { fields: ["id"], separator: "" },
  "matches.json": { fields: ["id"], separator: "" },
  "titles.json": { fields: ["id"], separator: "" },
  "movements.json": { fields: ["id"], separator: "" },
  "rivalries.json": { fields: ["club_a", "club_b"], separator: "~" },
  "coverage.json": { fields: ["club_id", "competition_id", "from"], separator: "/" },
  "standings.json": { fields: ["club_id", "season_id"], separator: "/" },
};

/** Record id, or composite key for id-less entities; null when a key field is unusable. */
export function recordKey(file: DatasetFile, record: unknown): string | null {
  if (typeof record !== "object" || record === null) return null;
  const { fields, separator } = KEY_FIELDS[file];
  const values = fields.map((f) => (record as Record<string, unknown>)[f]);
  if (!values.every((v): v is string => typeof v === "string" && v !== "")) return null;
  return values.join(separator);
}
