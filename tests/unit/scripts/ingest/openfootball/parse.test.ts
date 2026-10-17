import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOpenfootball } from "../../../../../scripts/ingest/openfootball/parse";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/openfootball");
const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

/** Builds a small valid file; every test overrides one thing. */
function file(
  body: string[],
  header: { date?: string; teams?: number; matches?: number; stages?: string } = {},
): string {
  const lines = [
    "= Argentina Primera Division 2024",
    "",
    `# Date       ${header.date ?? "Fri May 10 2024 - Sat May 11 2024 (2d)"}`,
    `# Teams      ${header.teams ?? 4}`,
    `# Matches    ${header.matches ?? 2}`,
    ...(header.stages ? [`# Stages     ${header.stages}`] : []),
    "",
    "",
    "",
    "▪ Matchday 1",
    ...body,
  ];
  return lines.join("\n");
}

const TWO_MATCHES = [
  "  Fri May 10 2024",
  "    19:00  Alfa                    v Beta                     1-0 (0-0)",
  "  Sat May 11",
  "    21:00  Gamma                   v Delta                    2-2",
];
const parse = (text: string, name = "x.txt") => parseOpenfootball(name, text);

describe("real fixtures: header facts", () => {
  const FACTS: [string, string, string, number, number][] = [
    ["2018-19_ar1.txt", "2018-08-10", "2019-04-07", 26, 325],
    ["2019-20_ar1.txt", "2019-07-26", "2020-03-09", 24, 276],
    ["2020_ar1.txt", "2020-10-30", "2021-03-31", 24, 135],
    ["2021_ar1.txt", "2021-07-16", "2021-12-13", 26, 325],
    ["2022_ar1.txt", "2022-06-03", "2022-10-25", 28, 378],
    ["2023_ar1.txt", "2023-01-27", "2023-07-30", 28, 378],
    ["2024_ar1.txt", "2024-05-10", "2024-12-16", 28, 378],
    ["2025_ar1.txt", "2025-01-23", "2025-05-04", 30, 240],
  ];
  for (const [name, first, last, teams, matches] of FACTS) {
    it(`${name} parses to ${matches} matches`, () => {
      const parsed = parse(read(name), name);
      expect(parsed.header).toMatchObject({ first, last, teams, matches });
      expect(parsed.matches).toHaveLength(matches);
      expect(parsed.matches[0].date >= first).toBe(true);
      expect(
        new Set(parsed.matches.map((m) => m.home).concat(parsed.matches.map((m) => m.away))).size,
      ).toBe(teams);
    });
  }

  it("reads the edition and the stage totals of the 2020 file", () => {
    const parsed = parse(read("2020_ar1.txt"), "2020_ar1.txt");
    expect(parsed.edition).toBe("2020");
    expect(parsed.header.stages).toEqual([
      { group: "Regular Season", count: 72 },
      { group: "Copa Sud", count: 1 },
      { group: "Fase Campeón", count: 31 },
      { group: "Fase Complementación", count: 31 },
    ]);
  });
});

describe("lines", () => {
  it("parses a small file", () => {
    const parsed = parse(file(TWO_MATCHES));
    expect(parsed.matches.map((m) => [m.date, m.home, m.away, m.homeGoals, m.awayGoals])).toEqual([
      ["2024-05-10", "Alfa", "Beta", 1, 0],
      ["2024-05-11", "Gamma", "Delta", 2, 2],
    ]);
    expect(parsed.matches[0].line).toBe(11);
    expect(parsed.matches[0].heading).toBe("Matchday 1");
  });

  it("accepts a match without kickoff time (same slot as above)", () => {
    const body = [
      "  Fri May 10 2024",
      "    19:00  Alfa                    v Beta                     1-0",
      "           Gamma                   v Delta                    0-0",
    ];
    const parsed = parse(file(body, { date: "Fri May 10 2024 - Fri May 10 2024 (1d)" }));
    expect(parsed.matches).toHaveLength(2);
  });

  it("keeps accents, apostrophes and inner spaces in names", () => {
    const body = [
      "  Fri May 10 2024",
      "    19:00  Newell's Old Boys       v Central Córdoba SdE      1-1",
      "    21:00  Vélez Sarsfield         v Atlético Tucumán         0-0",
    ];
    const parsed = parse(file(body, { date: "Fri May 10 2024 - Fri May 10 2024 (1d)" }));
    expect(parsed.matches.map((m) => m.home)).toEqual(["Newell's Old Boys", "Vélez Sarsfield"]);
    expect(parsed.matches[0].away).toBe("Central Córdoba SdE");
  });

  it("tolerates CRLF, LF and mixed line endings", () => {
    const text = file(TWO_MATCHES);
    const crlf = text.split("\n").join("\r\n");
    const mixed = text
      .split("\n")
      .map((l, i) => (i < 6 ? `${l}\r` : l))
      .join("\n");
    expect(parse(crlf).matches).toHaveLength(2);
    expect(parse(mixed).matches).toHaveLength(2);
    expect(parse(crlf).matches[0].line).toBe(parse(text).matches[0].line);
  });

  it("throws on an unexpected line, naming file and line", () => {
    const text = file([...TWO_MATCHES, "  something odd"]);
    expect(() => parse(text)).toThrow("x.txt:14: unexpected line");
  });
});

describe("dates", () => {
  it("carries the year and switches on an explicit one", () => {
    const body = [
      "  Mon Dec 30 2024",
      "    19:00  Alfa                    v Beta                     1-0",
      "  Thu Jan 2 2025",
      "    19:00  Gamma                   v Delta                    1-0",
      "  Fri Jan 3",
      "    19:00  Alfa                    v Gamma                    1-0",
    ];
    const parsed = parse(file(body, { date: "Mon Dec 30 2024 - Fri Jan 3 2025 (5d)", matches: 3 }));
    expect(parsed.matches.map((m) => m.date)).toEqual(["2024-12-30", "2025-01-02", "2025-01-03"]);
  });

  it("handles an out-of-order rescheduled block with an explicit year", () => {
    const parsed = parse(read("2018-19_ar1.txt"), "2018-19_ar1.txt");
    const jan19 = parsed.matches.find((m) => m.date === "2019-01-19" && m.home === "River Plate");
    expect(jan19?.away).toBe("Defensa y Justicia");
    const idx = parsed.matches.indexOf(jan19!);
    expect(parsed.matches[idx + 1].date < jan19!.date).toBe(true);
  });

  it("rejects a wrong weekday", () => {
    const body = [
      "  Sat May 10 2024",
      "    19:00  Alfa                    v Beta                     1-0",
    ];
    expect(() => parse(file(body))).toThrow(/x\.txt:10:.*weekday/i);
  });

  it("rejects a date line without a year before any year", () => {
    const body = [
      "  Fri May 10",
      "    19:00  Alfa                    v Beta                     1-0",
    ];
    expect(() => parse(file(body))).toThrow(/x\.txt:10:.*year/i);
  });

  it("rejects Feb 29 in a non-leap year", () => {
    const body = [
      "  Wed Feb 29 2023",
      "    19:00  Alfa                    v Beta                     1-0",
    ];
    expect(() => parse(file(body))).toThrow(/x\.txt:10:.*(real|exist|date)/i);
  });
});

describe("scores", () => {
  const one = (score: string) =>
    file(
      [
        "  Fri May 10 2024",
        `    19:00  Alfa                    v Beta                     ${score}`,
      ],
      {
        date: "Fri May 10 2024 - Fri May 10 2024 (1d)",
        teams: 2,
        matches: 1,
      },
    );

  it("parses N-N and N-N (N-N)", () => {
    expect(parse(one("3-1")).matches[0]).toMatchObject({
      homeGoals: 3,
      awayGoals: 1,
      penalties: null,
    });
    expect(parse(one("3-1 (1-0)")).matches[0]).toMatchObject({ homeGoals: 3, awayGoals: 1 });
  });

  it("parses a shoot-out: full time is the score, penalties are separate", () => {
    const m = parse(one("5-3 pen. (1-1, 0-0)")).matches[0];
    expect(m).toMatchObject({ homeGoals: 1, awayGoals: 1, penalties: { home: 5, away: 3 } });
  });

  it("parses the real Boca v Banfield shoot-out of 2020", () => {
    const m = parse(read("2020_ar1.txt"), "2020_ar1.txt").matches.find((x) => x.penalties);
    expect(m).toMatchObject({
      home: "Boca Juniors",
      away: "Banfield",
      homeGoals: 1,
      awayGoals: 1,
      penalties: { home: 5, away: 3 },
      heading: "Fase Campeón, Final",
    });
  });

  it.each([
    ["a shoot-out after a decisive full time", "5-3 pen. (2-1, 0-0)"],
    ["a drawn shoot-out", "3-3 pen. (1-1, 0-0)"],
    ["extra time", "2-1 a.e.t."],
    ["an awarded result", "3-0 awd."],
    ["a missing score", ""],
  ])("rejects %s", (_name, score) => {
    expect(() => parse(one(score))).toThrow(/x\.txt:11:/);
  });

  it("rejects a match line before any date line", () => {
    const body = ["    19:00  Alfa                    v Beta                     1-0"];
    expect(() => parse(file(body))).toThrow(/x\.txt:10:.*date/i);
  });
});

describe("file-level checks", () => {
  it("rejects a match count that disagrees with the header", () => {
    expect(() => parse(file(TWO_MATCHES, { matches: 3 }))).toThrow(/matches.*3.*2/i);
  });

  it("rejects a team count that disagrees with the header", () => {
    expect(() => parse(file(TWO_MATCHES, { teams: 5 }))).toThrow(/teams.*5.*4/i);
  });

  it("rejects a date range that disagrees with the header", () => {
    expect(() =>
      parse(file(TWO_MATCHES, { date: "Fri May 10 2024 - Sun May 12 2024 (3d)" })),
    ).toThrow(/date range/i);
  });

  it("rejects a stage total that disagrees with the header", () => {
    const body = [
      "  Fri May 10 2024",
      "    19:00  Alfa                    v Beta                     1-0",
    ];
    const text = file(body, {
      date: "Fri May 10 2024 - Fri May 10 2024 (1d)",
      teams: 2,
      matches: 1,
      stages: "Regular Season (2)",
    }).replace("▪ Matchday 1", "▪ Group A");
    expect(() => parse(text)).toThrow(/stage.*Regular Season/i);
  });

  it("rejects a duplicated match line", () => {
    const body = [
      "  Fri May 10 2024",
      "    19:00  Alfa                    v Beta                     1-0",
      "    21:00  Beta                    v Alfa                     1-0",
    ];
    expect(() =>
      parse(file(body, { date: "Fri May 10 2024 - Fri May 10 2024 (1d)", teams: 2, matches: 2 })),
    ).toThrow(/duplicate/i);
  });

  it("rejects a stage heading used without any Stages header when it is not a matchday", () => {
    const text = file(TWO_MATCHES).replace("▪ Matchday 1", "▪ Mystery Round");
    expect(() => parse(text)).toThrow(/x\.txt:9:.*heading/i);
  });
});
