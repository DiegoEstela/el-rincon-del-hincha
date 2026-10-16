// Pure core of the local alias check (plan 0007, T9). Reads only the tournament and the two team
// name columns of the Kaggle CSV; scores and team ids are never read, stored or printed.
import { resolveClubId, type ClubAliases } from "../../src/data-model/club-aliases";

export type CheckOptions = {
  /** Also fail when a name of a recent tournament (2022 or later) does not resolve. */
  strict?: boolean;
  /** Kaggle name to the club id it must resolve to; each name must appear in the file. */
  expected?: Readonly<Record<string, string>>;
};

export type CheckReport = {
  distinctNames: string[];
  resolved: Record<string, string>;
  unresolvedRecent: string[];
  unresolvedOld: string[];
  lookalikeHits: string[];
  expectedProblems: string[];
  /** Rows with too few cells to hold the three columns we read; skipped, never parsed. */
  skippedRows: number;
  exitCode: 0 | 1;
};

const RECENT_FROM_YEAR = 2022;

// Minimal CSV line splitter. Quoted-field handling: a double quote toggles "inside quotes" and is
// dropped, so commas inside quotes stay in the cell. Escaped quotes ("") and quoted line breaks
// are NOT supported; that is enough for the team-name columns of the Kaggle file, which has neither.
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells;
}

function isRecent(tournament: string): boolean {
  const years = [...tournament.matchAll(/\b(?:19|20)\d\d\b/g)].map((m) => Number(m[0]));
  return Math.max(0, ...years) >= RECENT_FROM_YEAR;
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function analyzeClubNames(
  csvText: string,
  clubs: readonly ClubAliases[],
  lookalikes: readonly string[],
  options: CheckOptions = {},
): CheckReport {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitLine(lines[0] ?? "");
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`Missing column: ${name}`);
    return index;
  };
  const [tournamentCol, localCol, visitorCol] = [
    column("date_name"),
    column("local_team"),
    column("visitor_team"),
  ];

  const names = new Set<string>();
  const recentNames = new Set<string>();
  const needed = Math.max(tournamentCol, localCol, visitorCol) + 1;
  let skippedRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    if (cells.length < needed) {
      skippedRows += 1;
      continue;
    }
    const recent = isRecent(cells[tournamentCol]);
    for (const name of [cells[localCol], cells[visitorCol]]) {
      names.add(name);
      if (recent) recentNames.add(name);
    }
  }

  const resolved: Record<string, string> = {};
  const unresolved: string[] = [];
  for (const name of sorted(names)) {
    const id = resolveClubId(clubs, name);
    if (id === null) unresolved.push(name);
    else resolved[name] = id;
  }

  const lookalikeHits = lookalikes.filter((n) => resolveClubId(clubs, n) !== null);
  const expectedProblems = Object.entries(options.expected ?? {}).flatMap(([name, id]) => {
    if (!names.has(name)) return [`${name}: not found in the file`];
    const got = resolved[name] ?? "nothing";
    return got === id ? [] : [`${name}: expected ${id}, got ${got}`];
  });

  const unresolvedRecent = unresolved.filter((n) => recentNames.has(n));
  const failed =
    lookalikeHits.length > 0 ||
    expectedProblems.length > 0 ||
    (options.strict === true && unresolvedRecent.length > 0);

  return {
    distinctNames: sorted(names),
    resolved,
    unresolvedRecent,
    unresolvedOld: unresolved.filter((n) => !recentNames.has(n)),
    lookalikeHits,
    expectedProblems,
    skippedRows,
    exitCode: failed ? 1 : 0,
  };
}

/** Names and counts only. */
export function formatReport(report: CheckReport): string {
  const lines = [
    `Distinct names: ${report.distinctNames.length}`,
    `Resolved: ${Object.keys(report.resolved).length}`,
    `Unresolved in recent tournaments (2022 or later): ${report.unresolvedRecent.length}`,
    ...report.unresolvedRecent.map((n) => `  - ${n}`),
    `Unresolved in older tournaments: ${report.unresolvedOld.length}`,
    `Lookalike names that resolve (must be 0): ${report.lookalikeHits.length}`,
    ...report.lookalikeHits.map((n) => `  - ${n}`),
    `Expected-name problems (must be 0): ${report.expectedProblems.length}`,
    ...report.expectedProblems.map((p) => `  - ${p}`),
    `Skipped malformed rows: ${report.skippedRows}`,
  ];
  return lines.join("\n");
}
