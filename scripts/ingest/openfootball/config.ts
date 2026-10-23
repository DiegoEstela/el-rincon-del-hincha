// Reviewed configuration of the openfootball adapter (plan 0011, ADR 0015).
// Everything here is data a person approved: the pinned commit and hashes, the competitions and
// season names (with permanent Wikipedia sources), and the stage table. The parser and normalizer
// contain no such facts.
import type { Competition } from "../../../src/data-model/types";

/** Latest commit touching `argentina/` when the pin was set (2026-10-17). */
export const OPENFOOTBALL_COMMIT = "18fcfc41566d30928f6a683b9cdf3973e22c7974";

/** Matches owned by this adapter: every `source` starting with this is replaced on each run. */
export const OPENFOOTBALL_SOURCE_PREFIX = "https://github.com/openfootball/south-america/";

export function fileUrl(file: string): string {
  return `https://raw.githubusercontent.com/openfootball/south-america/${OPENFOOTBALL_COMMIT}/argentina/${file}`;
}

/** Permanent link to a file at the pinned commit, with a `#L<line>` anchor when `line` is given. */
export function permalink(file: string, line?: number): string {
  const base = `${OPENFOOTBALL_SOURCE_PREFIX}blob/${OPENFOOTBALL_COMMIT}/argentina/${file}`;
  return line === undefined ? base : `${base}#L${line}`;
}

export type OpenfootballFile = { file: string; sha256: string };

export const OPENFOOTBALL_FILES: readonly OpenfootballFile[] = [
  {
    file: "2018-19_ar1.txt",
    sha256: "b75303bf01ee603219ef07e008b648e22a339e7153a767fecc200443f51eae68",
  },
  {
    file: "2019-20_ar1.txt",
    sha256: "0c50deae30e861fb3b66343cf8365f925dd8eb9e6525a8266994acab37318c50",
  },
  {
    file: "2020_ar1.txt",
    sha256: "70602786cb0102d4a3bc9b8d2b7ed53987459547581376483201301a62c500cd",
  },
  {
    file: "2021_ar1.txt",
    sha256: "1e75af6d390ab4cd8dc382362d3a0d751f866283bb7a31507f1c9d05899060f1",
  },
  {
    file: "2022_ar1.txt",
    sha256: "d560e9d6172853dd95ff2ffe71586d6cc6ad6d593ff9e5a06684abd159b83cca",
  },
  {
    file: "2023_ar1.txt",
    sha256: "0d20768c23ff850a4b30240c6cf648524230b93578cb09a988df2a817d3974ef",
  },
  {
    file: "2024_ar1.txt",
    sha256: "41a6a36df3ff50d8b554bfa739a8052c6f0876f8ec6a5393e11681e2624ae0db",
  },
  {
    file: "2025_ar1.txt",
    sha256: "e087b6827b229bfd797da1293f735ba1958d54c294a27bc7eb863bca5bf71289",
  },
];

// Competition sources are permanent revisions (oldid) of the Spanish Wikipedia articles, read on
// 2026-10-17. Both state that the AFA organizes the competition (through its Liga Profesional).
export const OPENFOOTBALL_COMPETITIONS: readonly Competition[] = [
  {
    id: "copa-de-la-liga-profesional",
    name: "Copa de la Liga Profesional",
    type: "national_cup",
    scope: "domestic",
    organizer: "AFA",
    afa_recognized: true,
    source:
      "https://es.wikipedia.org/w/index.php?title=Copa_de_la_Liga_Profesional&oldid=171436790",
  },
  {
    id: "primera-division",
    name: "Primera División",
    type: "league",
    scope: "domestic",
    organizer: "AFA",
    afa_recognized: true,
    notes:
      "Organized by the AFA through its Liga Profesional; run by the Superliga Argentina from 2017-18 to 2019-20.",
    source:
      "https://es.wikipedia.org/w/index.php?title=Primera_Divisi%C3%B3n_de_Argentina&oldid=175775265",
  },
];

export type OpenfootballSeason = {
  id: string;
  competition_id: string;
  name: string;
  file: string;
  /**
   * Set when the source file stops before the real end of the tournament. `end` and `source` then
   * come from the cited reference instead of the file.
   */
  partial?: { end: string; source: string };
  /**
   * The winner of the final of this season is its champion, and a title is written from that
   * match (a cup decided in one final). Leagues get their titles from another source.
   */
  titleFromFinal?: boolean;
};

export const OPENFOOTBALL_SEASONS: readonly OpenfootballSeason[] = [
  {
    id: "primera-division-2018-19",
    competition_id: "primera-division",
    name: "Superliga 2018-19",
    file: "2018-19_ar1.txt",
  },
  {
    id: "primera-division-2019-20",
    competition_id: "primera-division",
    name: "Superliga 2019-20",
    file: "2019-20_ar1.txt",
  },
  {
    id: "copa-de-la-liga-profesional-2020",
    competition_id: "copa-de-la-liga-profesional",
    name: "Copa Diego Armando Maradona 2020",
    file: "2020_ar1.txt",
    // A single final (Boca 1-1 Banfield, 5-3 on penalties), already loaded as a match.
    titleFromFinal: true,
  },
  {
    id: "primera-division-2021",
    competition_id: "primera-division",
    name: "Liga Profesional 2021",
    file: "2021_ar1.txt",
  },
  {
    id: "primera-division-2022",
    competition_id: "primera-division",
    name: "Liga Profesional 2022",
    file: "2022_ar1.txt",
  },
  {
    id: "primera-division-2023",
    competition_id: "primera-division",
    name: "Liga Profesional 2023",
    file: "2023_ar1.txt",
  },
  {
    id: "primera-division-2024",
    competition_id: "primera-division",
    name: "Liga Profesional 2024",
    file: "2024_ar1.txt",
  },
  {
    id: "primera-division-2025-apertura",
    competition_id: "primera-division",
    name: "Torneo Apertura 2025",
    file: "2025_ar1.txt",
    // The file only has the group stage (until 2025-05-04). The final was played on 2025-06-01
    // (Platense 1-0 Huracán), per the Spanish Wikipedia season article below, and reported the same day
    // by La Nación (lanacion.com.ar, nid01062025) and Noticias NQN (noticiasnqn.com.ar, 2025/06/01).
    partial: {
      end: "2025-06-01",
      source:
        "https://es.wikipedia.org/w/index.php?title=Campeonato_de_Primera_Divisi%C3%B3n_2025_(Argentina)&oldid=175770270",
    },
  },
];

type StageRule = { pattern: RegExp; label: (m: RegExpExecArray) => string; isFinal: boolean };

// Exhaustive, in order. `is_final` is true only for the match that decides a title, never because
// a heading contains "Final": the other two 2020 "finals" award no title.
const STAGE_RULES: readonly StageRule[] = [
  { pattern: /^Matchday (\d+)$/, label: (m) => `Fecha ${m[1]}`, isFinal: false },
  { pattern: /^1° Semestre, Matchday (\d+)$/, label: (m) => `Fecha ${m[1]}`, isFinal: false },
  { pattern: /^Group ([A-Z])$/, label: (m) => `Zona ${m[1]}`, isFinal: false },
  {
    pattern: /^Fase Campeón, Gruppe (\d)$/,
    label: (m) => `Fase Campeón, Zona ${m[1]}`,
    isFinal: false,
  },
  { pattern: /^Fase Campeón, Final$/, label: () => "Final", isFinal: true },
  {
    pattern: /^Fase Complementación, Gruppe (\d)$/,
    label: (m) => `Fase Complementación, Zona ${m[1]}`,
    isFinal: false,
  },
  {
    pattern: /^Fase Complementación, Final$/,
    label: () => "Fase Complementación, Final",
    isFinal: false,
  },
  { pattern: /^Copa Sud, Final$/, label: () => "Definición Copa Sudamericana", isFinal: false },
];

export function mapStage(heading: string): { stage: string; is_final: boolean } {
  for (const rule of STAGE_RULES) {
    const m = rule.pattern.exec(heading);
    if (m) return { stage: rule.label(m), is_final: rule.isFinal };
  }
  throw new Error(`unknown stage heading "${heading}"`);
}
