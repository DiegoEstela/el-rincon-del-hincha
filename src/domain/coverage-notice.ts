// ADR 0003: coverage is per competition and partial coverage is always shown.
import { nextDay } from "@/data-model/dates";
import type { Coverage } from "@/data-model/types";
import { compareText } from "./data";
import type { CompetitionCoverage, CoverageNotice, FanPeriod, IsoDate, StatsIndex } from "./types";

export type Interval = Readonly<{ from: IsoDate; to: IsoDate | null }>;

/**
 * Merges the `complete` rows into disjoint stretches, sorted by start. Overlapping and
 * adjacent rows (`next.from <= nextDay(prev.to)`) are joined; `to: null` means ongoing.
 */
export function mergeCompleteIntervals(rows: readonly Coverage[]): readonly Interval[] {
  const sorted = rows
    .filter((row) => row.complete)
    .map((row): Interval => ({ from: row.from, to: row.to }))
    .sort((a, b) => compareText(a.from, b.from));
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && (last.to === null || interval.from <= nextDay(last.to))) {
      const to =
        last.to === null || interval.to === null
          ? null
          : interval.to > last.to
            ? interval.to
            : last.to;
      merged[merged.length - 1] = { from: last.from, to };
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function containsPeriod(interval: Interval, period: FanPeriod): boolean {
  return interval.from <= period.start && (interval.to === null || interval.to >= period.end);
}

function overlapsPeriod(interval: Interval, period: FanPeriod): boolean {
  return interval.from <= period.end && (interval.to === null || interval.to >= period.start);
}

function competitionCoverage(
  index: StatsIndex,
  clubIds: readonly string[],
  period: FanPeriod,
  competitionId: string,
): CompetitionCoverage {
  const rows = index.data.coverage.filter(
    (row) => row.competition_id === competitionId && clubIds.includes(row.club_id),
  );
  const intervals = mergeCompleteIntervals(rows);
  const containing = intervals.find((interval) => containsPeriod(interval, period));
  if (containing !== undefined) {
    return {
      competitionId,
      status: "complete",
      completeFrom: containing.from,
      completeTo: containing.to,
    };
  }
  const overlapping = intervals.filter((interval) => overlapsPeriod(interval, period));
  const closest = overlapping[overlapping.length - 1];
  if (closest === undefined) {
    return { competitionId, status: "missing", completeFrom: null, completeTo: null };
  }
  return {
    competitionId,
    status: "partial",
    completeFrom: closest.from,
    completeTo: closest.to,
  };
}

/**
 * Coverage notice of the given clubs over a period, for the given competitions. With several
 * clubs (a head-to-head) their rows are merged: complete coverage of either one contains every
 * match between them. An empty period shows nothing; a real period with no competitions at all
 * is never reported as complete.
 */
export function coverageNotice(
  index: StatsIndex,
  clubIds: readonly string[],
  period: FanPeriod,
  competitionIds: readonly string[],
): CoverageNotice {
  if (period.isEmpty) return { isComplete: true, competitions: [] };
  const unique = [...new Set(competitionIds)].sort(compareText);
  const competitions = unique.map((id) => competitionCoverage(index, clubIds, period, id));
  return {
    isComplete: competitions.length > 0 && competitions.every((c) => c.status === "complete"),
    competitions,
  };
}
