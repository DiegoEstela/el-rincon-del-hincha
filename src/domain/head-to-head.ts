// Methodology: "Head-to-head". The record of one club against one rival inside a fan period.
import type { Rivalry } from "@/data-model/types";
import { whatIsAtStake, type AtStake } from "./at-stake";
import { coverageNotice } from "./coverage-notice";
import { classifyDominance, type Dominance } from "./dominance";
import { finalSeries, type FinalSeries } from "./finals";
import { relevantCompetitionIds, selectViews, tallyMatches } from "./history";
import { compareText } from "./data";
import { computeStreaks, type Streak } from "./streaks";
import type {
  CoverageNotice,
  FanPeriod,
  HistoryRecord,
  MatchFilter,
  MatchView,
  StatsIndex,
} from "./types";

export type HeadToHead = Readonly<{
  clubId: string;
  rivalId: string;
  record: HistoryRecord;
  dominance: Dominance;
  lastMatch: MatchView | null;
  currentStreak: Streak | null;
  bestWinStreak: Streak | null;
  /** Largest played win (administrative results and shoot-outs never qualify). */
  biggestWin: MatchView | null;
  biggestLoss: MatchView | null;
  /** Final series between the two clubs only. */
  finals: readonly FinalSeries[];
  /** Competitions actually included in the numbers (ADR 0003). */
  competitionIds: readonly string[];
  rivalry: Rivalry | null;
  atStake: AtStake;
  /** Coverage of both clubs merged: complete coverage of either one contains every meeting. */
  coverage: CoverageNotice;
}>;

/**
 * The "biggest" match among the candidates: larger margin, then more goals scored by the
 * winning side, then the most recent. Candidates are sorted by date then id, so on a full
 * tie the later one wins.
 */
function biggest(
  candidates: readonly MatchView[],
  margin: (view: MatchView) => number,
  winnerGoals: (view: MatchView) => number,
): MatchView | null {
  return candidates.reduce<MatchView | null>((best, view) => {
    if (best === null) return view;
    const order = margin(view) - margin(best) || winnerGoals(view) - winnerGoals(best);
    return order >= 0 ? view : best;
  }, null);
}

function findRivalry(index: StatsIndex, clubId: string, rivalId: string): Rivalry | null {
  return (
    index.data.rivalries.find(
      (r) =>
        (r.club_a === clubId && r.club_b === rivalId) ||
        (r.club_a === rivalId && r.club_b === clubId),
    ) ?? null
  );
}

export function headToHead(
  index: StatsIndex,
  clubId: string,
  rivalId: string,
  period: FanPeriod,
  filter: MatchFilter = {},
): HeadToHead {
  if (clubId === rivalId) {
    throw new RangeError("A head-to-head needs two different clubs.");
  }
  const { views, suspended } = selectViews(index, clubId, period, { ...filter, rivalId });
  const record = tallyMatches(views, suspended.length);
  const streaks = computeStreaks(views);
  const played = views.filter((view) => !view.isAdministrative);
  const competitionIds = [...new Set(views.map((view) => view.competitionId))].sort(compareText);
  return {
    clubId,
    rivalId,
    record,
    dominance: classifyDominance(record.balance),
    lastMatch: views[views.length - 1] ?? null,
    currentStreak: streaks.current,
    bestWinStreak: streaks.bestWin,
    biggestWin: biggest(
      played.filter((view) => view.outcome === "W"),
      (view) => view.goalsFor - view.goalsAgainst,
      (view) => view.goalsFor,
    ),
    biggestLoss: biggest(
      played.filter((view) => view.outcome === "L"),
      (view) => view.goalsAgainst - view.goalsFor,
      (view) => view.goalsAgainst,
    ),
    finals: finalSeries(index, clubId, period, { ...filter, rivalId }),
    competitionIds,
    rivalry: findRivalry(index, clubId, rivalId),
    atStake: whatIsAtStake(record),
    coverage: coverageNotice(
      index,
      [clubId, rivalId],
      period,
      relevantCompetitionIds(index, [clubId, rivalId], period, views, filter),
    ),
  };
}
