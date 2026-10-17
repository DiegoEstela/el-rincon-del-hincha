// Guards for what the screens give the engine (issue #43, ADR 0018). Hand-written on purpose: Zod
// with the data-model schemas would add about 94 KB gzip to the browser. Every result is a value or
// a code, never the input, so nothing a person typed can leak into a message or a log.
import type { Competition } from "@/data-model/types";

export type TypeFilter = "all" | Competition["type"];
export type SortKey = "balance" | "played" | "name";

export type RivalsFilter = Readonly<{ fromYear: number; toYear: number; type: TypeFilter }>;
export type FilterBounds = Readonly<{
  minYear: number;
  maxYear: number;
  /** The competition types the screen offers (besides "all"). */
  types: readonly Competition["type"][];
}>;

const SORT_KEYS: readonly SortKey[] = ["balance", "played", "name"];

function yearIn(value: unknown, bounds: FilterBounds): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= bounds.minYear &&
    value <= bounds.maxYear
  );
}

/** Year range and tournament type from the UI controls. Anything invalid is the default. */
export function parseRivalsFilter(
  raw: { fromYear?: unknown; toYear?: unknown; type?: unknown },
  bounds: FilterBounds,
): RivalsFilter {
  const fromYear = yearIn(raw.fromYear, bounds) ? raw.fromYear : bounds.minYear;
  const toYear = yearIn(raw.toYear, bounds) ? raw.toYear : bounds.maxYear;
  const type =
    typeof raw.type === "string" &&
    (raw.type === "all" || (bounds.types as readonly string[]).includes(raw.type))
      ? (raw.type as TypeFilter)
      : "all";
  return fromYear <= toYear
    ? { fromYear, toYear, type }
    : { fromYear: toYear, toYear: fromYear, type };
}

export function parseSort(raw: unknown): SortKey {
  return SORT_KEYS.find((key) => key === raw) ?? "balance";
}

export type RivalIdResult =
  { ok: true; id: string } | { ok: false; code: "unknown_club" | "same_club" };

/** A rival id for the detail screen: a known club that is not the fan's own. */
export function parseRivalId(
  raw: unknown,
  options: { clubId: string; clubIds: ReadonlySet<string> },
): RivalIdResult {
  if (typeof raw !== "string" || !options.clubIds.has(raw)) {
    return { ok: false, code: "unknown_club" };
  }
  if (raw === options.clubId) return { ok: false, code: "same_club" };
  return { ok: true, id: raw };
}
