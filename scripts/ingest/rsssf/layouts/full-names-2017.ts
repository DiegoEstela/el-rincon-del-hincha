// Layout "full-names-2017": the pages of 2017-18 onward (arg2019, arg2025). A table with full legal
// names and the headquarters, then rounds of `[Aug 10, Fri]` date headers and match lines whose
// columns are separated by two or more spaces. Strict: inside the matches, a line the grammar does
// not know stops the run with the excerpt and the line (plan 0017, ADR 0020 decision 3).
import { resolveDate } from "../dates";
import type {
  LayoutContext,
  ParsedMatch,
  ParsedTable,
  ParsedTableRow,
  ParsedTournament,
} from "../types";
import type { PreparedText } from "../text";

const TABLE_HEADER = /^\s*#\.\s*(Full [Nn]ame|Short name|Name)\s+MP\s+W\s+D\s+L\s+Gf-\s*Ga\s+P\b/;
const TABLE_ROW =
  /^\s*(\d+)\.(\S.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)-\s*(\d+)\s+(\d+)(?:\s+(\S.*?))?\s*$/;
const TABLE_LABEL = /^(Champion|Runner-up|Teams eliminated in the .+)$/;
const TABLE_TITLE = /^(Table( Group [A-Z])?|Relegation Table|Triennal General Table of Averages)$/;
const DATE_HEADER = /^\[([A-Z][a-z]{2}) (\d{1,2})(?:, ([A-Z][a-z]{2}))?\]$/;
const ROUND = /^Round (\d+)(?::|\s+-\s+\S.*)?$/;
const PHASE = /^Primera fase de zonas\b.*$/;
const MATCH =
  /^(\S.*?)\s{2,}(?:\[(\d+)\]\s+)?(?:(\d+)\s*-\s*(\d+)|-)\s+(?:\[(\d+)\]\s+)?(\S.*?)(?:\s{2,}(.*))?$/;

const KNOCKOUT: [RegExp, string][] = [
  [/^Round of 16\b.*$/, "Octavos de final"],
  [/^Quarter finals?\b.*$/, "Cuartos de final"],
  [/^Semi finals?\b.*$/, "Semifinal"],
  [/^Final:?$/, "Final"],
];

type Notes = {
  extraTime: boolean;
  pso: boolean;
  abandoned: string | null;
  resumed: string | null;
};

/** The notes at the start of the last column (`aet, pso, <stadium>`); the stadium is dropped. */
function parseTail(tail: string): Notes {
  const notes: Notes = { extraTime: false, pso: false, abandoned: null, resumed: null };
  let rest = tail;
  for (;;) {
    let m: RegExpExecArray | null;
    if ((m = /^aet,\s*/.exec(rest))) notes.extraTime = true;
    else if ((m = /^pso,\s*/.exec(rest))) notes.pso = true;
    else if ((m = /^abandoned at ([^,]+),\s*/.exec(rest))) notes.abandoned = m[1].trim();
    else if ((m = /^remaining ([^,]+),\s*/.exec(rest))) notes.resumed = m[1].trim();
    else return notes;
    rest = rest.slice(m[0].length);
  }
}

function toRow(m: RegExpExecArray, line: number): ParsedTableRow {
  return {
    line,
    position: Number(m[1]),
    name: m[2].trim(),
    played: Number(m[3]),
    won: Number(m[4]),
    drawn: Number(m[5]),
    lost: Number(m[6]),
    goalsFor: Number(m[7]),
    goalsAgainst: Number(m[8]),
    points: Number(m[9]),
    suffix: m[10] === undefined ? null : m[10],
  };
}

export function parseFullNames2017(text: PreparedText, ctx: LayoutContext): ParsedTournament {
  const { file } = text;
  const tables: ParsedTable[] = [];
  const matches: ParsedMatch[] = [];
  const ignore = new Set(ctx.ignore);
  // "free" text (the preamble, the notes after the matches) is not checked line by line; the lines
  // between the first round and the end of the matches are.
  let mode: "free" | "matches" | "table" = "free";
  let table: ParsedTable | null = null;
  let stage: string | null = null;
  let date: string | null = null;

  const fail = (line: number, message: string): never => {
    throw new Error(`${file}:${line}: ${message}`);
  };

  for (const { line, text: raw } of text.lines) {
    const t = raw.trim();
    const where = `${file}:${line}`;

    if (mode === "table") {
      const row = TABLE_ROW.exec(raw);
      if (row !== null) {
        table!.rows.push(toRow(row, line));
        continue;
      }
      if (TABLE_LABEL.test(t)) continue;
      mode = "free";
      table = null;
      if (t === "") continue;
    }

    if (TABLE_HEADER.test(raw)) {
      const kind = /Full [Nn]ame/.test(raw) ? "full" : "short";
      table = { line, kind, rows: [] };
      tables.push(table);
      mode = "table";
      continue;
    }
    if (TABLE_TITLE.test(t)) {
      mode = "free";
      stage = null;
      date = null;
      continue;
    }
    if (t === "") continue;
    if (ignore.has(t)) continue;

    const round = ROUND.exec(t);
    const knockout = KNOCKOUT.find(([re]) => re.test(t));
    if (round !== null || knockout !== undefined) {
      stage = round !== null ? `Fecha ${Number(round[1])}` : knockout![1];
      date = null;
      mode = "matches";
      continue;
    }
    if (PHASE.test(t)) {
      mode = "matches";
      continue;
    }

    const dateHeader = DATE_HEADER.exec(t);
    if (dateHeader !== null) {
      if (stage === null) fail(line, `date header "${t}" before any round heading`);
      date = resolveDate(dateHeader[1], Number(dateHeader[2]), dateHeader[3], ctx.window, where);
      mode = "matches";
      continue;
    }

    const match = MATCH.exec(raw.replace(/^\s+/, ""));
    if (match !== null && date !== null && stage !== null) {
      const notes = parseTail(match[7] ?? "");
      const hasScore = match[3] !== undefined;
      const penalties =
        match[2] !== undefined && match[5] !== undefined
          ? { home: Number(match[2]), away: Number(match[5]) }
          : null;
      if (penalties !== null && !notes.pso) fail(line, 'a shoot-out score without "pso"');
      if (penalties === null && notes.pso) fail(line, '"pso" without a shoot-out score');
      if (!hasScore && notes.abandoned === null)
        fail(line, "a match with no score is not abandoned");
      matches.push({
        line,
        date,
        stage,
        home: match[1].trim(),
        away: match[6].trim(),
        homeGoals: hasScore ? Number(match[3]) : null,
        awayGoals: hasScore ? Number(match[4]) : null,
        extraTime: notes.extraTime,
        penalties,
        abandoned: notes.abandoned,
        resumed: notes.resumed,
      });
      mode = "matches";
      continue;
    }

    if (mode === "matches") fail(line, `unrecognized line "${t}"`);
  }
  return { excerpt: file, tables, matches };
}
