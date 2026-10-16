// Methodology: "Rivals" (summary cards of the rivals screen). One row per opponent.
import { compareText } from "./data";
import { classifyDominance, Dominance } from "./dominance";
import { coverageNotice } from "./coverage-notice";
import { relevantCompetitionIds, selectViews, tallyMatches } from "./history";
import { opponentOf } from "./match-outcome";
import type {
  CoverageNotice,
  FanPeriod,
  HistoryRecord,
  MatchFilter,
  MatchView,
  StatsIndex,
} from "./types";

export type RivalRow = Readonly<{
  rivalId: string;
  record: HistoryRecord;
  dominance: Dominance;
  /** `is_classic: true` in the rivalries table. */
  isClassic: boolean;
}>;

export type RivalGroups = Readonly<{
  all: readonly RivalRow[];
  /** The club dominates the rival. */
  favorable: readonly RivalRow[];
  even: readonly RivalRow[];
  /** The rival dominates the club. */
  unfavorable: readonly RivalRow[];
  /** Coverage notice of the club, once for the whole screen. */
  coverage: CoverageNotice;
}>;

/** Rivals of the club with `is_classic: true` in the rivalries table. */
export function classicRivalIds(index: StatsIndex, clubId: string): ReadonlySet<string> {
  return new Set(
    index.data.rivalries
      .filter((r) => r.is_classic && (r.club_a === clubId || r.club_b === clubId))
      .map((r) => (r.club_a === clubId ? r.club_b : r.club_a)),
  );
}

/** Balance desc, played desc, rival id asc. Name sorting needs Spanish collation (UI). */
function byStanding(a: RivalRow, b: RivalRow): number {
  return (
    b.record.balance - a.record.balance ||
    b.record.played - a.record.played ||
    compareText(a.rivalId, b.rivalId)
  );
}

export function groupRivals(
  index: StatsIndex,
  clubId: string,
  period: FanPeriod,
  filter: MatchFilter = {},
): RivalGroups {
  const { views, suspended } = selectViews(index, clubId, period, filter);
  const viewsByRival = new Map<string, MatchView[]>();
  for (const view of views) {
    const list = viewsByRival.get(view.rivalId);
    if (list === undefined) viewsByRival.set(view.rivalId, [view]);
    else list.push(view);
  }
  const classics = classicRivalIds(index, clubId);
  const all = [...viewsByRival.entries()]
    .map(([rivalId, rivalViews]): RivalRow => {
      const suspendedCount = suspended.filter((m) => opponentOf(m, clubId) === rivalId).length;
      const record = tallyMatches(rivalViews, suspendedCount);
      return {
        rivalId,
        record,
        dominance: classifyDominance(record.balance),
        isClassic: classics.has(rivalId),
      };
    })
    .sort(byStanding);
  const inGroup = (dominance: Dominance) => all.filter((row) => row.dominance === dominance);
  return {
    all,
    favorable: inGroup(Dominance.Dominates),
    even: inGroup(Dominance.Even),
    unfavorable: inGroup(Dominance.Dominated),
    coverage: coverageNotice(
      index,
      [clubId],
      period,
      relevantCompetitionIds(index, [clubId], views, filter),
    ),
  };
}
