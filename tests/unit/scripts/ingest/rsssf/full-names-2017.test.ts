import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeSource } from "../../../../../scripts/ingest/core/pinned-fetch";
import { parseFullNames2017 } from "../../../../../scripts/ingest/rsssf/layouts/full-names-2017";
import { prepareText } from "../../../../../scripts/ingest/rsssf/text";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/rsssf");

/** Reads a byte-exact fixture the way the adapter reads an excerpt: windows-1252, then the pre-pass. */
function load(name: string) {
  const bytes = readFileSync(join(FIXTURES, name));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const text = decodeSource({ name, url: "https://x", sha256, encoding: "windows-1252" }, bytes);
  return prepareText(text, name);
}

const W_1819 = { from: "2018-08-01", to: "2019-07-31" };
const W_2025_CLAUSURA = { from: "2025-07-01", to: "2025-12-31" };
const W_2025_APERTURA = { from: "2025-01-01", to: "2025-06-30" };

describe("full-names-2017: Superliga 2018-19", () => {
  const parsed = parseFullNames2017(load("superliga-2018-19.txt"), { window: W_1819, ignore: [] });

  it("reads the table with full names and the headquarters", () => {
    const full = parsed.tables.find((t) => t.kind === "full")!;
    expect(full.rows).toHaveLength(26);
    expect(full.rows[0]).toMatchObject({
      position: 1,
      name: "Racing Club Asociación Civil",
      played: 25,
      won: 17,
      drawn: 6,
      lost: 2,
      goalsFor: 43,
      goalsAgainst: 16,
      points: 57,
      suffix: "(Avellaneda, B)",
    });
    expect(full.rows[25].name).toBe("Asociación Atlética Argentinos Juniors");
  });

  it("reads the short-name table that follows the matches, and ignores the notes", () => {
    const short = parsed.tables.filter((t) => t.kind === "short");
    expect(short).toHaveLength(1);
  });

  it("reads match lines with the date of the header and the stage of the round", () => {
    const first = parsed.matches[0];
    expect(first).toMatchObject({
      date: "2018-08-10",
      stage: "Fecha 1",
      home: "CA Tigre",
      away: "CA San Lorenzo de Almagro",
      homeGoals: 2,
      awayGoals: 2,
      extraTime: false,
      penalties: null,
      abandoned: null,
      resumed: null,
    });
    expect(parsed.matches.find((m) => m.home === "CA Boca Juniors")).toMatchObject({
      date: "2018-08-12",
      away: "CA Talleres",
    });
  });

  it("keeps rescheduled matches under their round with their own date", () => {
    const rescheduled = parsed.matches.filter((m) => m.date === "2019-01-19");
    expect(rescheduled).toHaveLength(1);
    expect(rescheduled[0]).toMatchObject({
      stage: "Fecha 8",
      home: "CA River Plate",
      away: "CSyD Defensa y Justicia",
    });
  });

  it("accepts a round heading with a suffix", () => {
    expect(parsed.matches.some((m) => m.stage === "Fecha 9")).toBe(true);
  });

  it("reads club names with a place in brackets", () => {
    expect(parsed.matches.some((m) => m.away === "CA San Martín (San Juan)")).toBe(true);
  });
});

describe("full-names-2017: Clausura 2025", () => {
  const parsed = parseFullNames2017(load("clausura-2025.txt"), {
    window: W_2025_CLAUSURA,
    ignore: [],
  });

  it("reads the stages of the knockout rounds", () => {
    const stages = [...new Set(parsed.matches.map((m) => m.stage))];
    expect(stages).toEqual([
      "Fecha 1",
      "Octavos de final",
      "Cuartos de final",
      "Semifinal",
      "Final",
    ]);
  });

  it("reads extra time and the shoot-out of the quarter final", () => {
    const quarter = parsed.matches.find((m) => m.stage === "Cuartos de final" && m.penalties);
    expect(quarter).toMatchObject({
      home: "Racing Club",
      away: "CA Tigre",
      homeGoals: 0,
      awayGoals: 0,
      extraTime: true,
      penalties: { home: 4, away: 2 },
      date: "2025-12-01",
    });
  });

  it("reads the final: Estudiantes win on penalties", () => {
    const final = parsed.matches.find((m) => m.stage === "Final")!;
    expect(final).toMatchObject({
      date: "2025-12-14",
      home: "Racing Club",
      away: "Club Estudiantes de La Plata",
      homeGoals: 1,
      awayGoals: 1,
      penalties: { home: 4, away: 5 },
    });
  });

  it("reads extra time without a shoot-out", () => {
    const aet = parsed.matches.find((m) => m.home === "Deportivo Riestra AFBC");
    expect(aet).toMatchObject({ extraTime: true, penalties: null, homeGoals: 0, awayGoals: 1 });
  });

  it("reads the group tables, with the round they reached", () => {
    const group = parsed.tables.find((t) => t.rows[0]?.suffix === "(Round of 16)")!;
    expect(group.kind).toBe("short");
    expect(group.rows[0]).toMatchObject({ name: "CA Boca Juniors", points: 29 });
  });

  it("reads the combined table with the champion marks", () => {
    const full = parsed.tables.find((t) => t.kind === "full")!;
    expect(full.rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(full.rows[0].name).toBe("Club Estudiantes de La Plata");
  });
});

describe("full-names-2017: abandoned and resumed matches", () => {
  const parsed = parseFullNames2017(load("apertura-2025-abandoned.txt"), {
    window: W_2025_APERTURA,
    ignore: [],
  });
  const talleres = parsed.matches.filter(
    (m) => m.home === "CD Godoy Cruz Antonio Tomba" && m.away === "CA Talleres",
  );

  it("reads the abandoned line with no score and the line that completes it", () => {
    expect(talleres).toHaveLength(2);
    expect(talleres[0]).toMatchObject({
      homeGoals: null,
      awayGoals: null,
      abandoned: "0-0 in 45m HT",
      resumed: null,
    });
    expect(talleres[1]).toMatchObject({
      homeGoals: 0,
      awayGoals: 0,
      abandoned: null,
      resumed: "45m",
    });
  });
});

describe("full-names-2017: failures", () => {
  const prepare = (lines: string[]) => prepareText(lines.join("\n"), "x.txt");
  const ctx = { window: W_1819, ignore: [] };
  const round = ["Round 1", "[Aug 10, Fri]"];

  it("stops on a line it does not know inside the matches", () => {
    expect(() => parseFullNames2017(prepare([...round, "something odd here"]), ctx)).toThrow(
      /x\.txt:3: unrecognized line "something odd here"/,
    );
  });

  it("lets a reviewed line through", () => {
    const text = prepare([...round, "something odd here"]);
    expect(() =>
      parseFullNames2017(text, { ...ctx, ignore: ["something odd here"] }),
    ).not.toThrow();
  });

  it("stops on a date header before any round", () => {
    expect(() => parseFullNames2017(prepare(["[Aug 10, Fri]"]), ctx)).toThrow(/before any round/);
  });

  it("stops on a wrong weekday", () => {
    expect(() => parseFullNames2017(prepare(["Round 1", "[Aug 10, Sat]"]), ctx)).toThrow(/Fri/);
  });

  it("stops on a shoot-out score without pso, and on pso without a score", () => {
    const base = (score: string, tail: string) =>
      prepare([...round, `A FC   ${score}   B FC   ${tail}`]);
    expect(() => parseFullNames2017(base("[4] 1- 1  [2]", "Stadium, X"), ctx)).toThrow(/pso/);
    expect(() => parseFullNames2017(base("1- 1", "pso, Stadium"), ctx)).toThrow(/pso/);
  });

  it("stops on a match with no score that is not abandoned", () => {
    expect(() =>
      parseFullNames2017(prepare([...round, "A FC   -   B FC   Stadium, X"]), ctx),
    ).toThrow(/not abandoned/);
  });

  it("ignores text before the matches and after the tables", () => {
    const text = prepare([
      "Title",
      "free text: anything",
      "",
      ...round,
      "A FC   1- 0   B FC   S",
      "Table",
      "free",
    ]);
    expect(parseFullNames2017(text, ctx).matches).toHaveLength(1);
  });
});
