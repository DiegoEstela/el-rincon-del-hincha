// View model of the rivalry detail "[Mi club] vs. [Rival]" (plan 0016). Pure: everything the screen
// shows is computed here from the engine and the copy helpers, so the components stay dumb. The fan
// start date goes in and only a month and year (`since`) comes out; match dates are public facts
// and are shown in full.
import type { Dominance } from "@/domain/dominance";
import { headToHead } from "@/domain/head-to-head";
import { fanPeriod } from "@/domain/period";
import type { MatchView, StatsIndex } from "@/domain/types";
import type { ClubOption } from "./club-options";
import { buildMatchCard, type MatchCardView } from "./match-card-view";
import { coverageCopy, formatMonthYear, includedLine, type CoverageCopy } from "./coverage-copy";
import type { StartMode } from "./fan-storage";
import {
  NEVER_MET_INCLUDED,
  NO_BIGGEST_LOSS,
  NO_BIGGEST_WIN,
  NO_FINALS,
  bestStreakLine,
  finalLine,
  matchesCount,
  stakeLines,
  streakHeadline,
} from "./rivalry-copy";

export type RivalryViewInput = Readonly<{
  /** Built from the two club documents by the caller. */
  index: StatsIndex;
  clubId: string;
  rivalId: string;
  /** The fan start date. It is used to compute and never copied into the result. */
  startDate: string;
  startMode: StartMode;
  now: Date;
  catalog: ReadonlyMap<string, ClubOption>;
  competitionNames: ReadonlyMap<string, string>;
  seasonNames: ReadonlyMap<string, string>;
}>;

export type { MatchCardView, MatchSide } from "./match-card-view";

export type FinalLegView = MatchCardView & Readonly<{ beforePeriod: boolean }>;

export type FinalView = Readonly<{
  season: string;
  /** "Ganaste la final" */
  winner: string;
  legs: readonly FinalLegView[];
}>;

export type RivalryView = Readonly<{
  /** "River vs. Boca" */
  title: string;
  /** Month and year the counted period starts in, such as "mayo de 1990". */
  since: string;
  matchesLine: string;
  /** "Desde mayo de 1990 · 8 partidos" */
  subline: string;
  record: Readonly<{
    played: number;
    won: number;
    drawn: number;
    lost: number;
    /** "+4", "0", "-1" */
    balance: string;
    goalsFor: number;
    goalsAgainst: number;
    dominance: Dominance;
    /** Shares of the played matches, for the bar. They sum to one (all zero when none). */
    bar: Readonly<{ won: number; drawn: number; lost: number }>;
    administrative: number;
    shootouts: number;
  }>;
  stakes: readonly string[];
  lastMatch: MatchCardView | null;
  streak: Readonly<{ headline: string | null; best: string }>;
  biggestWin: MatchCardView | null;
  biggestLoss: MatchCardView | null;
  noBiggestWin: string;
  noBiggestLoss: string;
  finals: readonly FinalView[];
  noFinals: string;
  competitionIds: readonly string[];
  /** "Contamos: ..." */
  included: string;
  coverage: CoverageCopy;
  neverMet: boolean;
}>;

function balanceText(balance: number): string {
  return balance > 0 ? `+${balance}` : String(balance);
}

export function buildRivalryView(input: RivalryViewInput): RivalryView {
  const { index, clubId, rivalId, catalog, competitionNames, seasonNames } = input;
  const fan = fanPeriod(input.startDate, input.now);
  const h = headToHead(index, clubId, rivalId, fan);
  const shortName = (id: string) => catalog.get(id)?.shortName ?? id;
  const own = shortName(clubId);
  const rival = shortName(rivalId);
  const { record } = h;

  const card = (view: MatchView): MatchCardView =>
    buildMatchCard(view, { shortName, competitionNames, seasonNames });

  const neverMet = record.played === 0;
  const since = formatMonthYear(fan.start);
  const matchesLine = matchesCount(record.played);
  const played = record.played;
  return {
    title: `${own} vs. ${rival}`,
    since,
    matchesLine,
    subline: `Desde ${since} · ${matchesLine}`,
    record: {
      played,
      won: record.won,
      drawn: record.drawn,
      lost: record.lost,
      balance: balanceText(record.balance),
      goalsFor: record.goalsFor,
      goalsAgainst: record.goalsAgainst,
      dominance: h.dominance,
      bar: neverMet
        ? { won: 0, drawn: 0, lost: 0 }
        : { won: record.won / played, drawn: record.drawn / played, lost: record.lost / played },
      administrative: record.administrative.count,
      shootouts: record.shootouts.played,
    },
    stakes: stakeLines({
      played,
      won: record.won,
      atStake: h.atStake,
      rivalShortName: rival,
      startMode: input.startMode,
    }),
    lastMatch: h.lastMatch === null ? null : card(h.lastMatch),
    streak: {
      headline: streakHeadline(h.currentStreak, h.currentUnbeaten, h.currentWinless),
      best: bestStreakLine(h.bestWinStreak),
    },
    biggestWin: h.biggestWin === null ? null : card(h.biggestWin),
    biggestLoss: h.biggestLoss === null ? null : card(h.biggestLoss),
    noBiggestWin: NO_BIGGEST_WIN,
    noBiggestLoss: NO_BIGGEST_LOSS,
    finals: h.finals.map((series) => ({
      season: seasonNames.get(series.seasonId) ?? series.seasonId,
      winner: finalLine(series.winner),
      legs: series.legs.map((leg) => ({ ...card(leg), beforePeriod: leg.match.date < fan.start })),
    })),
    noFinals: NO_FINALS,
    competitionIds: h.competitionIds,
    included:
      neverMet && !fan.isEmpty
        ? NEVER_MET_INCLUDED
        : includedLine(h.competitionIds, competitionNames),
    // An empty period (a start in the future) has nothing to be incomplete about.
    coverage: coverageCopy(
      fan.isEmpty ? { isComplete: true, competitions: [] } : h.coverage,
      competitionNames,
    ),
    neverMet,
  };
}
