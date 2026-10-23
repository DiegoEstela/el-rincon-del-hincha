// Layout "continental-ties": the pages of the Copa Libertadores and the Copa Sudamericana
// (`sacups/copa2019.html`, `sacups/sudamcup2019.html`). One block of text: headings (`Group Phase`,
// `Quarterfinals`), a date header with the two dates of the legs (`(Jul 23 & 30)`), a line per tie
// with both legs and the aggregate, and a line per match in the group phase (`Mar  6: A - B  0-1`).
//
// A tie is `Name1 Cc1 Name2 Cc2 leg1 leg2 aggregate [penalties] [aet]`. The second leg is written
// from the point of view of the tie (the first club first), although it is played at the home of
// the second club, so it is turned around here. Strict: a heading or a line the grammar does not
// know stops the run, except a tie line it cannot read, which is kept as `unreadable` so that it
// only stops the run when one of the clubs is an app club (plan 0017, Phase B3).
import { resolveDate } from "../dates";
import type { PreparedText } from "../text";
import type { LayoutContext, ParsedMatch, ParsedTournament } from "../types";

const CODES = "Arg|Bra|Bol|Chi|Col|Ecu|Par|Per|Uru|Ven|Mex";
const TIE = new RegExp(
  `^(\\S.*?)\\s*(?<![A-Za-z])(${CODES})\\s{1,4}(\\S.*?)\\s*(?<![A-Za-z])(${CODES})\\s+(\\S.*)$`,
);
const GROUP_MATCH =
  /^([A-Z][a-z]{2})\s+(\d{1,2})[:;]\s+(\S.*?)\s+(\d+)\s*[-–]\s*(\d+)[xyzw]?\s*(?:\(.*\))?$/;
const DATE_HEADER =
  /^\(\s*([A-Z][a-z]{2})\s+(\d{1,2})\s*(?:(?:&|and)\s*(?:([A-Z][a-z]{2})\s+)?(\d{1,2}))?\s*(?:,\s*([^)<]*?))?\s*<?\)?\s*$/;
const NAV = /^(?:Overview Page\|?|overview|\d{4}\|?)$/;
const NOTE = /^(?:[xyzw]\s+\S|NB:)/;
const TABLE = /^(?:#\.|\d+\.)/;

type Stage = { re: RegExp; name: (groupSeen: boolean) => string };
const STAGES: Stage[] = [
  { re: /^Qualifying Round (\d)\b/, name: () => "" },
  { re: /^First Round\b/, name: () => "Primera fase" },
  { re: /^Second Round\b/, name: (groupSeen) => (groupSeen ? "Octavos de final" : "Segunda fase") },
  { re: /^Playoff Round\b/, name: () => "Play-off" },
  { re: /^1\/8 Finals\b/, name: () => "Octavos de final" },
  { re: /^Round of 16\b/, name: () => "Octavos de final" },
  { re: /^Quarter-?finals\b/, name: () => "Cuartos de final" },
  { re: /^Semi-?finals\b/, name: () => "Semifinal" },
  { re: /^Final\b/, name: () => "Final" },
];

/** `[month, day]` pairs of a date header, with the month of the second date inherited. */
type Dates = { first: string; second: string | null };

function legScore(token: string): { a: number; b: number } | null {
  const m = /^(\d+)\s*[-–]\s*(\d+)[xyzw]?$/.exec(token);
  return m === null ? null : { a: Number(m[1]), b: Number(m[2]) };
}

export function parseContinentalTies(text: PreparedText, ctx: LayoutContext): ParsedTournament {
  const { file } = text;
  const matches: ParsedMatch[] = [];
  const ignore = new Set(ctx.ignore);
  let stage: string | null = null;
  let groupSeen = false;
  let dates: Dates | null = null;
  let scorers = false;
  let note = false;

  const fail = (line: number, message: string): never => {
    throw new Error(`${file}:${line}: ${message}`);
  };
  const day = (line: number, month: string, d: string): string =>
    resolveDate(month, Number(d), undefined, ctx.window, `${file}:${line}`);

  for (const { line, text: raw } of text.lines) {
    const t = raw.trim();

    if (t === "") {
      scorers = false;
      note = false;
      continue;
    }
    if (scorers) {
      if (t.endsWith("]")) scorers = false;
      continue;
    }
    if (t.startsWith("[")) {
      scorers = !t.endsWith("]");
      continue;
    }
    if (ignore.has(t) || NAV.test(t) || /^<?\/?pre>?$/i.test(t)) continue;
    if (note && /^\s/.test(raw)) continue;
    note = false;
    if (NOTE.test(t)) {
      note = true;
      continue;
    }
    if (TABLE.test(t)) continue;

    const header = DATE_HEADER.exec(t);
    if (header !== null) {
      const [, m1, d1, m2, d2, extra] = header;
      if (extra !== undefined && /^\d{4}$/.test(extra)) {
        // `(Jan 6 and 13, 2021)`: the year is checked against the date the window gives.
        const check = day(line, m1, d1);
        if (!check.startsWith(extra)) fail(line, `"${t}" does not agree with the window`);
      }
      dates = {
        first: day(line, m1, d1),
        second: d2 === undefined ? null : day(line, m2 ?? m1, d2),
      };
      continue;
    }

    const stageHit = STAGES.map((s) => ({ s, m: s.re.exec(t) })).find((x) => x.m !== null);
    if (stageHit !== undefined && !/\d+\s*[-–]\s*\d+/.test(t)) {
      const { s, m } = stageHit;
      stage = s.re.source.startsWith("^Qualifying") ? `Fase previa ${m![1]}` : s.name(groupSeen);
      dates = null;
      // `Qualifying Round 1 (Jan 22 & 26)` and `Final (Nov 11 & Dec 9)` carry their dates.
      const inline = /\(([^)]*)\)?\s*$/.exec(t);
      if (inline !== null) {
        const h = DATE_HEADER.exec(`(${inline[1]})`);
        if (h !== null) {
          dates = {
            first: day(line, h[1], h[2]),
            second: h[4] === undefined ? null : day(line, h[3] ?? h[1], h[4]),
          };
        }
      }
      continue;
    }
    if (/^Group Phase$/.test(t)) {
      groupSeen = true;
      stage = null;
      continue;
    }
    // `Group A´` is a typo of the page: a stray mark after the letter is not a different heading.
    const group = /^Group ([A-H])[´'`]?$/.exec(t);
    if (group !== null) {
      stage = `Grupo ${group[1]}`;
      dates = null;
      continue;
    }

    const gm = GROUP_MATCH.exec(t);
    if (gm !== null && stage !== null && stage.startsWith("Grupo")) {
      const names = splitTeams(gm[3]);
      if (names === null) fail(line, `cannot split the teams of "${t}"`);
      matches.push({
        line,
        date: day(line, gm[1], gm[2]),
        stage,
        home: names![0],
        away: names![1],
        homeGoals: Number(gm[4]),
        awayGoals: Number(gm[5]),
        extraTime: false,
        penalties: null,
        abandoned: null,
        resumed: null,
      });
      continue;
    }

    const tie = TIE.exec(raw.trim());
    if (tie !== null && stage !== null) {
      matches.push(...readTie(line, stage, dates, tie, ctx));
      continue;
    }

    fail(line, `unrecognized line "${t}"`);
  }
  return { excerpt: file, tables: [], matches };
}

/** `A - B`, `A- B` or `A-B`: the single hyphen that separates the teams. */
function splitTeams(text: string): [string, string] | null {
  const spaced = text.split(/\s+[-–]\s+/);
  if (spaced.length === 2) return [spaced[0].trim(), spaced[1].trim()];
  const loose = text.split(/\s*[-–]\s*/);
  return loose.length === 2 ? [loose[0].trim(), loose[1].trim()] : null;
}

function readTie(
  line: number,
  stage: string,
  dates: Dates | null,
  tie: RegExpExecArray,
  ctx: LayoutContext,
): ParsedMatch[] {
  const [, name1, code1, name2, code2, tail] = tie;
  const base = {
    line,
    stage,
    extraTime: false,
    penalties: null,
    abandoned: null,
    resumed: null,
    homeCode: code1,
    awayCode: code2,
  };
  const unreadable = (why: string): ParsedMatch[] => [
    {
      ...base,
      date: dates?.first ?? ctx.window.from,
      home: name1.trim(),
      away: name2.trim(),
      homeGoals: null,
      awayGoals: null,
      unreadable: why,
    },
  ];
  if (dates === null) return unreadable("a tie before any date header");

  const tokens = tail.trim().split(/\s+/);
  const aet = tokens.includes("aet");
  const words = tokens.filter((x) => x !== "aet");
  const pens = words.length > 0 ? /^(\d+)-(\d+)p$/.exec(words[words.length - 1]) : null;
  const scored = pens === null ? words : words.slice(0, -1);
  const penalties = pens === null ? null : { a: Number(pens[1]), b: Number(pens[2]) };

  // One match (a final in one match, a play-off, the single tie of the first stage).
  if (dates.second === null) {
    const score = scored.length === 1 ? legScore(scored[0]) : null;
    if (score === null) return unreadable(`cannot read "${tail.trim()}" as one match`);
    return [
      {
        ...base,
        date: dates.first,
        home: name1.trim(),
        away: name2.trim(),
        homeGoals: score.a,
        awayGoals: score.b,
        extraTime: aet,
        penalties: penalties === null ? null : { home: penalties.a, away: penalties.b },
      },
    ];
  }

  // Two legs and the aggregate, which carries the marker of the note (`3-0x`) or of the away goals.
  if (scored.length !== 3) return unreadable(`cannot read "${tail.trim()}" as two legs`);
  const agg = legScore(scored[2].replace(/^\*|\*$/g, ""));
  if (agg === null) return unreadable(`cannot read the aggregate "${scored[2]}"`);
  const first = scored[0] === "awd" || scored[0] === "abd" ? scored[0] : legScore(scored[0]);
  const second = scored[1] === "awd" || scored[1] === "abd" ? scored[1] : legScore(scored[1]);
  if (first === null || second === null) return unreadable(`cannot read the legs "${tail.trim()}"`);

  const known = (leg: typeof first) => (typeof leg === "string" ? null : leg);
  const a = known(first);
  const b = known(second);
  // An awarded leg has the score that completes the aggregate; an abandoned one has none.
  const awarded = first === "awd" ? "first" : second === "awd" ? "second" : null;
  const other = awarded === "first" ? b : a;
  const missing =
    awarded === null ? null : { a: agg.a - (other?.a ?? 0), b: agg.b - (other?.b ?? 0) };
  if (
    awarded === null &&
    a !== null &&
    b !== null &&
    (a.a + b.a !== agg.a || a.b + b.b !== agg.b)
  ) {
    return unreadable(`the legs ${scored[0]} and ${scored[1]} do not add up to ${scored[2]}`);
  }
  if (missing !== null && (missing.a < 0 || missing.b < 0)) {
    return unreadable("the awarded leg would have a negative score");
  }

  const score1 = awarded === "first" ? missing : a;
  const score2 = awarded === "second" ? missing : b;
  const leg1: ParsedMatch = {
    ...base,
    date: dates.first,
    home: name1.trim(),
    away: name2.trim(),
    homeGoals: score1?.a ?? null,
    awayGoals: score1?.b ?? null,
    ...(first === "awd" ? { awarded: true } : {}),
    abandoned: first === "abd" ? "abandoned" : null,
  };
  // The second leg is played at the home of the second club: home and away are turned around.
  const leg2: ParsedMatch = {
    ...base,
    date: dates.second,
    home: name2.trim(),
    away: name1.trim(),
    homeCode: code2,
    awayCode: code1,
    homeGoals: score2?.b ?? null,
    awayGoals: score2?.a ?? null,
    extraTime: aet,
    penalties: penalties === null ? null : { home: penalties.b, away: penalties.a },
    ...(second === "awd" ? { awarded: true } : {}),
    abandoned: second === "abd" ? "abandoned" : null,
  };
  return [leg1, leg2];
}
