// Reviewed configuration of the RSSSF adapter (plan 0017, ADR 0020). Facts a person approved: the
// source prefix, the tournaments we read, their season ids and names, and the date window of each
// (the year is not written on the pages). The parsers and the normalizer contain no such facts.
import type { Competition } from "../../../src/data-model/types";
import { OPENFOOTBALL_COMPETITIONS } from "../openfootball/config";
import { checkWindow, type DateWindow } from "./dates";
import type { TitleSeason } from "./types";

/** Matches, standings and titles whose `source` starts with this are owned by the adapter. */
export const RSSSF_SOURCE_PREFIX = "https://www.rsssf.org/tablesa/";

export type TournamentConfig = {
  /** Season id, `primera-division-<year>-<tournament>` (plan 0017, D7). */
  id: string;
  competition_id: string;
  /** Spanish name of the season. */
  name: string;
  /** The page (`arg2025`) and the excerpt (`1clausura`) of the manifest. */
  page: string;
  excerpt: string;
  /** Where the year of every `[Mon DD]` comes from: at most 12 months. */
  window: DateWindow;
  /**
   * "own": the adapter writes the whole season. "extends": the season belongs to another source
   * and the adapter only adds the matches dated after `after` (the last match of that source).
   */
  mode: { kind: "own" } | { kind: "extends"; after: string };
  /** The final table counts every match of the season, so it is checked against the matches. */
  tableCoversSeason: boolean;
};

export const RSSSF_COMPETITIONS: readonly Competition[] = OPENFOOTBALL_COMPETITIONS.filter(
  (c) => c.id === "primera-division",
);

export const RSSSF_TOURNAMENTS: readonly TournamentConfig[] = [
  {
    id: "primera-division-2025-apertura",
    competition_id: "primera-division",
    name: "Torneo Apertura 2025",
    page: "arg2025",
    excerpt: "1apertura",
    window: { from: "2025-01-01", to: "2025-06-30" },
    // openfootball has the group stage, up to its last match on 2025-05-04.
    mode: { kind: "extends", after: "2025-05-04" },
    tableCoversSeason: false,
  },
  {
    id: "primera-division-2025-clausura",
    competition_id: "primera-division",
    name: "Torneo Clausura 2025",
    page: "arg2025",
    excerpt: "1clausura",
    window: { from: "2025-07-01", to: "2025-12-31" },
    mode: { kind: "own" },
    tableCoversSeason: true,
  },
];

/** Where the list of champions is in the manifest (plan 0017, D5). */
export const RSSSF_CHAMPIONS = { page: "argchamp", excerpt: "champions" } as const;

const title = (seasonId: string, season: string, tournament: string): TitleSeason => ({
  seasonId,
  competition_id: "primera-division",
  row: { season, tournament },
});

/**
 * The first division seasons we hold and the row of the list that names their champion. The 2025
 * "Anual LPF" is not here on purpose: the AFA proclaimed it outside the regulations (D5).
 */
export const RSSSF_TITLE_SEASONS: readonly TitleSeason[] = [
  title("primera-division-2018-19", "2018/19", "Campeonato"),
  title("primera-division-2019-20", "2019/20", "Campeonato"),
  title("primera-division-2021", "2021", "Campeonato"),
  title("primera-division-2022", "2022", "Campeonato"),
  title("primera-division-2023", "2023", "Campeonato"),
  title("primera-division-2024", "2024", "Campeonato"),
  title("primera-division-2025-apertura", "2025", "Torneo Apertura"),
  title("primera-division-2025-clausura", "2025", "Torneo Clausura"),
];

for (const t of RSSSF_TOURNAMENTS) checkWindow(t.window);
