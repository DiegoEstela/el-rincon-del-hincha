// Methodology: "Fan comparison". A scoreboard by category (no single greatness metric) and
// the direct head-to-head from the later start date.
import { calculateHistory } from "./history";
import { finalSeries } from "./finals";
import { headToHead, type HeadToHead } from "./head-to-head";
import { classicRivalIds } from "./rivals";
import { fanPeriod, inPeriod, laterStart } from "./period";
import { titlesInPeriod } from "./titles";
import { computeStreaks } from "./streaks";
import type { CoverageNotice, FanPeriod, IsoDate, StatsIndex } from "./types";

export type Fan = Readonly<{ clubId: string; start: IsoDate }>;

export type FanSummary = Readonly<{
  clubId: string;
  period: FanPeriod;
  /** Recognized titles in the period; a shared title counts fully. */
  totalTitles: number;
  internationalTitles: number;
  domesticTitles: number;
  finalsWon: number;
  finalsPlayed: number;
  /** Sum of the balances against every classic rival; null if the club has none defined. */
  classicsBalance: number | null;
  relegations: number;
  /** Length of the best win streak over all counted matches (0 without wins). */
  bestStreak: number;
  coverage: CoverageNotice;
}>;

export function fanSummary(index: StatsIndex, fan: Fan, now: Date): FanSummary {
  const period = fanPeriod(fan.start, now);
  const history = calculateHistory(index, fan.clubId, period);
  const titles = titlesInPeriod(index, fan.clubId, period);
  const finals = finalSeries(index, fan.clubId, period);
  const classics = classicRivalIds(index, fan.clubId);
  const classicsBalance =
    classics.size === 0
      ? null
      : history.matches
          .filter((view) => classics.has(view.rivalId))
          .reduce(
            (sum, view) => sum + (view.outcome === "W" ? 1 : 0) - (view.outcome === "L" ? 1 : 0),
            0,
          );
  return {
    clubId: fan.clubId,
    period,
    totalTitles: titles.length,
    internationalTitles: titles.filter((t) => t.shelf === "international").length,
    domesticTitles: titles.filter((t) => t.shelf === "domestic").length,
    finalsWon: finals.filter((s) => s.winner === "club").length,
    finalsPlayed: finals.length,
    classicsBalance,
    relegations: index.data.movements.filter(
      (m) => m.club_id === fan.clubId && m.type === "relegation" && inPeriod(m.date, period),
    ).length,
    bestStreak: computeStreaks(history.matches).bestWin?.length ?? 0,
    coverage: history.coverage,
  };
}

export type CategoryId =
  | "total_titles"
  | "international_titles"
  | "domestic_titles"
  | "finals_won"
  | "finals_played"
  | "classics_balance"
  | "relegations_suffered"
  | "best_win_streak";

export type CategoryWinner = "a" | "b" | "tie" | "not_applicable";

export type CategoryResult = Readonly<{
  id: CategoryId;
  a: number | null;
  b: number | null;
  better: "higher" | "lower";
  winner: CategoryWinner;
}>;

type CategoryDefinition = Readonly<{
  id: CategoryId;
  better: "higher" | "lower";
  value: (summary: FanSummary) => number | null;
}>;

const CATEGORIES: readonly CategoryDefinition[] = [
  { id: "total_titles", better: "higher", value: (s) => s.totalTitles },
  { id: "international_titles", better: "higher", value: (s) => s.internationalTitles },
  { id: "domestic_titles", better: "higher", value: (s) => s.domesticTitles },
  { id: "finals_won", better: "higher", value: (s) => s.finalsWon },
  { id: "finals_played", better: "higher", value: (s) => s.finalsPlayed },
  { id: "classics_balance", better: "higher", value: (s) => s.classicsBalance },
  { id: "relegations_suffered", better: "lower", value: (s) => s.relegations },
  { id: "best_win_streak", better: "higher", value: (s) => s.bestStreak },
];

function winnerOf(a: number | null, b: number | null, better: "higher" | "lower"): CategoryWinner {
  if (a === null || b === null) return "not_applicable";
  if (a === b) return "tie";
  const aIsBetter = better === "higher" ? a > b : a < b;
  return aIsBetter ? "a" : "b";
}

export type FanComparison = Readonly<{
  a: FanSummary;
  b: FanSummary;
  categories: readonly CategoryResult[];
  /** Categories won by each side and ties. There is no total or weighted score. */
  scoreboard: Readonly<{ a: number; b: number; ties: number }>;
  /** Direct head-to-head from the later start date, from fan A's perspective. */
  headToHead: HeadToHead | null;
  headToHeadReason: "same_club" | null;
}>;

export function compareFans(index: StatsIndex, fanA: Fan, fanB: Fan, now: Date): FanComparison {
  const a = fanSummary(index, fanA, now);
  const b = fanSummary(index, fanB, now);
  const categories = CATEGORIES.map((category): CategoryResult => ({
    id: category.id,
    a: category.value(a),
    b: category.value(b),
    better: category.better,
    winner: winnerOf(category.value(a), category.value(b), category.better),
  }));
  const sameClub = fanA.clubId === fanB.clubId;
  return {
    a,
    b,
    categories,
    scoreboard: {
      a: categories.filter((c) => c.winner === "a").length,
      b: categories.filter((c) => c.winner === "b").length,
      ties: categories.filter((c) => c.winner === "tie").length,
    },
    headToHead: sameClub
      ? null
      : headToHead(
          index,
          fanA.clubId,
          fanB.clubId,
          fanPeriod(laterStart(fanA.start, fanB.start), now),
        ),
    headToHeadReason: sameClub ? "same_club" : null,
  };
}
