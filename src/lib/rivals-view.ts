// View model of the "[Mi club] vs. Todos" screen (plan 0015). Pure: everything the screen shows is
// computed here from the engine, so the components stay dumb. The fan start date goes in and only
// a month and year (`since`) comes out; the date itself is never part of the result.
import { competitionById, compareText } from "@/domain/data";
import type { Dominance } from "@/domain/dominance";
import { selectViews } from "@/domain/history";
import { fanPeriod, narrowPeriod } from "@/domain/period";
import { groupRivals, type RivalRow } from "@/domain/rivals";
import type { CoverageNotice, FanPeriod, StatsIndex } from "@/domain/types";
import type { Competition } from "@/data-model/types";
import {
  coverageCopy,
  formatMonthYear,
  includedLine,
  joinNames,
  type CoverageCopy,
} from "./coverage-copy";
import { parseRivalsFilter, type RivalsFilter, type SortKey } from "./engine-input";
import type { ClubOption } from "./club-options";

export type RivalsViewInput = Readonly<{
  /** Built once per club document by the caller. */
  index: StatsIndex;
  clubId: string;
  /** The fan start date. It is used to compute and never copied into the result. */
  startDate: string;
  now: Date;
  /** Raw UI state; anything invalid becomes the default. */
  filter: { fromYear?: unknown; toYear?: unknown; type?: unknown };
  sort: SortKey;
  catalog: ReadonlyMap<string, ClubOption>;
  /** Competition id to display name. */
  competitionNames: ReadonlyMap<string, string>;
}>;

export type RivalRowView = Readonly<{
  rivalId: string;
  name: string;
  shortName: string;
  crest: ClubOption["crest"] | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  balance: number;
  dominance: Dominance;
  isClassic: boolean;
  /** Shares of the played matches, for the bar. They sum to one. */
  bar: Readonly<{ won: number; drawn: number; lost: number }>;
  /** Matches decided by an administrative result, counted in the record. */
  administrative: number;
  /** Matches decided by a penalty shoot-out (counted as draws). */
  shootouts: number;
}>;

export type RivalsView = Readonly<{
  rows: readonly RivalRowView[];
  summary: Readonly<{ favorable: number; even: number; unfavorable: number }>;
  totals: Readonly<{ matches: number; rivals: number }>;
  sections: Readonly<{
    favorable: readonly RivalRowView[];
    even: readonly RivalRowView[];
    unfavorable: readonly RivalRowView[];
  }>;
  /** Month and year the counted period starts in, such as "mayo de 1990". */
  since: string;
  filter: RivalsFilter;
  filtersActive: boolean;
  options: Readonly<{
    years: readonly number[];
    types: readonly Competition["type"][];
  }>;
  competitionIds: readonly string[];
  /** "Contamos: ..." */
  included: string;
  /** "A y B": the competitions as a plain list (the table caption). */
  competitionsLabel: string;
  coverage: CoverageCopy;
  noMatches: boolean;
}>;

const collator = new Intl.Collator("es-AR", { sensitivity: "base" });
const TOP = 3;

function toRow(row: RivalRow, catalog: ReadonlyMap<string, ClubOption>): RivalRowView {
  const option = catalog.get(row.rivalId);
  const { record } = row;
  return {
    rivalId: row.rivalId,
    name: option?.name ?? row.rivalId,
    shortName: option?.shortName ?? row.rivalId,
    crest: option?.crest ?? null,
    played: record.played,
    won: record.won,
    drawn: record.drawn,
    lost: record.lost,
    balance: record.balance,
    dominance: row.dominance,
    isClassic: row.isClassic,
    bar: {
      won: record.won / record.played,
      drawn: record.drawn / record.played,
      lost: record.lost / record.played,
    },
    administrative: record.administrative.count,
    shootouts: record.shootouts.played,
  };
}

const byId = (a: RivalRowView, b: RivalRowView) => compareText(a.rivalId, b.rivalId);

const SORTERS: Record<SortKey, (a: RivalRowView, b: RivalRowView) => number> = {
  balance: (a, b) => b.balance - a.balance || b.played - a.played || byId(a, b),
  played: (a, b) => b.played - a.played || b.balance - a.balance || byId(a, b),
  name: (a, b) => collator.compare(a.shortName, b.shortName) || byId(a, b),
};

const worstFirst = (a: RivalRowView, b: RivalRowView) =>
  a.balance - b.balance || b.played - a.played || byId(a, b);
const mostPlayed = (a: RivalRowView, b: RivalRowView) => b.played - a.played || byId(a, b);

export function buildRivalsView(input: RivalsViewInput): RivalsView {
  const { index, clubId, catalog, competitionNames } = input;
  const fan: FanPeriod = fanPeriod(input.startDate, input.now);

  // Options come from the counted matches of the fan's whole period, before any filter.
  const counted = selectViews(index, clubId, fan).views;
  const years = [...new Set(counted.map((view) => Number(view.match.date.slice(0, 4))))].sort(
    (a, b) => a - b,
  );
  const types = [
    ...new Set(counted.map((view) => competitionById(index, view.competitionId).type)),
  ].sort(compareText);
  const currentYear = Number(fan.end.slice(0, 4));
  const bounds = {
    minYear: years[0] ?? currentYear,
    maxYear: years[years.length - 1] ?? currentYear,
    types,
  };

  const filter = parseRivalsFilter(input.filter, bounds);
  const yearsActive = filter.fromYear !== bounds.minYear || filter.toYear !== bounds.maxYear;
  const period = yearsActive
    ? narrowPeriod(fan, { fromYear: filter.fromYear, toYear: filter.toYear })
    : fan;
  const groups = groupRivals(
    index,
    clubId,
    period,
    filter.type === "all" ? {} : { competitionTypes: [filter.type] },
  );

  const rows = groups.all.map((row) => toRow(row, catalog));
  const group = (list: readonly RivalRow[]) => new Set(list.map((row) => row.rivalId));
  const favorable = group(groups.favorable);
  const even = group(groups.even);
  const unfavorable = group(groups.unfavorable);
  const pick = (ids: Set<string>, order: (a: RivalRowView, b: RivalRowView) => number) =>
    rows
      .filter((row) => ids.has(row.rivalId))
      .sort(order)
      .slice(0, TOP);

  const notice: CoverageNotice = groups.coverage;
  return {
    rows: [...rows].sort(SORTERS[input.sort]),
    summary: {
      favorable: groups.favorable.length,
      even: groups.even.length,
      unfavorable: groups.unfavorable.length,
    },
    totals: { matches: rows.reduce((sum, row) => sum + row.played, 0), rivals: rows.length },
    sections: {
      favorable: pick(favorable, SORTERS.balance),
      even: pick(even, mostPlayed),
      unfavorable: pick(unfavorable, worstFirst),
    },
    since: formatMonthYear(period.start),
    filter,
    filtersActive: yearsActive || filter.type !== "all",
    options: { years, types },
    competitionIds: groups.competitionIds,
    included: includedLine(groups.competitionIds, competitionNames),
    competitionsLabel: joinNames(groups.competitionIds, competitionNames),
    coverage: coverageCopy(notice, competitionNames),
    noMatches: rows.length === 0,
  };
}
