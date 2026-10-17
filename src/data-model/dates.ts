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

/** True when `value` is exactly `YYYY-MM-DD` and names a day that exists (leap years included). */
export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
