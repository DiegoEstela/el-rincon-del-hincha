// Spanish copy of the rivalry detail (plan 0016). Pure: every sentence of the screen that depends
// on numbers is built here, so the components only place text. Dates are match dates or months of
// match dates; the only text derived from the fan start date is the month and year of the period.
import type { AtStake } from "@/domain/at-stake";
import type { Run, Streak } from "@/domain/streaks";
import type { Outcome } from "@/domain/match-outcome";
import type { SeriesWinner } from "@/domain/finals";
import type { MatchView } from "@/domain/types";
import { MONTHS, formatMonthYear } from "./coverage-copy";
import type { StartMode } from "./fan-storage";

/** A threshold counts as "near" at this many results away (methodology, "Notes for the UI"). */
export const STAKE_NEAR = 3;

export const ADMINISTRATIVE_NOTE = "Resultado administrativo";
export const NEVER_MET_INCLUDED = "Todavía no se cruzaron en los torneos que tenemos cargados.";
export const NO_BIGGEST_WIN = "Todavía no le ganaste en tu período. Ya va a llegar.";
export const NO_BIGGEST_LOSS = "Nunca te ganaron en tu período. Que siga así.";
export const NO_FINALS =
  "No se cruzaron en ninguna final en tu período. Por ahora, todo se define en el torneo.";
export const FINALS_SCOPE = "Contamos solo las finales de los torneos que tenemos cargados.";
export const BEFORE_PERIOD = "(antes de tu período)";
export const NO_WIN_EVER = "Todavía no le ganaste en tu período.";

/** "2025-04-27" -> "27 de abril de 2025". Own table, no `Intl`, no leading zero. */
export function formatMatchDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${Number(day)} de ${MONTHS[Number(month) - 1]} de ${year}`;
}

const RESULT_LABELS: Record<Outcome, string> = {
  W: "Ganaste",
  D: "Empataste",
  L: "Perdiste",
};

export function resultLabel(outcome: Outcome): string {
  return RESULT_LABELS[outcome];
}

/** The shoot-out of a match from the fan side: "Ganaste 5 a 3 por penales". Null if none. */
export function penaltiesNote(view: MatchView): string | null {
  if (view.shootout === null) return null;
  const fanIsHome = view.match.home_id !== view.rivalId;
  const own = (fanIsHome ? view.match.home_penalties : view.match.away_penalties) ?? 0;
  const other = (fanIsHome ? view.match.away_penalties : view.match.home_penalties) ?? 0;
  const verb = view.shootout === "won" ? "Ganaste" : "Perdiste";
  return `${verb} ${own} a ${other} por penales`;
}

/** "Primera División · Liga Profesional 2025"; one name when both are the same. */
export function competitionLabel(competition: string, season: string): string {
  return competition === season ? competition : `${competition} · ${season}`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function matchesCount(count: number): string {
  return plural(count, "partido", "partidos");
}

export type StakeInput = Readonly<{
  played: number;
  won: number;
  atStake: AtStake;
  rivalShortName: string;
  startMode: StartMode;
}>;

const ENDING: Record<StartMode, string> = {
  birth: "desde que naciste",
  other: "desde que sos hincha",
};

/** "Lo que está en juego": at most three lines, none for a pair that never met. */
export function stakeLines(input: StakeInput): string[] {
  const { played, won, atStake, rivalShortName, startMode } = input;
  if (played === 0) return [];
  const lines: string[] = [];
  const { winsToImprove, lossesToWorsen } = atStake;
  if (winsToImprove !== null) {
    const goal = atStake.improvesTo === "dominates" ? "pasás a dominar" : "emparejás";
    lines.push(`Con ${plural(winsToImprove, "triunfo", "triunfos")} más ${goal} este historial.`);
  } else if (lossesToWorsen !== null) {
    const need = lossesToWorsen === 1 ? "haría falta" : "harían falta";
    lines.push(
      `Tenés colchón: ${need} ${plural(lossesToWorsen, "derrota", "derrotas")} más para que esto vuelva a estar parejo.`,
    );
  }
  if (winsToImprove !== null && lossesToWorsen !== null && lossesToWorsen <= STAKE_NEAR) {
    lines.push(`Ojo: con ${plural(lossesToWorsen, "derrota", "derrotas")} más te pasan a dominar.`);
  }
  if (won === 0) {
    lines.push(`Todavía no le ganaste ${ENDING[startMode]}. El primero se va a gritar el doble.`);
  } else if (atStake.nextWinMilestone.winsNeeded <= STAKE_NEAR) {
    const { milestone, winsNeeded } = atStake.nextWinMilestone;
    lines.push(
      `Estás a ${plural(winsNeeded, "victoria", "victorias")} de las ${milestone} contra ${rivalShortName} ${ENDING[startMode]}.`,
    );
  }
  return lines;
}

const IDENTICAL_ONE: Record<Outcome, string> = {
  W: "Ganaste el último.",
  D: "Empataste el último.",
  L: "Perdiste el último.",
};

const IDENTICAL_MANY: Record<Outcome, string> = {
  W: "triunfos seguidos",
  D: "empates seguidos",
  L: "derrotas seguidas",
};

function identicalRun(streak: Streak): string {
  if (streak.length === 1) return IDENTICAL_ONE[streak.outcome];
  return `Venís de ${streak.length} ${IDENTICAL_MANY[streak.outcome]}.`;
}

/**
 * The longest of the identical run, the unbeaten run and the winless run. A tie prefers the
 * identical run, then the unbeaten one. Null when there are no matches.
 */
export function streakHeadline(
  current: Streak | null,
  unbeaten: Run | null,
  winless: Run | null,
): string | null {
  if (current === null) return null;
  const unbeatenLength = unbeaten?.length ?? 0;
  const winlessLength = winless?.length ?? 0;
  if (unbeatenLength > current.length && unbeatenLength >= winlessLength) {
    return `Venís de ${unbeatenLength} sin perder.`;
  }
  if (winlessLength > current.length) {
    return `Venís de ${winlessLength} partidos sin ganarle.`;
  }
  return identicalRun(current);
}

/** The best run of wins, with its months. */
export function bestStreakLine(best: Streak | null): string {
  if (best === null) return NO_WIN_EVER;
  if (best.length === 1) return "Tu mejor racha: 1 triunfo. Todavía no le ganaste dos seguidos.";
  const from = formatMonthYear(best.from);
  const to = formatMonthYear(best.to);
  const when = from === to ? `en ${from}` : `de ${from} a ${to}`;
  return `Tu mejor racha: ${best.length} triunfos seguidos, ${when}.`;
}

const FINAL_LINES: Record<"club" | "rival" | "none", string> = {
  club: "Ganaste la final",
  rival: "Perdiste la final",
  none: "Final sin ganador en nuestros datos",
};

export function finalLine(winner: SeriesWinner): string {
  return FINAL_LINES[winner ?? "none"];
}
