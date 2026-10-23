// Match dates of the RSSSF pages have a month and a day but no year (plan 0017, ADR 0020 decision
// 4). The year comes from a sourced window per tournament: of the years the window touches, the
// one that puts the date inside the window. A window longer than 12 months would be ambiguous, so
// it is rejected up front.

export type DateWindow = { from: string; to: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseIso(iso: string): Date {
  const date = new Date(`${iso}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso
  ) {
    throw new Error(`"${iso}" is not a valid date`);
  }
  return date;
}

export function checkWindow(window: DateWindow): void {
  const from = parseIso(window.from);
  const to = parseIso(window.to);
  if (to < from)
    throw new Error(`the window ends (${window.to}) before it starts (${window.from})`);
  const limit = new Date(from);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  if (to >= limit) {
    throw new Error(`the window ${window.from} to ${window.to} is longer than 12 months`);
  }
}

/** `where` is `<excerpt>:<line>` for the error messages. */
export function resolveDate(
  month: string,
  day: number,
  weekday: string | undefined,
  window: DateWindow,
  where: string,
): string {
  const m = MONTHS.indexOf(month);
  if (m === -1) throw new Error(`${where}: unknown month "${month}"`);
  const from = parseIso(window.from);
  const to = parseIso(window.to);
  const candidates: string[] = [];
  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year++) {
    const date = new Date(Date.UTC(year, m, day));
    // Date rolls over (Feb 30 becomes Mar 2): the month must survive.
    if (date.getUTCMonth() !== m || date.getUTCDate() !== day) continue;
    if (date >= from && date <= to) candidates.push(date.toISOString().slice(0, 10));
  }
  if (candidates.length === 0) {
    const exists = [from.getUTCFullYear(), to.getUTCFullYear()].some((year) => {
      const date = new Date(Date.UTC(year, m, day));
      return date.getUTCMonth() === m && date.getUTCDate() === day;
    });
    throw new Error(
      exists
        ? `${where}: ${month} ${day} is outside the window ${window.from} to ${window.to}`
        : `${where}: ${month} ${day} does not exist in the years of the window`,
    );
  }
  const iso = candidates[0];
  if (weekday !== undefined) {
    if (!WEEKDAYS.includes(weekday)) throw new Error(`${where}: unknown weekday "${weekday}"`);
    const actual = WEEKDAYS[parseIso(iso).getUTCDay()];
    if (actual !== weekday) {
      throw new Error(`${where}: ${iso} is a ${actual}, but the page says ${weekday}`);
    }
  }
  return iso;
}
