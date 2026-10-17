// Methodology: "Fan period". Pure; the clock is injected as `now`.
import { isRealIsoDate, isWithin, todayInBuenosAires } from "@/data-model/dates";
import type { FanPeriod, IsoDate } from "./types";

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

/** Whole calendar years, both ends inclusive (the year-range filter of the screens). */
export type YearRange = Readonly<{ fromYear: number; toYear: number }>;

const MIN_YEAR = 1880;
const MAX_YEAR = 9999;

function checkYear(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`A year must be a whole number from ${MIN_YEAR} to ${MAX_YEAR}.`);
  }
}

/**
 * A narrower period: from the later of the fan start and January 1 of `fromYear`, to the earlier
 * of today and December 31 of `toYear`. Empty when nothing is left, or when the period already was.
 */
export function narrowPeriod(period: FanPeriod, range: YearRange): FanPeriod {
  checkYear(range.fromYear);
  checkYear(range.toYear);
  if (range.fromYear > range.toYear) {
    throw new RangeError("The first year of the range is after the last year.");
  }
  const from = `${String(range.fromYear).padStart(4, "0")}-01-01`;
  const to = `${String(range.toYear).padStart(4, "0")}-12-31`;
  const start = period.start > from ? period.start : from;
  const end = period.end < to ? period.end : to;
  return { start, end, isEmpty: period.isEmpty || start > end };
}

/** The later of two start dates (the common period of two fans starts there). */
export function laterStart(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}
