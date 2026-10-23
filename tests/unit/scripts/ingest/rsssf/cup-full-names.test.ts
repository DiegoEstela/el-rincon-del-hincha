import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeSource } from "../../../../../scripts/ingest/core/pinned-fetch";
import { parseCupFullNames } from "../../../../../scripts/ingest/rsssf/layouts/cup-full-names";
import { prepareText } from "../../../../../scripts/ingest/rsssf/text";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/rsssf");

/** Reads a byte-exact fixture the way the adapter reads an excerpt: windows-1252, then the pre-pass. */
function load(name: string) {
  const bytes = readFileSync(join(FIXTURES, name));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const text = decodeSource({ name, url: "https://x", sha256, encoding: "windows-1252" }, bytes);
  return prepareText(text, name);
}
const inline = (text: string) => prepareText(text, "cup.txt");

const W_2025 = { from: "2025-01-01", to: "2025-12-31" };
const parse = (text: ReturnType<typeof prepareText>, window = W_2025, ignore: string[] = []) =>
  parseCupFullNames(text, { window, ignore });

describe("cup-full-names: Copa Argentina 2025", () => {
  const parsed = parse(load("copa-argentina-2025.txt"));

  it("reads the 63 matches of a 64-team draw, in the order of the page", () => {
    expect(parsed.matches).toHaveLength(63);
    expect(parsed.matches[0]).toMatchObject({
      date: "2025-01-22",
      stage: "32avos de final",
      home: "CA Boca Juniors",
      away: "CD Argentino",
      homeGoals: 5,
      awayGoals: 0,
      penalties: null,
    });
  });

  it("names the rounds in Spanish and keeps the number of matches of each", () => {
    const count = (stage: string) => parsed.matches.filter((m) => m.stage === stage).length;
    expect(count("32avos de final")).toBe(32);
    expect(count("16avos de final")).toBe(16);
    expect(count("Octavos de final")).toBe(8);
    expect(count("Cuartos de final")).toBe(4);
    expect(count("Semifinal")).toBe(2);
    expect(count("Final")).toBe(1);
  });

  it("reads the shoot-out of the final", () => {
    const final = parsed.matches[parsed.matches.length - 1];
    expect(final).toMatchObject({
      date: "2025-11-05",
      stage: "Final",
      home: "CS Independiente Rivadavia",
      away: "AA Argentinos Juniors",
      homeGoals: 2,
      awayGoals: 2,
      penalties: { home: 5, away: 3 },
    });
  });

  it("does not take the table of the cup (rounds reached) as a final table", () => {
    expect(parsed.tables).toEqual([]);
  });

  it("stops on a line it does not know inside the matches", () => {
    const text = inline("Final:\n[Nov 8, Sat]\nsomething odd in the middle\n");
    expect(() => parse(text)).toThrow(
      /cup\.txt:3: unrecognized line "something odd in the middle"/,
    );
  });
});

describe("cup-full-names: a cup of one match", () => {
  it("takes the date with the weekday and calls the match the final", () => {
    const parsed = parse(load("trofeo-campeones-2025.txt"));
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0]).toMatchObject({
      date: "2025-12-20",
      stage: "Final",
      home: "Club Estudiantes de La Plata",
      away: "CA Platense",
      homeGoals: 2,
      awayGoals: 1,
    });
  });

  it("reads a date header that carries its own year", () => {
    const window = { from: "2024-01-01", to: "2025-12-31" };
    const parsed = parse(load("supercopa-argentina-2024.txt"), window);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0]).toMatchObject({
      date: "2025-09-06",
      stage: "Final",
      home: "CA Vélez Sarsfield",
      away: "CA Central Córdoba",
    });
  });

  it("rejects a date with its own year that falls outside the window", () => {
    const window = { from: "2024-01-01", to: "2024-12-31" };
    expect(() => parse(load("supercopa-argentina-2024.txt"), window)).toThrow(
      /2025-09-06 is outside the window 2024-01-01 to 2024-12-31/,
    );
  });

  it("rejects a weekday that does not match the date", () => {
    const text = inline("[2025 Sep 6, Mon]\nCA A     1- 0     CA B     Somewhere\n");
    expect(() => parse(text, { from: "2025-01-01", to: "2025-12-31" })).toThrow(
      /2025-09-06 is a Sat, but the page says Mon/,
    );
  });
});

describe("cup-full-names: the rest of the grammar", () => {
  it("reads two-digit goals, a missing weekday and the aet note", () => {
    const text = inline(
      "Quarterfinals – Cuartos de final:\n[Mar 5]\nCA A     10- 1     CA B     aet, Somewhere, B\n",
    );
    const [match] = parse(text).matches;
    expect(match).toMatchObject({
      date: "2025-03-05",
      stage: "Cuartos de final",
      homeGoals: 10,
      awayGoals: 1,
      extraTime: true,
    });
  });

  it("rejects a shoot-out score without pso and pso without a score", () => {
    const base = "Final:\n[Mar 5, Wed]\n";
    expect(() => parse(inline(`${base}CA A  [3] 1- 1  [1] CA B   Somewhere\n`))).toThrow(
      /shoot-out score without "pso"/,
    );
    expect(() => parse(inline(`${base}CA A  1- 1  CA B   pso, Somewhere\n`))).toThrow(
      /"pso" without a shoot-out score/,
    );
  });

  it("skips a reviewed ignored line", () => {
    const text = inline(
      "Final:\n[Mar 5, Wed]\nNB: replayed\nCA A     1- 0     CA B     Somewhere\n",
    );
    expect(parse(text, W_2025, ["NB: replayed"]).matches).toHaveLength(1);
    expect(() => parse(text)).toThrow(/unrecognized line "NB: replayed"/);
  });

  it("reads a knockout heading with the round of 16 in English and Spanish", () => {
    expect(() =>
      parse(inline("Round of 16 – Octavos de Final:\n[Mar 5, Wed]\nCA A  1- 0  CA B  X\n")),
    ).not.toThrow();
  });
});

describe("cup-full-names: variants of the cup sections of 2023 to 2025", () => {
  it("reads PSO and AET in capitals", () => {
    const text = inline(
      "Final:\n[Feb 8, Sat]\nCA A    [4] 1- 1  [5] CA B    aet, PSO, Somewhere, B\n",
    );
    const [match] = parse(text).matches;
    expect(match).toMatchObject({ extraTime: true, penalties: { home: 4, away: 5 } });
  });

  it("reads a shoot-out note written one space after the away club", () => {
    const text = inline(
      "Final:\n[Apr 18, Fri]\nCD A    [7] 1- 1  [8] Club B Universitario pso, Somewhere, X\n",
    );
    const [match] = parse(text).matches;
    expect(match).toMatchObject({
      away: "Club B Universitario",
      penalties: { home: 7, away: 8 },
    });
  });

  it("does not split a name that contains pso when there is no shoot-out score", () => {
    const text = inline("Final:\n[Apr 18, Fri]\nCD A    1- 0   Club pso Norte   Somewhere, X\n");
    expect(parse(text).matches[0].away).toBe("Club pso Norte");
  });

  it("cuts a glued shoot-out note at the last separator, keeping a pso inside the name", () => {
    const text = inline(
      "Final:\n[Apr 18, Fri]\nCD A    [4] 1- 1  [5] Club pso Norte pso, Somewhere, X\n",
    );
    expect(parse(text).matches[0]).toMatchObject({
      away: "Club pso Norte",
      penalties: { home: 4, away: 5 },
    });
  });

  it("reads a header that writes the weekday first and the year last", () => {
    const text = inline(
      "[Wed, 5 Mar 2025]\nCA A   [2] 0- 0 [3]  CA B     aet, pso, Somewhere, PAR\n",
    );
    const [match] = parse(text, { from: "2025-01-01", to: "2025-12-31" }).matches;
    expect(match).toMatchObject({ date: "2025-03-05", stage: "Final" });
  });

  it("checks the weekday of that header too", () => {
    const text = inline("[Thu, 5 Mar 2025]\nCA A   1- 0  CA B     Somewhere\n");
    expect(() => parse(text)).toThrow(/2025-03-05 is a Wed, but the page says Thu/);
  });
});
