// Spanish copy of the coverage notice (plan 0015). It is built from the engine's CoverageNotice
// only, so it cannot contain the fan start date. There is deliberately no "complete" text: while
// the cups are not loaded (plan 0014, Phase 2) no screen may claim complete history.
import type { CoverageNotice } from "@/domain/types";

export const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2018-08-10" -> "agosto de 2018". Own table, no `Intl`: the output never depends on the runtime. */
export function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTHS[Number(month) - 1]} de ${year}`;
}

export const CUPS_NOT_LOADED =
  "Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas.";

export type CoverageCopy = Readonly<{
  show: boolean;
  heading: string;
  lead: string;
  lines: readonly string[];
}>;

const HIDDEN: CoverageCopy = { show: false, heading: "", lead: "", lines: [] };

export function coverageCopy(
  notice: CoverageNotice,
  names: ReadonlyMap<string, string>,
): CoverageCopy {
  if (notice.isComplete) return HIDDEN;
  const lines = notice.competitions.flatMap((c) => {
    const name = names.get(c.competitionId) ?? c.competitionId;
    if (c.status === "missing") {
      return [`${name}: todavía no tenemos sus partidos completos en este período.`];
    }
    if (c.status === "partial" && c.completeFrom !== null) {
      const from = formatMonthYear(c.completeFrom);
      return c.completeTo === null
        ? [`${name}: tenemos todos los partidos desde ${from}.`]
        : [`${name}: tenemos todos los partidos de ${from} a ${formatMonthYear(c.completeTo)}.`];
    }
    return [];
  });
  return {
    show: true,
    heading: "Tu historial puede estar incompleto",
    lead: "Estos números cuentan solo los partidos que tenemos cargados.",
    lines,
  };
}

/** "A", "A y B", "A, B y C". */
export function joinNames(ids: readonly string[], names: ReadonlyMap<string, string>): string {
  const list = ids.map((id) => names.get(id) ?? id);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}

/** "Contamos: A y B." The competitions the numbers on screen include. */
export function includedLine(ids: readonly string[], names: ReadonlyMap<string, string>): string {
  if (ids.length === 0) return "Todavía no hay partidos cargados para este período.";
  return `Contamos: ${joinNames(ids, names)}.`;
}
