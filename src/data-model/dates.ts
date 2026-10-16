// Pure date helpers. Dates in the data model are `YYYY-MM-DD` calendar dates in
// America/Argentina/Buenos_Aires, so plain string comparison is correct and timezone-free.

const buenosAiresDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (`YYYY-MM-DD`) of `now` in Buenos Aires. */
export function todayInBuenosAires(now: Date): string {
  return buenosAiresDay.format(now);
}

/** True when `a` is strictly after `b`. */
export function isAfter(a: string, b: string): boolean {
  return a > b;
}

/** True when `date` is inside `[start, end]`, both bounds inclusive. */
export function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** The calendar day after `date` (`YYYY-MM-DD`), computed in UTC so no time zone is involved. */
export function nextDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
