// Methodology: "Fan period". Pure; the clock is injected as `now`.
import { isWithin, todayInBuenosAires } from "@/data-model/dates";
import type { FanPeriod, IsoDate } from "./types";

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Period of a fan: from `start` (inclusive) to today in Buenos Aires (inclusive).
 * A start after today is valid and gives an empty period.
 */
export function fanPeriod(start: IsoDate, now: Date): FanPeriod {
  if (!isRealIsoDate(start)) {
    throw new RangeError("The fan start date is not a valid YYYY-MM-DD date.");
  }
  const end = todayInBuenosAires(now);
  return { start, end, isEmpty: start > end };
}

export function inPeriod(date: IsoDate, period: FanPeriod): boolean {
  return isWithin(date, period.start, period.end);
}

/** The later of two start dates (the common period of two fans starts there). */
export function laterStart(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}
