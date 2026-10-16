// Shared types of the statistics engine (plan 0005, ADR 0010). Everything is read-only.
import type {
  Club,
  Competition,
  Coverage,
  Match,
  Movement,
  Rivalry,
  Season,
  Title,
} from "@/data-model/types";
import type { Outcome } from "./match-outcome";

/** `YYYY-MM-DD`, a calendar date in America/Argentina/Buenos_Aires. */
export type IsoDate = string;

/** The data the engine reads: a narrow view of the data model, without file names. */
export type StatsData = Readonly<{
  clubs: readonly Club[];
  competitions: readonly Competition[];
  seasons: readonly Season[];
  matches: readonly Match[];
  titles: readonly Title[];
  movements: readonly Movement[];
  rivalries: readonly Rivalry[];
  coverage: readonly Coverage[];
}>;

export type StatsIndex = Readonly<{
  data: StatsData;
  seasonById: ReadonlyMap<string, Season>;
  competitionById: ReadonlyMap<string, Competition>;
  /** Matches of each club, home or away, sorted by date then id. Suspended ones included. */
  matchesByClub: ReadonlyMap<string, readonly Match[]>;
}>;

/** `[start, end]`, both inclusive. `isEmpty` when the start is after today (future start). */
export type FanPeriod = Readonly<{ start: IsoDate; end: IsoDate; isEmpty: boolean }>;

/** One counted match seen from one club. */
export type MatchView = Readonly<{
  match: Match;
  competitionId: string;
  rivalId: string;
  /** A penalty shoot-out is a draw ("D"). */
  outcome: Outcome;
  /** Regulation plus extra time; shoot-out goals never count. */
  goalsFor: number;
  goalsAgainst: number;
  shootout: "won" | "lost" | null;
  /** `status === "administrative_result"`, so the UI can mark it. */
  isAdministrative: boolean;
}>;

export type MatchFilter = Readonly<{
  competitionIds?: readonly string[];
  competitionTypes?: readonly Competition["type"][];
}>;

export type HistoryRecord = Readonly<{
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** won - lost; draws do not change it. */
  balance: number;
  /** Shoot-outs are already counted as draws in `drawn`. */
  shootouts: Readonly<{ played: number; won: number; lost: number }>;
  administrative: Readonly<{ count: number; matchIds: readonly string[] }>;
  /** Suspended matches inside the period (and filter): reported, never counted. */
  suspendedExcluded: number;
}>;

export type CompetitionCoverage = Readonly<{
  competitionId: string;
  status: "complete" | "partial" | "missing";
  /** Start of the complete stretch closest to the period end. */
  completeFrom: IsoDate | null;
  /** End of that stretch; null = ongoing (or no stretch). */
  completeTo: IsoDate | null;
}>;

export type CoverageNotice = Readonly<{
  /** True only if every listed competition is "complete". */
  isComplete: boolean;
  competitions: readonly CompetitionCoverage[];
}>;
