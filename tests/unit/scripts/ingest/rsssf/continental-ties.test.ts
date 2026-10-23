import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeSource } from "../../../../../scripts/ingest/core/pinned-fetch";
import { parseContinentalTies } from "../../../../../scripts/ingest/rsssf/layouts/continental-ties";
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

const W2018 = { from: "2018-01-01", to: "2018-12-31" };
const W2019 = { from: "2019-01-01", to: "2019-12-31" };
const parse = (text: ReturnType<typeof prepareText>, window = W2019, ignore: string[] = []) =>
  parseContinentalTies(text, { window, ignore });

describe("continental-ties: Copa Libertadores 2019 (a whole page)", () => {
  const parsed = parse(load("libertadores-2019.txt"));

  it("reads every match: 96 of the groups, 58 of the 29 two-leg ties and the final", () => {
    expect(parsed.matches).toHaveLength(155);
    expect(parsed.matches.filter((m) => m.unreadable)).toEqual([]);
    expect(parsed.tables).toEqual([]);
  });

  it("reads a group match with its date, group and score", () => {
    expect(
      parsed.matches.find((m) => m.home === "Palestino" && m.away === "Internacional"),
    ).toMatchObject({
      date: "2019-03-06",
      stage: "Grupo A",
      homeGoals: 0,
      awayGoals: 1,
      penalties: null,
    });
  });

  it("turns the second leg around: it is played at the home of the second club", () => {
    const legs = parsed.matches.filter(
      (m) =>
        m.stage === "Semifinal" &&
        [m.home, m.away].includes("River Plate (Bs. Aires)") &&
        [m.home, m.away].includes("Boca Juniors (Bs. Aires)"),
    );
    expect(legs.map((m) => [m.date, m.home, m.homeGoals, m.away, m.awayGoals])).toEqual([
      ["2019-10-01", "River Plate (Bs. Aires)", 2, "Boca Juniors (Bs. Aires)", 0],
      ["2019-10-22", "Boca Juniors (Bs. Aires)", 1, "River Plate (Bs. Aires)", 0],
    ]);
    expect(legs[0]).toMatchObject({ homeCode: "Arg", awayCode: "Arg" });
  });

  it("turns the country codes around with the second leg", () => {
    const legs = parsed.matches.filter(
      (m) =>
        m.stage === "Octavos de final" &&
        (m.home.startsWith("River Plate") || m.away.startsWith("River Plate")) &&
        m.date < "2019-08-01",
    );
    expect(legs.map((m) => [m.home, m.homeCode, m.away, m.awayCode])).toEqual([
      ["River Plate (Bs. Aires)", "Arg", "Cruzeiro (Belo Horizonte)", "Bra"],
      ["Cruzeiro (Belo Horizonte)", "Bra", "River Plate (Bs. Aires)", "Arg"],
    ]);
  });

  it("puts the shoot-out on the second leg, from the point of view of its home club", () => {
    const second = parsed.matches.find(
      (m) => m.stage === "Octavos de final" && m.home === "Cruzeiro (Belo Horizonte)",
    )!;
    expect(second).toMatchObject({
      date: "2019-07-30",
      homeGoals: 0,
      awayGoals: 0,
      penalties: { home: 2, away: 4 },
    });
  });

  it("names the rounds in Spanish and calls the second round after the groups the round of 16", () => {
    const stages = new Set(parsed.matches.map((m) => m.stage));
    expect([...stages]).toEqual(
      expect.arrayContaining([
        "Fase previa 1",
        "Fase previa 2",
        "Fase previa 3",
        "Grupo A",
        "Grupo H",
        "Octavos de final",
        "Cuartos de final",
        "Semifinal",
        "Final",
      ]),
    );
  });

  it("reads the final of one match, with the date and the city of its heading", () => {
    const final = parsed.matches[parsed.matches.length - 1];
    expect(final).toMatchObject({
      date: "2019-11-23",
      stage: "Final",
      home: "River Plate (Bs. Aires)",
      away: "Flamengo (Rio de Janeiro)",
      homeGoals: 1,
      awayGoals: 2,
    });
  });

  it("keeps an awarded first leg of the qualifying rounds unreadable-free and adds the legs up", () => {
    const legs = parsed.matches.filter(
      (m) => m.home.startsWith("Defensor Sporting") || m.away.startsWith("Defensor Sporting"),
    );
    expect(legs.length).toBeGreaterThan(0);
  });
});

describe("continental-ties: Copa Sudamericana 2019 (a whole page)", () => {
  const parsed = parse(load("sudamericana-2019.txt"));

  it("reads 52 two-leg ties and the final", () => {
    expect(parsed.matches).toHaveLength(105);
    expect(parsed.matches.filter((m) => m.unreadable)).toEqual([]);
  });

  it("calls the second round that comes before the round of 16 the second stage", () => {
    const stages = [...new Set(parsed.matches.map((m) => m.stage))];
    expect(stages).toEqual([
      "Primera fase",
      "Segunda fase",
      "Octavos de final",
      "Cuartos de final",
      "Semifinal",
      "Final",
    ]);
  });

  it("reads a shoot-out after two legs", () => {
    const legs = parsed.matches.filter(
      (m) => m.home.startsWith("Colón (Santa Fe)") || m.away.startsWith("Colón (Santa Fe)"),
    );
    const second = legs.find(
      (m) => m.home.startsWith("Argentinos Juniors") && m.stage === "Octavos de final",
    )!;
    expect(second).toMatchObject({
      date: "2019-07-18",
      homeGoals: 0,
      awayGoals: 1,
      penalties: { home: 3, away: 4 },
    });
  });
});

describe("continental-ties: the shapes of the other years", () => {
  it("reads a two-legged final with extra time, skipping the scorers and the note", () => {
    const text = inline(
      [
        "Semifinals",
        "(Oct 23 & 30)",
        "River Plate (Bs. Aires)   Arg  Grêmio (Porto Alegre)     Bra   0-1  2-1 *2-2",
        "  [Michel 62]",
        "  [Leo Gomes 36; Rafael Santos Borré 82, Gonzalo Martínez 90pen] ",
        "",
        "Final (Nov 11 & Dec 9)",
        "Boca Juniors (Bs. Aires)  Arg  River Plate (Bs. Aires)   Arg   2-2  1-3  3-5x aet",
        "  [Ramón Ávila 34, Darío Benedetto 45; Lucas Pratto 35, Carlos Izquierdoz 61og]",
        "  [Lucas Pratto 68, Juan Fernando Quintero 109, Gonzalo Martínez 120; ",
        "   Darío Benedetto 44]",
        "x 2nd leg in Madrid; it was postponed on Nov 24 after the coach transporting",
        "  Boca was attacked by River hooligans",
        "",
      ].join("\n"),
    );
    const matches = parse(text, W2018).matches;
    expect(
      matches.map((m) => [m.stage, m.date, m.home, m.homeGoals, m.awayGoals, m.extraTime]),
    ).toEqual([
      ["Semifinal", "2018-10-23", "River Plate (Bs. Aires)", 0, 1, false],
      ["Semifinal", "2018-10-30", "Grêmio (Porto Alegre)", 1, 2, false],
      ["Final", "2018-11-11", "Boca Juniors (Bs. Aires)", 2, 2, false],
      ["Final", "2018-12-09", "River Plate (Bs. Aires)", 3, 1, true],
    ]);
  });

  it("gives an awarded leg the score that completes the aggregate, and an abandoned leg none", () => {
    const text = inline(
      [
        "Group Phase",
        "Second Round",
        "(Aug 21 & 28)",
        "Independiente (Avellaneda)Arg  Santos                    Bra   awd  abd  3-0x",
        "x 1st leg finished 0-0 but was awarded 3-0 due to ineligible player Santos (Carlos Sánchez);",
        "  2nd leg abandoned at 0-0 in 81' due to crowd trouble; no official ruling appears to have",
        "  been published by Conmebol prior to the quarterfinals but Independiente progressed",
        "",
      ].join("\n"),
    );
    const [first, second] = parse(text, W2018).matches;
    expect(first).toMatchObject({
      home: "Independiente (Avellaneda)",
      homeGoals: 3,
      awayGoals: 0,
      awarded: true,
    });
    expect(second).toMatchObject({
      home: "Santos",
      homeGoals: null,
      awayGoals: null,
      abandoned: "abandoned",
    });
  });

  it("completes an awarded first leg with what the second leg left", () => {
    const text = inline(
      [
        "First Round",
        "(Feb 13 and Mar 6)",
        "San Lorenzo de Almagro    Arg  Deportes Temuco           Chi   awd  0-1  3-1x",
        "",
      ].join("\n"),
    );
    const [first, second] = parse(text, W2018).matches;
    expect([first.homeGoals, first.awayGoals, first.awarded]).toEqual([3, 0, true]);
    expect([second.home, second.homeGoals, second.awayGoals]).toEqual(["Deportes Temuco", 1, 0]);
  });

  it("reads a one-match tie under a date header with its city, with penalties", () => {
    const text = inline(
      [
        "First Round",
        "(Mar 7, Asunción)",
        "Tacuary FC                Par  Club General Caballero    Par   2-2  4-2p",
        "",
      ].join("\n"),
    );
    expect(parse(text, { from: "2023-01-01", to: "2023-12-31" }).matches).toMatchObject([
      {
        date: "2023-03-07",
        homeGoals: 2,
        awayGoals: 2,
        penalties: { home: 4, away: 2 },
        stage: "Primera fase",
      },
    ]);
  });

  it("reads a final in one match that went to extra time", () => {
    const text = inline(
      [
        "Final (Nov 4, Rio de Janeiro)",
        "Boca Juniors              Arg  Fluminense FC             Bra   1-2  aet",
        "",
      ].join("\n"),
    );
    expect(parse(text, { from: "2023-01-01", to: "2023-12-31" }).matches).toMatchObject([
      { date: "2023-11-04", homeGoals: 1, awayGoals: 2, extraTime: true },
    ]);
  });

  it("reads the date headers that are cut or carry a stray character or a year", () => {
    const text = inline(
      [
        "Second Round",
        "(Aug  1 & 8",
        "Argentinos Jrs            Arg  Fluminense FC             Bra   1-1  0-2  1-3",
        "(Sep 28 & Oct 5<)",
        "Boca Juniors              Arg  SE Palmeiras              Bra   0-0  1-1  1-1  4-2p",
        "",
      ].join("\n"),
    );
    const matches = parse(text, { from: "2023-01-01", to: "2023-12-31" }).matches;
    expect(matches.map((m) => m.date)).toEqual([
      "2023-08-01",
      "2023-08-08",
      "2023-09-28",
      "2023-10-05",
    ]);
    const covid = parse(
      inline("Final\n(Jan 6 and 13, 2021)\nA FC  Arg  B FC  Bra   1-0  1-1  2-1\n"),
      { from: "2020-02-01", to: "2021-01-31" },
    );
    expect(covid.matches.map((m) => m.date)).toEqual(["2021-01-06", "2021-01-13"]);
  });

  it("reads the marks after a score (0-0y), en dashes and the group lines with a tight hyphen", () => {
    const text = inline(
      [
        "Group Phase",
        "Group B",
        "May 12: Universitario-  Defensa y Justicia    1-1",
        "May 20: Olimpia- Internacional                0-1y",
        "May 21: Palmeiras-Independiente del Valle     5–0",
        "Semifinals",
        "(Sep 27 & Oct 4)",
        "LDU (Quito)              Ecu  Defensa y Justicia         Arg    3–0 0-0y 3-0x",
        "",
      ].join("\n"),
    );
    const matches = parse(text, { from: "2021-01-01", to: "2021-12-31" }).matches;
    expect(matches.map((m) => [m.home, m.away, m.homeGoals, m.awayGoals])).toEqual([
      ["Universitario", "Defensa y Justicia", 1, 1],
      ["Olimpia", "Internacional", 0, 1],
      ["Palmeiras", "Independiente del Valle", 5, 0],
      ["LDU (Quito)", "Defensa y Justicia", 3, 0],
      ["Defensa y Justicia", "LDU (Quito)", 0, 0],
    ]);
  });

  it("keeps a tie it cannot read, so that only an app club makes it a problem", () => {
    const text = inline(
      [
        "Qualifying Round 2 (Feb 6 & 13)",
        "Royal Pari (Santa Cruz)   Bol  Guaraní (Asunción)       Par   1-4  1-1  1-5",
        "Libertad (Asunción)       Par  Atl. Nacional (Medellín)  Col   1-0  0-1  1-1",
        "",
      ].join("\n"),
    );
    const matches = parse(text).matches;
    expect(matches.map((m) => m.unreadable ?? null)).toEqual([
      "the legs 1-4 and 1-1 do not add up to 1-5",
      null,
      null,
    ]);
    expect(matches[0]).toMatchObject({
      home: "Royal Pari (Santa Cruz)",
      away: "Guaraní (Asunción)",
      homeGoals: null,
    });
  });

  it("keeps a tie that has no date header as unreadable", () => {
    const text = inline("Quarterfinals\nA FC  Arg  B FC  Bra   1-0  1-1  2-1\n");
    expect(parse(text).matches[0].unreadable).toBe("a tie before any date header");
  });

  it("stops on a line it does not know, unless a reviewed list skips it", () => {
    const text = inline("Group Phase\nA single match to determine which team advances.\n");
    expect(() => parse(text)).toThrow(/cup\.txt:2: unrecognized line "A single match/);
    expect(
      parse(text, W2019, ["A single match to determine which team advances."]).matches,
    ).toEqual([]);
  });

  it("stops on a date that is not in the window and on a year that disagrees with it", () => {
    expect(() =>
      parse(inline("Final\n(Mar 3 & 9)\n"), { from: "2019-06-01", to: "2019-12-31" }),
    ).toThrow(/outside the window/);
    expect(() =>
      parse(inline("Final\n(Jan 6 and 13, 2020)\n"), { from: "2020-02-01", to: "2021-01-31" }),
    ).toThrow(/does not agree with the window/);
  });
});
