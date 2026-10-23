// What a layout parser returns (plan 0017). Names are the spellings of the page, not club ids:
// resolving them is the normalizer job, so a parser never needs the club list.
import type { DateWindow } from "./dates";

export type ParsedTableRow = {
  line: number;
  position: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** What follows the points on the row (headquarters, "(Round of 16)"), or null. */
  suffix: string | null;
  /** The last label above the row ("Champion", "Runner-up", "Teams eliminated in ..."), or null. */
  mark: string | null;
};

export type ParsedTable = {
  /** Line of the header. */
  line: number;
  /** "full" for the table with full legal names, "short" for the others. */
  kind: "full" | "short";
  rows: ParsedTableRow[];
};

export type ParsedMatch = {
  line: number;
  /** ISO date resolved from the window of the tournament. */
  date: string;
  stage: string;
  home: string;
  away: string;
  /** Null for an abandoned match shown with `-`. */
  homeGoals: number | null;
  awayGoals: number | null;
  extraTime: boolean;
  penalties: { home: number; away: number } | null;
  /** The text after "abandoned at", or null. */
  abandoned: string | null;
  /** The text after "remaining", or null: this line completes an abandoned match. */
  resumed: string | null;
};

export type ParsedTournament = {
  excerpt: string;
  tables: ParsedTable[];
  matches: ParsedMatch[];
};

export type LayoutContext = {
  window: DateWindow;
  /** Reviewed lines (exact text) that may appear where a match line would be and are skipped. */
  ignore: readonly string[];
};

/** A season whose champion is written as a title: the row of the list of champions it comes from. */
export type TitleSeason = {
  seasonId: string;
  competition_id: string;
  /** Season ("2018/19", "2025") and tournament ("Campeonato", "Torneo Clausura") of the row. */
  row: { season: string; tournament: string };
};
