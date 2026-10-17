// Methodology: "Fan period" (start date rule). Pure; the clock is injected as `now`.
// Error results never contain the input: the start date can be a birth date and must not leak
// through messages, logs or analytics.
import { isRealIsoDate, todayInBuenosAires } from "@/data-model/dates";

/** Earliest accepted start date. Same bound as the database check. */
export const START_DATE_MIN = "1880-01-01";

export type StartDateError = "empty" | "format" | "not_a_date" | "too_early" | "future";

export type StartDateResult = { ok: true; date: string } | { ok: false; error: StartDateError };

const SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a fan start date: a real `YYYY-MM-DD`, from 1880-01-01 to today in Buenos Aires. */
export function validateStartDate(value: string, now: Date): StartDateResult {
  const date = value.trim();
  if (date === "") return { ok: false, error: "empty" };
  if (!SHAPE.test(date)) return { ok: false, error: "format" };
  if (!isRealIsoDate(date)) return { ok: false, error: "not_a_date" };
  if (date < START_DATE_MIN) return { ok: false, error: "too_early" };
  if (date > todayInBuenosAires(now)) return { ok: false, error: "future" };
  return { ok: true, date };
}
