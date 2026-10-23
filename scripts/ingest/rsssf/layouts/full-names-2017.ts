// Layout "full-names-2017": the pages of 2017-18 onward (arg2019, arg2025). A table with full legal
// names and the headquarters, then rounds of `[Aug 10, Fri]` date headers and match lines whose
// columns are separated by two or more spaces. Strict: inside the matches, a line the grammar does
// not know stops the run with the excerpt and the line (plan 0017, ADR 0020 decision 3).
import { resolveDate, type DateWindow } from "../dates";
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
const DATE_HEADER = /^\[(?:(\d{4}) )?([A-Z][a-z]{2}) (\d{1,2})(?:, ([A-Z][a-z]{2}))?\]$/;
const DATE_HEADER_DAY_FIRST = /^\[([A-Z][a-z]{2}), (\d{1,2}) ([A-Z][a-z]{2}) (\d{4})\]$/;
const SINGLE_SPACE_PSO = /^(\S.*?) pso,\s*(.*)$/i;
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

/** What differs between the first division pages and the cup sections of the same pages. */
export type FullNamesOptions = {
  /** Headings of the knockout rounds and the Spanish stage each one is called. */
  knockout: readonly [RegExp, string][];
  /** The stage of a match that has a date header but no round heading (a cup of one match). */
  defaultStage: string | null;
};

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
    if ((m = /^aet,\s*/i.exec(rest))) notes.extraTime = true;
    else if ((m = /^pso,\s*/i.exec(rest))) notes.pso = true;
    else if ((m = /^abandoned at ([^,]+),\s*/.exec(rest))) notes.abandoned = m[1].trim();
    else if ((m = /^remaining ([^,]+),\s*/.exec(rest))) notes.resumed = m[1].trim();
    else return notes;
    rest = rest.slice(m[0].length);
  }
}

function toRow(m: RegExpExecArray, line: number, mark: string | null): ParsedTableRow {
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
    mark,
  };
}

export function parseFullNames2017(text: PreparedText, ctx: LayoutContext): ParsedTournament {
  return parseFullNames(text, ctx, { knockout: KNOCKOUT, defaultStage: null });
}

/** The grammar of `full-names-2017`, parameterized by what the cup sections change. */
export function parseFullNames(
  text: PreparedText,
  ctx: LayoutContext,
  options: FullNamesOptions,
): ParsedTournament {
  const { file } = text;
  const tables: ParsedTable[] = [];
  const matches: ParsedMatch[] = [];
  const ignore = new Set(ctx.ignore);
  // "free" text (the preamble, the notes after the matches) is not checked line by line; the lines
  // between the first round and the end of the matches are.
  let mode: "free" | "matches" | "table" = "free";
  let table: ParsedTable | null = null;
  let mark: string | null = null;
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
        table!.rows.push(toRow(row, line, mark));
        continue;
      }
      if (TABLE_LABEL.test(t)) {
        mark = t;
        continue;
      }
      mode = "free";
      table = null;
      if (t === "") continue;
    }

    if (TABLE_HEADER.test(raw)) {
      const kind = /Full [Nn]ame/.test(raw) ? "full" : "short";
      table = { line, kind, rows: [] };
      mark = null;
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
    const knockout = options.knockout.find(([re]) => re.test(t));
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
    const dayFirst = DATE_HEADER_DAY_FIRST.exec(t);
    if (dateHeader !== null || dayFirst !== null) {
      if (stage === null && options.defaultStage !== null) stage = options.defaultStage;
      if (stage === null) fail(line, `date header "${t}" before any round heading`);
      // `[2025 Sep 6, Sat]` and `[Wed, 5 Mar 2025]` write their year; `[Feb 8, Wed]` does not.
      const [year, month, day, weekday] =
        dateHeader !== null
          ? [dateHeader[1], dateHeader[2], dateHeader[3], dateHeader[4]]
          : [dayFirst![4], dayFirst![3], dayFirst![2], dayFirst![1]];
      date =
        year === undefined
          ? resolveDate(month, Number(day), weekday, ctx.window, where)
          : resolveDatedYear(Number(year), month, Number(day), weekday, ctx.window, where);
      mode = "matches";
      continue;
    }

    const match = MATCH.exec(raw.replace(/^\s+/, ""));
    if (match !== null && date !== null && stage !== null) {
      const penalties =
        match[2] !== undefined && match[5] !== undefined
          ? { home: Number(match[2]), away: Number(match[5]) }
          : null;
      // A shoot-out note written one space after the away club ("Club X pso, <stadium>") is not
      // split by the two-space columns; with a shoot-out score on the line it is cut here.
      const glued =
        penalties !== null && match[7] === undefined ? SINGLE_SPACE_PSO.exec(match[6]) : null;
      const awayName = glued === null ? match[6] : glued[1];
      const notes = parseTail(glued === null ? (match[7] ?? "") : `pso, ${glued[2]}`);
      const hasScore = match[3] !== undefined;
      if (penalties !== null && !notes.pso) fail(line, 'a shoot-out score without "pso"');
      if (penalties === null && notes.pso) fail(line, '"pso" without a shoot-out score');
      if (!hasScore && notes.abandoned === null)
        fail(line, "a match with no score is not abandoned");
      matches.push({
        line,
        date,
        stage,
        home: match[1].trim(),
        away: awayName.trim(),
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

/** A header that writes its year (`[2025 Sep 6, Sat]`): the date must still be inside the window. */
function resolveDatedYear(
  year: number,
  month: string,
  day: number,
  weekday: string | undefined,
  window: DateWindow,
  where: string,
): string {
  const iso = resolveDate(
    month,
    day,
    weekday,
    { from: `${year}-01-01`, to: `${year}-12-31` },
    where,
  );
  if (iso < window.from || iso > window.to) {
    throw new Error(`${where}: ${iso} is outside the window ${window.from} to ${window.to}`);
  }
  return iso;
}
