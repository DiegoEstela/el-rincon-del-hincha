// Layout "champions-list": the list of first division champions of RSSSF (`argchamp`), from the
// 2017/18 row on. One row per tournament: season, tournament, champion and second place, separated
// by two or more spaces. A line that starts like a row and is not one stops the run; notes between
// the rows are free text (plan 0017, D5). Only the champion is read as a title.
import type { PreparedText } from "../text";

export type ParsedChampion = {
  line: number;
  /** "2018/19" or "2025". */
  season: string;
  /** "Campeonato", "Torneo Apertura", "Torneo Clausura", "Anual LPF". */
  tournament: string;
  champion: string;
  runnerUp: string;
};

export type ParsedChampions = { excerpt: string; rows: ParsedChampion[] };

const ROW =
  /^(\d{4}(?:\/\d{2})?)\s{2,}(Campeonato|Torneo Apertura|Torneo Clausura|Anual LPF)\s{2,}(\S.*?)\s{2,}(\S.*?)\s*$/;
// Anything that begins with a season token is meant to be a row.
const LOOKS_LIKE_ROW = /^\d{4}(?:\/\d{2})?\s{2,}\S/;

export function parseChampionsList(text: PreparedText): ParsedChampions {
  const rows: ParsedChampion[] = [];
  for (const { line, text: raw } of text.lines) {
    const t = raw.trim();
    if (!LOOKS_LIKE_ROW.test(t)) continue;
    const match = ROW.exec(t);
    if (match === null) {
      throw new Error(`${text.file}:${line}: unrecognized champion row "${t}"`);
    }
    rows.push({
      line,
      season: match[1],
      tournament: match[2],
      champion: match[3],
      runnerUp: match[4],
    });
  }
  return { excerpt: text.file, rows };
}
