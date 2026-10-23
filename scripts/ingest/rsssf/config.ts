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
  /**
   * Cups (ADR 0022): only the matches where one of the selectable clubs plays are written. The rest
   * are read and checked, and the season is dated from every match of the section.
   */
  appClubsOnly?: boolean;
  /** The tournament has one final that decides the title: the title is written from it. */
  titleFromFinal?: boolean;
};

const wiki = (title: string, oldid: number) =>
  `https://es.wikipedia.org/w/index.php?title=${title}&oldid=${oldid}`;

// The cups are organized by the AFA (through its Liga Profesional for the Trofeo de Campeones), so
// they count as titles (ADR 0021). Sources are permanent revisions of the Spanish Wikipedia
// articles, read on 2026-10-23; each one says that the AFA organizes the competition.
export const RSSSF_COMPETITIONS: readonly Competition[] = [
  ...OPENFOOTBALL_COMPETITIONS.filter((c) => c.id === "primera-division"),
  {
    id: "copa-argentina",
    name: "Copa Argentina",
    type: "national_cup",
    scope: "domestic",
    organizer: "AFA",
    afa_recognized: true,
    source: wiki("Copa_Argentina_(f%C3%BAtbol)", 175769996),
  },
  {
    id: "supercopa-argentina",
    name: "Supercopa Argentina",
    type: "other",
    scope: "domestic",
    organizer: "AFA",
    afa_recognized: true,
    source: wiki("Supercopa_Argentina", 175772737),
  },
  {
    id: "supercopa-internacional",
    name: "Supercopa Internacional",
    type: "other",
    scope: "domestic",
    organizer: "AFA",
    afa_recognized: true,
    notes: "Played at a neutral venue, abroad in some editions.",
    source: wiki("Supercopa_Internacional", 175748744),
  },
  {
    id: "trofeo-de-campeones",
    name: "Trofeo de Campeones de la Liga Profesional",
    type: "other",
    scope: "domestic",
    organizer: "AFA",
    afa_recognized: true,
    notes: "Organized by the AFA through its Liga Profesional.",
    source: wiki("Trofeo_de_Campeones_de_Primera_Divisi%C3%B3n", 175789259),
  },
];

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

/** One cup edition: a section of a season page, read with the `cup-full-names` layout. */
const cup = (
  id: string,
  competition_id: string,
  name: string,
  page: string,
  excerpt: string,
  window: { from: string; to: string },
): TournamentConfig => ({
  id,
  competition_id,
  name,
  page,
  excerpt,
  window,
  mode: { kind: "own" },
  tableCoversSeason: false,
  appClubsOnly: true,
  titleFromFinal: true,
});

const year = (y: number) => ({ from: `${y}-01-01`, to: `${y}-12-31` });

/**
 * The domestic cups of 2023 to 2025 (plan 0017, Phase B2). The windows are the year in which the
 * edition was played, which is not always the year of the page: the Supercopa Argentina 2023 was
 * played in 2024, and the Supercopa Internacional 2023 and 2024 in 2025 and the one of 2025 in 2026.
 * The Copa de la Liga is not here: its groups and tables need their own layout (PR B2b).
 */
export const RSSSF_CUP_TOURNAMENTS: readonly TournamentConfig[] = [
  cup(
    "copa-argentina-2023",
    "copa-argentina",
    "Copa Argentina 2023",
    "arg2023",
    "nationalcup",
    year(2023),
  ),
  cup(
    "copa-argentina-2024",
    "copa-argentina",
    "Copa Argentina 2024",
    "arg2024",
    "nationalcup",
    year(2024),
  ),
  cup(
    "copa-argentina-2025",
    "copa-argentina",
    "Copa Argentina 2025",
    "arg2025",
    "nationalcup",
    year(2025),
  ),
  cup(
    "trofeo-de-campeones-2023",
    "trofeo-de-campeones",
    "Trofeo de Campeones 2023",
    "arg2023",
    "leaguesuper",
    year(2023),
  ),
  cup(
    "trofeo-de-campeones-2024",
    "trofeo-de-campeones",
    "Trofeo de Campeones 2024",
    "arg2024",
    "leaguesuper",
    year(2024),
  ),
  cup(
    "trofeo-de-campeones-2025",
    "trofeo-de-campeones",
    "Trofeo de Campeones 2025",
    "arg2025",
    "1champtroph",
    year(2025),
  ),
  cup(
    "supercopa-argentina-2023",
    "supercopa-argentina",
    "Supercopa Argentina 2023",
    "arg2023",
    "supercup",
    year(2024),
  ),
  cup(
    "supercopa-argentina-2024",
    "supercopa-argentina",
    "Supercopa Argentina 2024",
    "arg2024",
    "supercup",
    year(2025),
  ),
  cup(
    "supercopa-internacional-2023",
    "supercopa-internacional",
    "Supercopa Internacional 2023",
    "arg2023",
    "lpfsuper",
    year(2025),
  ),
  cup(
    "supercopa-internacional-2024",
    "supercopa-internacional",
    "Supercopa Internacional 2024",
    "arg2024",
    "lpfsuper",
    year(2025),
  ),
  cup(
    "supercopa-internacional-2025",
    "supercopa-internacional",
    "Supercopa Internacional 2025",
    "arg2025",
    "lpfsuper",
    year(2026),
  ),
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

for (const t of [...RSSSF_TOURNAMENTS, ...RSSSF_CUP_TOURNAMENTS]) checkWindow(t.window);
