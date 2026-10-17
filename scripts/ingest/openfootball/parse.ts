// Strict, pure parser for the subset of Football.TXT used by openfootball/south-america
// `argentina/*_ar1.txt` (plan 0011). Anything it does not understand stops the run with
// `file:line: message`: it never skips or guesses.
import { isRealIsoDate } from "../../../src/data-model/dates";

export type ParsedMatch = {
  /** 1-based line of the match in the source file (used for the permalink anchor). */
  line: number;
  date: string;
  /** Stage heading as written, without the leading marker. */
  heading: string;
  home: string;
  away: string;
  /** Regulation score. In a shoot-out line it is the full-time score. */
  homeGoals: number;
  awayGoals: number;
  penalties: { home: number; away: number } | null;
};

export type ParsedHeader = {
  first: string;
  last: string;
  teams: number;
  matches: number;
  stages: { group: string; count: number }[];
};

export type ParsedFile = {
  file: string;
  edition: string;
  header: ParsedHeader;
  matches: ParsedMatch[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DATE_PART = "([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\\d{1,2})(?: (\\d{4}))?";
const DATE_LINE = new RegExp(`^  ${DATE_PART}\\s*$`);
const HEADER_DATE = new RegExp(`^# Date\\s+${DATE_PART} - ${DATE_PART}(?: \\(\\d+d\\))?\\s*$`);
const MATCH_LINE =
  /^ {4}(?:\d{2}:\d{2} {2}| {7})(\S.*?)\s+v\s+(\S.*?)\s+(\d+-\d+(?: \(\d+-\d+\)| pen\. \(\d+-\d+, \d+-\d+\))?)\s*$/;
const HEADING_LINE = /^▪ (.+?)\s*$/;

class ParseError extends Error {}

function fail(file: string, line: number, message: string): never {
  throw new ParseError(`${file}:${line}: ${message}`);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds an ISO date and checks the written weekday against the computed one. */
function buildDate(
  file: string,
  line: number,
  [weekday, month, day, year]: [string, string, string, number],
): string {
  const m = MONTHS.indexOf(month);
  if (m < 0) fail(file, line, `unknown month "${month}"`);
  const iso = `${year}-${pad(m + 1)}-${pad(Number(day))}`;
  if (!isRealIsoDate(iso))
    fail(file, line, `"${weekday} ${month} ${day} ${year}" is not a real date`);
  const actual = WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  if (actual !== weekday) {
    fail(
      file,
      line,
      `weekday mismatch: written ${weekday}, but ${iso} is a ${actual} (wrong year inferred?)`,
    );
  }
  return iso;
}

function parseScore(file: string, line: number, text: string) {
  const shootout = /^(\d+)-(\d+) pen\. \((\d+)-(\d+), (\d+)-(\d+)\)$/.exec(text);
  if (shootout) {
    const [pHome, pAway, fHome, fAway] = shootout.slice(1, 5).map(Number);
    if (fHome !== fAway)
      fail(file, line, `shoot-out after a decisive full-time score (${fHome}-${fAway})`);
    if (pHome === pAway) fail(file, line, `drawn shoot-out (${pHome}-${pAway})`);
    return { homeGoals: fHome, awayGoals: fAway, penalties: { home: pHome, away: pAway } };
  }
  const plain = /^(\d+)-(\d+)(?: \(\d+-\d+\))?$/.exec(text);
  if (!plain) fail(file, line, `unsupported score "${text}"`);
  return { homeGoals: Number(plain[1]), awayGoals: Number(plain[2]), penalties: null };
}

/** `Group A` and friends map to the "Regular Season" total of the `# Stages` header. */
function stageGroup(heading: string): string | null {
  if (/^Matchday \d+$/.test(heading)) return null;
  if (/^Group [A-Z]$/.test(heading)) return "Regular Season";
  const prefix = /^(Fase Campeón|Fase Complementación|Copa Sud|1° Semestre)(?:,|$)/.exec(heading);
  if (!prefix) throw new ParseError(`no stage group for heading "${heading}"`);
  return prefix[1];
}

function parseHeader(file: string, lines: string[]): { edition: string; header: ParsedHeader } {
  const edition = /^= Argentina Primera Division (.+?)\s*$/.exec(lines[0] ?? "");
  if (!edition) fail(file, 1, `unexpected title line "${lines[0] ?? ""}"`);

  let dates: RegExpExecArray | null = null;
  let dateLine = 3;
  let teams: number | null = null;
  let matches: number | null = null;
  let stages: { group: string; count: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const text = lines[i];
    if (!text.startsWith("#")) continue;
    const date = HEADER_DATE.exec(text);
    const team = /^# Teams\s+(\d+)\s*$/.exec(text);
    const match = /^# Matches\s+(\d+)\s*$/.exec(text);
    const stage = /^# Stages\s+(.+?)\s*$/.exec(text);
    if (date) {
      dates = date;
      dateLine = i + 1;
    } else if (team) teams = Number(team[1]);
    else if (match) matches = Number(match[1]);
    else if (stage) {
      stages = stage[1].split(/ {2,}/).map((part) => {
        const m = /^(.+?) \((\d+)\)$/.exec(part);
        if (!m) fail(file, i + 1, `unexpected stage total "${part}"`);
        return { group: m[1], count: Number(m[2]) };
      });
    } else fail(file, i + 1, `unexpected header line "${text}"`);
  }
  if (!dates || teams === null || matches === null) {
    fail(file, 1, "the header needs # Date, # Teams and # Matches");
  }

  const [, w1, m1, d1, y1, w2, m2, d2, y2] = dates;
  const lastYear = Number(y2);
  const first = buildDate(file, dateLine, [w1, m1, d1, y1 ? Number(y1) : lastYear]);
  const last = buildDate(file, dateLine, [w2, m2, d2, lastYear]);
  return { edition: edition[1], header: { first, last, teams, matches, stages } };
}

export function parseOpenfootball(file: string, text: string): ParsedFile {
  const lines = text.split(/\r?\n/);
  const { edition, header } = parseHeader(file, lines);

  const matches: ParsedMatch[] = [];
  let heading: string | null = null;
  let date: string | null = null;
  let year: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const raw = lines[i];
    if (raw.trim() === "" || raw.startsWith("=") || raw.startsWith("#")) continue;

    const h = HEADING_LINE.exec(raw);
    if (h) {
      if (
        !/^(Matchday \d+|Group [A-Z]|(Fase Campeón|Fase Complementación), (Gruppe \d|Final)|Copa Sud, Final|1° Semestre, Matchday \d+)$/.test(
          h[1],
        )
      ) {
        fail(file, n, `unknown stage heading "${h[1]}"`);
      }
      heading = h[1];
      continue;
    }

    const d = DATE_LINE.exec(raw);
    if (d) {
      const [, weekday, month, day, explicit] = d;
      if (explicit) year = Number(explicit);
      if (year === null) fail(file, n, "date line without a year before any year was given");
      date = buildDate(file, n, [weekday, month, day, year]);
      continue;
    }

    const m = MATCH_LINE.exec(raw);
    if (m) {
      if (date === null || heading === null)
        fail(file, n, "match line before any stage heading or date line");
      matches.push({
        line: n,
        date,
        heading,
        home: m[1],
        away: m[2],
        ...parseScore(file, n, m[3]),
      });
      continue;
    }

    if (/^ {4}(?:\d{2}:\d{2}|\s)/.test(raw) && / v /.test(raw)) {
      fail(file, n, `unsupported score in match line "${raw.trim()}"`);
    }
    fail(file, n, `unexpected line "${raw.trim()}"`);
  }

  checkFile(file, header, matches);
  return { file, edition, header, matches };
}

function checkFile(file: string, header: ParsedHeader, matches: ParsedMatch[]): void {
  if (matches.length !== header.matches) {
    fail(file, 1, `matches: header says ${header.matches}, parsed ${matches.length}`);
  }
  const teams = new Set(matches.flatMap((m) => [m.home, m.away]));
  if (teams.size !== header.teams) {
    fail(file, 1, `teams: header says ${header.teams}, parsed ${teams.size}`);
  }
  const dates = matches.map((m) => m.date).sort();
  if (dates[0] !== header.first || dates[dates.length - 1] !== header.last) {
    fail(
      file,
      1,
      `date range: header says ${header.first} to ${header.last}, parsed ${dates[0]} to ${dates[dates.length - 1]}`,
    );
  }

  const seen = new Set<string>();
  for (const m of matches) {
    if (m.home === m.away) fail(file, m.line, `a team cannot play itself (${m.home})`);
    const key = `${m.date}|${[m.home, m.away].sort().join("|")}`;
    if (seen.has(key)) fail(file, m.line, `duplicate match ${m.home} v ${m.away} on ${m.date}`);
    seen.add(key);
  }

  const counts = new Map<string, number>();
  for (const m of matches) {
    const group = stageGroup(m.heading);
    if (group === null) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  if (header.stages.length === 0) {
    if (counts.size > 0) {
      fail(
        file,
        1,
        `stage headings found (${[...counts.keys()].join(", ")}) but no # Stages header`,
      );
    }
    return;
  }
  const declared = new Map(header.stages.map((s) => [s.group, s.count]));
  for (const [group, count] of declared) {
    if ((counts.get(group) ?? 0) !== count) {
      fail(
        file,
        1,
        `stage total for "${group}": header says ${count}, parsed ${counts.get(group) ?? 0}`,
      );
    }
  }
  for (const group of counts.keys()) {
    if (!declared.has(group)) fail(file, 1, `stage "${group}" is not in the # Stages header`);
  }
}
