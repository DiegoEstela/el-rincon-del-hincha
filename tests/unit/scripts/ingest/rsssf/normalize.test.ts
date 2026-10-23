import { describe, expect, it } from "vitest";
import { IngestError } from "../../../../../scripts/ingest/core/errors";
import type { TournamentConfig } from "../../../../../scripts/ingest/rsssf/config";
import type { ManifestPage } from "../../../../../scripts/ingest/rsssf/manifest";
import { normalizeRsssf, type RawTournament } from "../../../../../scripts/ingest/rsssf/normalize";
import type {
  ParsedMatch,
  ParsedTable,
  ParsedTableRow,
  ParsedTournament,
} from "../../../../../scripts/ingest/rsssf/types";

const clubs = [
  { id: "a", aliases: ["CA A", "Club A (X, B)"] },
  { id: "b", aliases: ["CA B", "Club B (Y, C)"] },
  { id: "c", aliases: ["CA C", "Club C (Z, D)"] },
] as never;

const OWN: TournamentConfig = {
  id: "liga-2025-clausura",
  competition_id: "liga",
  name: "Clausura 2025",
  page: "arg2025",
  excerpt: "1clausura",
  window: { from: "2025-07-01", to: "2025-12-31" },
  mode: { kind: "own" },
  tableCoversSeason: true,
};
const EXTENDS: TournamentConfig = {
  ...OWN,
  id: "liga-2025-apertura",
  excerpt: "1apertura",
  mode: { kind: "extends", after: "2025-05-04" },
  tableCoversSeason: false,
};

const page = (extra: Partial<ManifestPage> = {}): ManifestPage =>
  ({
    url: "https://www.rsssf.org/tablesa/arg2025.html",
    authors: ["X"],
    ignore: [],
    variants: [],
    tableExceptions: [],
    excerpts: [],
    ...extra,
  }) as unknown as ManifestPage;

let line = 0;
const m = (
  date: string,
  home: string,
  away: string,
  hg: number | null,
  ag: number | null,
  extra: Partial<ParsedMatch> = {},
): ParsedMatch => ({
  line: ++line,
  date,
  stage: "Fecha 1",
  home,
  away,
  homeGoals: hg,
  awayGoals: ag,
  extraTime: false,
  penalties: null,
  abandoned: null,
  resumed: null,
  ...extra,
});
const row = (name: string, hq: string, tally: number[], extra: Partial<ParsedTableRow> = {}) => ({
  line: ++line,
  position: 1,
  name,
  played: tally[0],
  won: tally[1],
  drawn: tally[2],
  lost: tally[3],
  goalsFor: tally[4],
  goalsAgainst: tally[5],
  points: tally[6],
  suffix: hq,
  mark: null,
  ...extra,
});
const table = (rows: ParsedTableRow[]): ParsedTable => ({ line: 1, kind: "full", rows });

/** A beats B 2-1, then B and C draw 0-0. */
const base = (matches: ParsedMatch[], tables: ParsedTable[]): ParsedTournament => ({
  excerpt: "arg2025.1clausura",
  matches,
  tables,
});
const goodTable = table([
  row("Club A", "(X, B)", [1, 1, 0, 0, 2, 1, 3]),
  row("Club B", "(Y, C)", [2, 0, 1, 1, 1, 2, 1]),
  row("Club C", "(Z, D)", [1, 0, 1, 0, 0, 0, 1]),
]);
const goodMatches = () => [
  m("2025-07-11", "CA A", "CA B", 2, 1),
  m("2025-07-18", "CA B", "CA C", 0, 0),
];
const run = (parsed: ParsedTournament, t = OWN, p = page()) =>
  normalizeRsssf([{ tournament: t, page: p, parsed }], clubs, []);
const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (e) {
    return (e as IngestError).problems;
  }
  return [];
};

describe("normalizeRsssf (plan 0017, T18)", () => {
  it("writes matches, the season and the standings of an own tournament", () => {
    const out = run(base(goodMatches(), [goodTable]));
    expect(out.matches).toHaveLength(2);
    expect(out.matches[0]).toEqual({
      id: "2025-07-11-a-b",
      season_id: "liga-2025-clausura",
      date: "2025-07-11",
      home_id: "a",
      away_id: "b",
      home_goals: 2,
      away_goals: 1,
      decision: null,
      home_penalties: null,
      away_penalties: null,
      stage: "Fecha 1",
      is_final: false,
      status: "played",
      source: "https://www.rsssf.org/tablesa/arg2025.html#1clausura",
      verified: false,
    });
    expect(out.seasons).toEqual([
      {
        id: "liga-2025-clausura",
        competition_id: "liga",
        name: "Clausura 2025",
        start: "2025-07-11",
        end: "2025-07-18",
        source: "https://www.rsssf.org/tablesa/arg2025.html#1clausura",
      },
    ]);
    expect(out.standings).toHaveLength(3);
    expect(out.standings![0]).toMatchObject({ club_id: "a", played: 1, won: 1 });
  });

  it("marks the final, extra time and the shoot-out", () => {
    const final = m("2025-12-14", "CA A", "CA B", 1, 1, {
      stage: "Final",
      extraTime: true,
      penalties: { home: 4, away: 5 },
    });
    const aet = m("2025-12-07", "CA B", "CA C", 0, 1, { stage: "Semifinal", extraTime: true });
    const out = run(base([final, aet], []), { ...OWN, tableCoversSeason: false });
    expect(out.matches[0]).toMatchObject({
      is_final: true,
      decision: "penalties",
      home_penalties: 4,
      away_penalties: 5,
    });
    expect(out.matches[1]).toMatchObject({ is_final: false, decision: "extra_time" });
  });

  it("merges an abandoned match with the line that completes it (D6)", () => {
    const abandoned = m("2025-07-20", "CA A", "CA B", null, null, { abandoned: "0-0 in 45m HT" });
    const resumed = m("2025-08-03", "CA A", "CA B", 1, 0, { resumed: "45m" });
    const out = run(base([abandoned, resumed], []), { ...OWN, tableCoversSeason: false });
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0]).toMatchObject({
      id: "2025-08-03-a-b",
      date: "2025-08-03",
      status: "played",
      home_goals: 1,
      away_goals: 0,
    });
  });

  it("reads an abandoned match given as one line with the final score and the day it ended", () => {
    const one = m("2025-08-30", "CA A", "CA B", 0, 1, {
      abandoned: "0-0 in 45m HT",
      resumed: "time on 24 Oct",
    });
    const out = run(base([one], []), { ...OWN, tableCoversSeason: false });
    expect(out.matches[0]).toMatchObject({
      id: "2025-10-24-a-b",
      date: "2025-10-24",
      status: "played",
      home_goals: 0,
      away_goals: 1,
    });
  });

  it("reports an abandoned line whose completion day cannot be read", () => {
    const odd = m("2025-08-30", "CA A", "CA B", 0, 1, { abandoned: "x", resumed: "soon" });
    expect(problemsOf(() => run(base([odd], []), { ...OWN, tableCoversSeason: false }))[0]).toMatch(
      /cannot read when/,
    );
  });

  it("keeps a match that was never completed as suspended, with no score", () => {
    const abandoned = m("2025-07-20", "CA A", "CA B", null, null, { abandoned: "0-0 in 45m HT" });
    const out = run(base([abandoned], []), { ...OWN, tableCoversSeason: false });
    expect(out.matches[0]).toMatchObject({
      status: "suspended",
      home_goals: null,
      away_goals: null,
    });
  });

  it("reports a resumed match nobody abandoned, and an abandoned match with a score", () => {
    const resumed = m("2025-08-03", "CA A", "CA B", 1, 0, { resumed: "45m" });
    const scored = m("2025-08-04", "CA B", "CA C", 1, 0, { abandoned: "x" });
    const t = { ...OWN, tableCoversSeason: false };
    expect(problemsOf(() => run(base([resumed], []), t))[0]).toMatch(/not abandoned before/);
    expect(problemsOf(() => run(base([scored], []), t))[0]).toMatch(/with a score/);
  });

  it("reports a match that appears twice", () => {
    const twice = [m("2025-07-11", "CA A", "CA B", 1, 0), m("2025-07-11", "CA A", "CA B", 1, 0)];
    expect(problemsOf(() => run(base(twice, []), { ...OWN, tableCoversSeason: false }))[0]).toMatch(
      /appears twice/,
    );
  });

  it("an extends tournament adds only the matches after the other source and no season", () => {
    const old = m("2025-05-04", "CA A", "CA B", 1, 0);
    const added = m("2025-06-01", "CA B", "CA C", 1, 0, { stage: "Final" });
    const out = run(base([old, added], []), EXTENDS);
    expect(out.matches.map((x) => x.date)).toEqual(["2025-06-01"]);
    expect(out.seasons).toEqual([]);
    expect(out.standings).toEqual([]);
  });

  it("reports every unknown club once, with the excerpt and line", () => {
    const unknown = [m("2025-07-11", "CA Zeta", "CA B", 1, 0)];
    const problems = problemsOf(() => run(base(unknown, []), { ...OWN, tableCoversSeason: false }));
    expect(problems.filter((x) => /unknown club/.test(x))).toEqual([
      expect.stringMatching(/unknown club "CA Zeta".*arg2025\.1clausura/),
    ]);
  });

  it("reports an own tournament without a single match", () => {
    expect(problemsOf(() => run(base([], []), { ...OWN, tableCoversSeason: false }))[0]).toMatch(
      /no match was read/,
    );
  });

  it("reports the same club with two spellings in one context, unless it is a variant", () => {
    const two = [
      m("2025-07-11", "CA A", "CA B", 1, 0),
      m("2025-07-18", "Club A (X, B)", "CA C", 1, 0),
    ];
    const t = { ...OWN, tableCoversSeason: false };
    expect(problemsOf(() => run(base(two, []), t))[0]).toMatch(/both resolve to the club "a"/);
    const ok = run(base(two, []), t, page({ variants: [["CA A", "Club A (X, B)"]] }));
    expect(ok.matches).toHaveLength(2);
  });
});

describe("table check (plan 0017, T19)", () => {
  it("passes when the tallies are equal", () => {
    expect(() => run(base(goodMatches(), [goodTable]))).not.toThrow();
  });

  it("names the club and the numbers on both sides when they differ", () => {
    const bad = table([
      row("Club A", "(X, B)", [1, 1, 0, 0, 3, 1, 3]),
      row("Club B", "(Y, C)", [2, 0, 1, 1, 1, 2, 1]),
      row("Club C", "(Z, D)", [1, 0, 1, 0, 0, 0, 1]),
    ]);
    const problems = problemsOf(() => run(base(goodMatches(), [bad])));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Club A: the table says Gf=3 but the matches give 2/);
  });

  it("reports a missing match, an extra match and a club that is not in the table", () => {
    const fewer = table([goodTable.rows[0], goodTable.rows[1]]);
    expect(problemsOf(() => run(base(goodMatches(), [fewer])))).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/c has matches but is not in the final table/),
      ]),
    );
    const extra = [...goodMatches(), m("2025-07-25", "CA A", "CA C", 1, 0)];
    expect(problemsOf(() => run(base(extra, [goodTable]))).length).toBeGreaterThan(0);
  });

  it("lets a listed exception pass, and reports an unused one", () => {
    const deducted = table([
      row("Club A", "(X, B)", [1, 1, 0, 0, 2, 1, 0]),
      goodTable.rows[1],
      goodTable.rows[2],
    ]);
    const exception = { excerpt: "1clausura", club: "Club A", reason: "points deducted" };
    expect(() =>
      run(base(goodMatches(), [deducted]), OWN, page({ tableExceptions: [exception] })),
    ).not.toThrow();
    const stale = problemsOf(() =>
      run(base(goodMatches(), [goodTable]), OWN, page({ tableExceptions: [exception] })),
    );
    expect(stale[0]).toMatch(/exception for Club A is unused/);
  });

  it("reports a season whose table is missing, and skips tournaments that do not need one", () => {
    expect(problemsOf(() => run(base(goodMatches(), [])))[0]).toMatch(/no final table/);
    expect(() => run(base(goodMatches(), []), { ...OWN, tableCoversSeason: false })).not.toThrow();
  });

  it("resolves the table names with their headquarters", () => {
    const wrongName = table([
      row("Club A", "(Nowhere, B)", [1, 1, 0, 0, 2, 1, 3]),
      goodTable.rows[1],
      goodTable.rows[2],
    ]);
    expect(problemsOf(() => run(base(goodMatches(), [wrongName])))).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown club "Club A \(Nowhere, B\)"/)]),
    );
  });

  it("reports the combined output of several tournaments in one run", () => {
    const raws: RawTournament[] = [
      { tournament: OWN, page: page(), parsed: base(goodMatches(), [goodTable]) },
    ];
    expect(normalizeRsssf(raws, clubs, []).report.files[0]).toMatchObject({
      file: "arg2025.1clausura",
      parsed: 2,
      first: "2025-07-11",
      last: "2025-07-18",
    });
  });
});

describe("normalizeRsssf: cups, only the matches of the app clubs (T51, ADR 0022)", () => {
  const CUP: TournamentConfig = {
    id: "copa-x-2025",
    competition_id: "copa-x",
    name: "Copa X 2025",
    page: "arg2025",
    excerpt: "nationalcup",
    window: { from: "2025-01-01", to: "2025-12-31" },
    mode: { kind: "own" },
    tableCoversSeason: false,
    appClubsOnly: true,
  };
  const world = [
    { id: "a", aliases: ["CA A"] },
    { id: "b", aliases: ["CA B"], selectable: true },
    { id: "opp", aliases: ["Opp FC"], selectable: false },
  ] as never;
  const cup = (matches: ParsedMatch[]) => ({
    excerpt: "arg2025.nationalcup",
    matches,
    tables: [],
  });
  const runCup = (matches: ParsedMatch[], t = CUP) =>
    normalizeRsssf([{ tournament: t, page: page(), parsed: cup(matches) }], world, []);

  it("keeps the matches where an app club plays, against an opponent too", () => {
    const out = runCup([
      m("2025-02-01", "CA A", "Opp FC", 2, 0, { stage: "32avos de final" }),
      m("2025-02-08", "Opp FC", "CA B", 1, 1, { stage: "16avos de final" }),
    ]);
    expect(out.matches.map((x) => x.id)).toEqual(["2025-02-01-a-opp", "2025-02-08-opp-b"]);
  });

  it("drops a match between two clubs that are not app clubs, known or not", () => {
    const out = runCup([
      m("2025-02-01", "CA A", "CA B", 2, 0),
      m("2025-02-02", "Some Unknown FC", "Another Unknown FC", 3, 1),
      m("2025-02-03", "Opp FC", "Some Unknown FC", 0, 0),
    ]);
    expect(out.matches.map((x) => x.id)).toEqual(["2025-02-01-a-b"]);
  });

  it("stops and names the club when an app club meets a club it does not know", () => {
    const problems = problemsOf(() => runCup([m("2025-02-01", "CA A", "Newcomers FC", 1, 0)]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^unknown club "Newcomers FC" \(first seen at arg2025\.nationalcup:/,
    );
  });

  it("reports in the run which unknown names were dropped, so a missing alias is seen", () => {
    const out = runCup([
      m("2025-02-02", "Some Unknown FC", "Another Unknown FC", 3, 1),
      m("2025-02-03", "Opp FC", "Some Unknown FC", 0, 0),
    ]);
    expect(out.report.files[0].droppedUnknown).toEqual(["Another Unknown FC", "Some Unknown FC"]);
    expect(out.report.files[0].parsed).toBe(0);
  });

  it("shows an app club with a missing alias against a known opponent, in the dropped names", () => {
    // "CA Aaa" is a spelling of an app club that is not in its aliases yet: the match is dropped
    // and the name is listed, which is the only way a reviewer sees the loss.
    const out = runCup([m("2025-02-01", "CA Aaa", "Opp FC", 1, 0)]);
    expect(out.matches).toEqual([]);
    expect(out.report.files[0].droppedUnknown).toEqual(["CA Aaa"]);
  });

  it("dates the season from every match of the page, not only the kept ones", () => {
    const out = runCup([
      m("2025-02-01", "Some Unknown FC", "Another Unknown FC", 3, 1),
      m("2025-03-01", "CA A", "Opp FC", 1, 0),
      m("2025-11-05", "Another Unknown FC", "Some Unknown FC", 1, 0),
    ]);
    expect(out.seasons[0]).toMatchObject({ start: "2025-02-01", end: "2025-11-05" });
    expect(out.matches).toHaveLength(1);
  });

  it("does not drop anything in a league tournament", () => {
    const problems = problemsOf(() => run(base([m("2025-07-11", "CA A", "Zzz FC", 1, 0)], [])));
    expect(problems.some((p) => p.includes('unknown club "Zzz FC"'))).toBe(true);
  });
});

describe("normalizeRsssf: the title of a cup is decided in its final (Phase B)", () => {
  const CUP: TournamentConfig = {
    id: "copa-x-2025",
    competition_id: "copa-x",
    name: "Copa X 2025",
    page: "arg2025",
    excerpt: "nationalcup",
    window: { from: "2025-01-01", to: "2025-12-31" },
    mode: { kind: "own" },
    tableCoversSeason: false,
    appClubsOnly: true,
    titleFromFinal: true,
  };
  const world = [
    { id: "a", aliases: ["CA A"] },
    { id: "b", aliases: ["CA B"] },
    { id: "opp", aliases: ["Opp FC"], selectable: false },
  ] as never;
  const run2 = (matches: ParsedMatch[]) =>
    normalizeRsssf(
      [
        {
          tournament: CUP,
          page: page(),
          parsed: { excerpt: "arg2025.nationalcup", matches, tables: [] },
        },
      ],
      world,
      [],
    );
  const final = (home: string, away: string, hg: number, ag: number, extra = {}) =>
    m("2025-11-05", home, away, hg, ag, { stage: "Final", ...extra });

  it("writes only the competitions of the tournaments of the run", () => {
    const out = normalizeRsssf(
      [
        {
          tournament: CUP,
          page: page(),
          parsed: { excerpt: "x", matches: [final("CA A", "Opp FC", 2, 1)], tables: [] },
        },
      ],
      world,
      [
        {
          id: "copa-x",
          name: "X",
          type: "national_cup",
          scope: "domestic",
          organizer: "AFA",
          afa_recognized: true,
          source: "s",
        },
        {
          id: "copa-unused",
          name: "Y",
          type: "national_cup",
          scope: "domestic",
          organizer: "AFA",
          afa_recognized: true,
          source: "s",
        },
      ],
    );
    expect(out.competitions.map((c) => c.id)).toEqual(["copa-x"]);
  });

  it("names the winner on goals", () => {
    const out = run2([final("CA A", "Opp FC", 2, 1)]);
    expect(out.titles).toEqual([
      {
        id: "copa-x-2025-a",
        club_id: "a",
        competition_id: "copa-x",
        season_id: "copa-x-2025",
        awarded_on: "2025-11-05",
        shared: false,
        source: "https://www.rsssf.org/tablesa/arg2025.html#nationalcup",
        verified: false,
      },
    ]);
  });

  it("names the winner on penalties when the goals are level, the away side too", () => {
    const out = run2([
      final("CA A", "CA B", 2, 2, { penalties: { home: 3, away: 5 }, extraTime: true }),
    ]);
    expect(out.titles!.map((t) => t.club_id)).toEqual(["b"]);
  });

  it("writes no title when the champion is not an app club", () => {
    const out = run2([
      m("2025-03-01", "CA A", "Opp FC", 1, 0),
      final("Opp FC", "Zzz Unknown FC", 1, 0),
    ]);
    expect(out.titles ?? []).toEqual([]);
  });

  it("stops when the section has no final or two", () => {
    expect(problemsOf(() => run2([m("2025-03-01", "CA A", "Opp FC", 1, 0)]))).toEqual([
      "copa-x-2025: no final in arg2025.nationalcup to name the champion",
    ]);
    expect(
      problemsOf(() => run2([final("CA A", "Opp FC", 1, 0), final("CA B", "Opp FC", 1, 0)])),
    ).toEqual(["copa-x-2025: the 2 finals in arg2025.nationalcup are not the two legs of one tie"]);
  });

  it("stops when the final has no winner", () => {
    expect(problemsOf(() => run2([final("CA A", "Opp FC", 1, 1)]))).toEqual([
      "copa-x-2025: the final 2025-11-05-a-opp has no winner on goals or penalties",
    ]);
  });
});

describe("normalizeRsssf: a final in two legs and what a desk decided (Phase B3)", () => {
  const CUP: TournamentConfig = {
    id: "copa-y-2018",
    competition_id: "copa-y",
    name: "Copa Y 2018",
    page: "copa2018",
    excerpt: "tournament",
    window: { from: "2018-01-01", to: "2018-12-31" },
    mode: { kind: "own" },
    tableCoversSeason: false,
    appClubsOnly: true,
    titleFromFinal: true,
  };
  const world = [
    { id: "a", aliases: ["CA A"] },
    { id: "b", aliases: ["CA B"] },
    { id: "opp", aliases: ["Opp FC"], selectable: false },
  ] as never;
  const cupPage = page({ url: "https://www.rsssf.org/sacups/copa2018.html" });
  const run3 = (matches: ParsedMatch[]) =>
    normalizeRsssf(
      [
        {
          tournament: CUP,
          page: cupPage,
          parsed: { excerpt: "copa2018.tournament", matches, tables: [] },
        },
      ],
      world,
      [],
    );
  const runNoTitle = (matches: ParsedMatch[]) =>
    normalizeRsssf(
      [
        {
          tournament: { ...CUP, titleFromFinal: false },
          page: cupPage,
          parsed: { excerpt: "copa2018.tournament", matches, tables: [] },
        },
      ],
      world,
      [],
    );
  const leg = (
    date: string,
    home: string,
    away: string,
    hg: number | null,
    ag: number | null,
    extra = {},
  ) => m(date, home, away, hg, ag, { stage: "Final", ...extra });

  it("takes the source from the page, which may be in another directory", () => {
    const out = runNoTitle([m("2018-03-01", "CA A", "Opp FC", 1, 0)]);
    expect(out.matches[0].source).toBe("https://www.rsssf.org/sacups/copa2018.html#tournament");
  });

  it("names the champion of a two-legged final on the aggregate", () => {
    const out = run3([
      leg("2018-11-11", "CA A", "CA B", 2, 2),
      leg("2018-12-09", "CA B", "CA A", 1, 3, { extraTime: true }),
    ]);
    expect(out.titles).toMatchObject([
      { club_id: "a", awarded_on: "2018-12-09", season_id: "copa-y-2018" },
    ]);
    expect(out.matches.map((x) => x.is_final)).toEqual([true, true]);
  });

  it("names the champion on the penalties of the second leg when the aggregate is level", () => {
    const out = run3([
      leg("2018-11-11", "CA A", "CA B", 1, 0),
      leg("2018-12-09", "CA B", "CA A", 1, 0, { penalties: { home: 3, away: 4 } }),
    ]);
    expect(out.titles!.map((t) => t.club_id)).toEqual(["a"]);
  });

  it("stops when a two-legged final is level on the aggregate and has no shoot-out", () => {
    expect(
      problemsOf(() =>
        run3([leg("2018-11-11", "CA A", "CA B", 1, 0), leg("2018-12-09", "CA B", "CA A", 1, 0)]),
      ),
    ).toEqual(["copa-y-2018: the final 2018-12-09-b-a has no winner on goals or penalties"]);
  });

  it("stops when two finals are not the two legs of one tie, or when there are three", () => {
    expect(
      problemsOf(() =>
        run3([
          leg("2018-11-11", "CA A", "Opp FC", 1, 0),
          leg("2018-12-09", "CA B", "Opp FC", 1, 0),
        ]),
      ),
    ).toEqual(["copa-y-2018: the 2 finals in copa2018.tournament are not the two legs of one tie"]);
    expect(
      problemsOf(() =>
        run3([
          leg("2018-11-01", "CA A", "CA B", 1, 0),
          leg("2018-11-11", "CA B", "CA A", 1, 0),
          leg("2018-12-09", "CA A", "CA B", 1, 0),
        ]),
      ),
    ).toEqual([
      "copa-y-2018: 3 finals in copa2018.tournament, expected one or the two legs of one tie",
    ]);
  });

  it("writes an awarded leg as an administrative result and an abandoned leg as suspended", () => {
    const out = runNoTitle([
      m("2018-08-21", "CA A", "Opp FC", 3, 0, { awarded: true }),
      m("2018-08-28", "Opp FC", "CA A", null, null, { abandoned: "abandoned" }),
    ]);
    expect(out.matches.map((x) => [x.status, x.home_goals, x.away_goals])).toEqual([
      ["administrative_result", 3, 0],
      ["suspended", null, null],
    ]);
  });

  it("stops on a tie the parser could not read when an app club plays it, and only then", () => {
    const unreadable = (home: string, away: string) =>
      m("2018-03-01", home, away, null, null, { unreadable: "the legs do not add up" });
    expect(problemsOf(() => runNoTitle([unreadable("CA A", "Opp FC")]))).toEqual([
      `copa2018.tournament:${line}: the legs do not add up`,
    ]);
    expect(runNoTitle([unreadable("Opp FC", "Zzz Unknown FC")]).matches).toEqual([]);
  });
});
