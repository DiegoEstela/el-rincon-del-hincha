// Spanish copy of the vitrina (plan 0018, ADR 0021). Built from the engine only: it never receives
// the fan start date, and there is deliberately no "complete" wording anywhere, because the cups
// are not loaded (plan 0014, Phase 2) and the champions of a competition are loaded only in part.
import type { TitleWindow } from "@/domain/titles";
import type { CoverageCopy } from "./coverage-copy";
import { joinNames } from "./coverage-copy";
import type { StartMode } from "./fan-storage";
import { formatMatchDate } from "./rivalry-copy";

export const COUNTER_CAPTION = "En los torneos y temporadas que tenemos cargados.";
export const COUNTER_MISSING = "Trofeos que te faltan";
export const CRITERION =
  "Contamos solo títulos reconocidos por la AFA. Un título compartido cuenta entero para cada campeón.";

export const SHELF_TITLES = {
  international: "Internacionales",
  domestic: "Locales",
  other: "Otros",
} as const;

export const UNDER_CONSTRUCTION = {
  international:
    "Todavía no cargamos Libertadores, Sudamericana ni las otras copas internacionales. La vitrina está en obra.",
  other: "Todavía no cargamos supercopas ni otros trofeos.",
} as const;

const SINCE: Record<StartMode, string> = {
  birth: "desde que naciste",
  other: "desde que sos hincha",
};

/** "Trofeos ganados desde que naciste" / "... desde que sos hincha". */
export function wonLabel(startMode: StartMode): string {
  return `Trofeos ganados ${SINCE[startMode]}`;
}

/** "Superliga 2018-19, campeón el 7 de abril de 2019. Ver detalle" */
export function trophyButtonLabel(seasonName: string, awardedOn: string): string {
  return `${seasonName}, campeón el ${formatMatchDate(awardedOn)}. Ver detalle`;
}

/** The caption of a silhouette: the seasons in which the champion is loaded. */
export function silhouetteCaption(firstSeason: string, lastSeason: string): string {
  return firstSeason === lastSeason
    ? `No lo ganaste en ${firstSeason}.`
    : `No lo ganaste entre ${firstSeason} y ${lastSeason}.`;
}

export type ChecklistStatus = "won" | "missing" | "unknown";

export function checklistLabel(status: ChecklistStatus, wonCount: number): string {
  if (status === "won") return `Ganado (${wonCount})`;
  return status === "missing" ? "Te falta" : "Sin datos todavía";
}

/** "La final" when the title was decided in a final, "La última fecha" in a league. */
export function matchHeading(isFinal: boolean): string {
  return isFinal ? "La final" : "La última fecha";
}

export const NO_DECIDING_MATCH = "No tenemos cargado el partido que lo definió.";

/** "Compartido con A." / "Compartido con A y B." (empty list: null). */
export function sharedWith(clubNames: readonly string[]): string | null {
  return clubNames.length === 0 ? null : `Compartido con ${joinNames(clubNames, new Map())}.`;
}

/** The host of an https link; anything else (or a broken URL) has no link. */
export function sourceHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export function zeroTitlesLine(startMode: StartMode): string {
  return `Todavía no levantaste ninguna copa ${SINCE[startMode]}. La vitrina está limpita y con lugar de sobra.`;
}

export const NO_TITLES_LOADED = {
  title: "Todavía no cargamos los títulos",
  text: "Cuando lleguen, tu vitrina se arma sola. Mientras tanto, mirá cómo te fue contra cada rival.",
  action: "Ver rivales",
} as const;

export const EMPTY_PERIOD = {
  title: "Tu historia todavía no empezó",
  text: "Cuando empiece, acá van a ir las copas.",
} as const;

export const BEFORE_PERIOD = {
  title: (count: number) => `Antes de que llegaras (${count})`,
  text: "Los festejó tu club antes de que te hicieras hincha. No suman a tu vitrina, pero son parte de la historia.",
} as const;

export const DISPUTED = {
  title: "Títulos discutidos",
  text: "No los contamos: no están reconocidos por la AFA.",
} as const;

/** What the notice needs about one competition. Names are already resolved. */
export type NoticeRow = Readonly<{
  competitionName: string;
  window: TitleWindow;
  firstSeasonName: string | null;
  lastSeasonName: string | null;
  /** The seasons without champion inside the window that overlap the fan period. */
  missingSeasonNames: readonly string[];
  /** The window overlaps the fan period. */
  windowInPeriod: boolean;
}>;

const NOTICE_HEADING = "Tu vitrina puede estar incompleta";
const NOTICE_LEAD = "Mostramos solo los títulos que tenemos cargados.";
const HIDDEN: CoverageCopy = { show: false, heading: "", lead: "", lines: [] };

/**
 * The note of the vitrina. It shows for every non-empty period (the cups are not loaded and no
 * title source reaches today), and it never says the history is complete.
 */
export function titleCoverageCopy(
  rows: readonly NoticeRow[],
  periodIsEmpty: boolean,
): CoverageCopy {
  if (periodIsEmpty) return HIDDEN;
  const lines = rows.flatMap((row): string[] => {
    const { competitionName: name, window } = row;
    if (window.firstSeasonId === null) {
      return [`${name}: todavía no tenemos sus campeones.`];
    }
    if (!row.windowInPeriod) {
      return [`${name}: no tenemos campeones cargados en tu período.`];
    }
    const loaded =
      row.firstSeasonName === row.lastSeasonName
        ? `${name}: tenemos el campeón de ${row.firstSeasonName}.`
        : `${name}: tenemos los campeones de ${row.firstSeasonName} a ${row.lastSeasonName}.`;
    return [
      loaded,
      ...row.missingSeasonNames.map((season) => `${name}: nos falta el campeón de ${season}.`),
    ];
  });
  return { show: true, heading: NOTICE_HEADING, lead: NOTICE_LEAD, lines };
}

/** "Contamos títulos de: A y B." from the competitions with a champion loaded in the period. */
export function titlesIncludedLine(competitionNames: readonly string[]): string {
  if (competitionNames.length === 0) return "Todavía no cargamos títulos.";
  return `Contamos títulos de: ${joinNames(competitionNames, new Map())}.`;
}
