import { describe, expect, it } from "vitest";
import { makeMatch, validDataset } from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { sliceClubData, statsDataFromClubData } from "@/domain/club-data";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import type { Match } from "@/data-model/types";
import type { ClubOption } from "@/lib/club-options";
import { NEVER_MET_INCLUDED } from "@/lib/rivalry-copy";
import { buildRivalryView, type RivalryViewInput } from "@/lib/rivalry-view";

const NOW = new Date("2026-10-17T12:00:00Z");
const crest = {
  initials: "A",
  initialsInk: "#ffffff",
  pattern: "solid" as const,
  primary: "#112233",
  secondary: "#ffffff",
};
const option = (id: string, shortName: string): ClubOption => ({
  id,
  name: `Club ${shortName}`,
  shortName,
  searchKeys: [],
  crest,
});
const catalog = new Map([
  ["club-a", option("club-a", "Ana")],
  ["club-b", option("club-b", "Beto")],
]);

function inputFor(
  matches: readonly Match[] | null,
  extra: Partial<RivalryViewInput> = {},
): RivalryViewInput {
  const ds = matches === null ? statsWorld() : validDataset();
  if (matches !== null) ds["matches.json"] = [...matches];
  const data = statsDataFrom(ds);
  const full = buildStatsIndex(data);
  const merged = buildStatsIndex(
    statsDataFromClubData(sliceClubData(data, "club-a"), sliceClubData(data, "club-b")),
  );
  return {
    index: matches === null ? merged : full,
    clubId: "club-a",
    rivalId: "club-b",
    startDate: "2000-01-01",
    startMode: "birth",
    now: NOW,
    catalog,
    competitionNames: new Map(data.competitions.map((c) => [c.id, c.name])),
    seasonNames: new Map(data.seasons.map((s) => [s.id, s.name])),
    ...extra,
  };
}

const game = (
  id: string,
  date: string,
  home: string,
  away: string,
  hg: number,
  ag: number,
  extra: Partial<Match> = {},
) => makeMatch(id, "league-x-2020", date, home, away, hg, ag, extra);

describe("buildRivalryView on the synthetic world", () => {
  const view = buildRivalryView(inputFor(null));

  it("titles, counts and the period, with only a month and a year", () => {
    expect(view.title).toBe("Ana vs. Beto");
    expect(view.record).toMatchObject({ played: 9, won: 6, drawn: 1, lost: 2 });
    expect(view.matchesLine).toBe("9 partidos");
    expect(view.since).toBe("enero de 2000");
    expect(view.subline).toBe("Desde enero de 2000 · 9 partidos");
    expect(view.neverMet).toBe(false);
  });

  it("gives the balance with its sign and bar shares that sum to one", () => {
    expect(view.record.balance).toBe("+4");
    const { won, drawn, lost } = view.record.bar;
    expect(won + drawn + lost).toBeCloseTo(1);
    expect(view.record.administrative).toBe(1);
    expect(view.record.shootouts).toBe(1);
  });

  it("shows the last match, with the administrative mark", () => {
    expect(view.lastMatch).toMatchObject({
      date: "1 de agosto de 2024",
      result: "Ganaste",
      outcome: "W",
      note: "Resultado administrativo",
    });
    expect(view.lastMatch?.home).toMatchObject({ name: "Beto", goals: 0, isFan: false });
    expect(view.lastMatch?.away).toMatchObject({ name: "Ana", goals: 5, isFan: true });
    expect(view.lastMatch?.spoken).toBe("Beto 0, Ana 5");
  });

  it("never lets an administrative win be the biggest win", () => {
    expect(view.biggestWin).toMatchObject({ date: "1 de abril de 2024", note: null });
    expect(view.biggestWin?.home).toMatchObject({ name: "Ana", goals: 4, isFan: true });
    expect(view.biggestLoss).toMatchObject({ date: "1 de abril de 2023", result: "Perdiste" });
  });

  it("gives the streak and the best run", () => {
    expect(view.streak.headline).toBe("Venís de 2 triunfos seguidos.");
    expect(view.streak.best).toMatch(/^Tu mejor racha: 3 triunfos seguidos, de marzo de 2020 a/);
  });

  it("lists the final series, with the shoot-out on the second", () => {
    expect(view.finals).toHaveLength(2);
    expect(view.finals[0].winner).toBe("Ganaste la final");
    expect(view.finals[1].legs[1].note).toBe("Ganaste 4 a 3 por penales");
    expect(view.finals[0].legs.every((leg) => !leg.beforePeriod)).toBe(true);
  });

  it("builds the stakes, the included line and the coverage", () => {
    expect(view.stakes.length).toBeGreaterThan(0);
    expect(view.included.startsWith("Contamos: ")).toBe(true);
    expect(view.competitionIds.length).toBeGreaterThan(0);
    expect(view.coverage.heading === "" || view.coverage.show).toBe(true);
  });

  it("falls back to ids for names missing from the catalog and the maps", () => {
    const bare = buildRivalryView({
      ...inputFor(null),
      catalog: new Map(),
      competitionNames: new Map(),
      seasonNames: new Map(),
    });
    expect(bare.title).toBe("club-a vs. club-b");
    expect(bare.lastMatch?.competition).toContain("league-x");
    expect(bare.finals[0].season).toMatch(/^cup-y-/);
  });

  it("marks a leg before the period start, and only that one", () => {
    const late = buildRivalryView({ ...inputFor(null), startDate: "2021-11-05" });
    const legs = late.finals[0].legs;
    expect(legs.map((leg) => leg.beforePeriod)).toEqual([true, false]);
    const whole = buildRivalryView({ ...inputFor(null), startDate: "2021-11-01" });
    expect(whole.finals[0].legs.map((leg) => leg.beforePeriod)).toEqual([false, false]);
  });
});

describe("buildRivalryView on small worlds", () => {
  it("a single match uses the singular everywhere", () => {
    const view = buildRivalryView(
      inputFor([game("g1", "2020-03-01", "club-a", "club-b", 1, 0)], { startDate: "2020-01-01" }),
    );
    expect(view.matchesLine).toBe("1 partido");
    expect(view.record.bar).toEqual({ won: 1, drawn: 0, lost: 0 });
    expect(view.streak.headline).toBe("Ganaste el último.");
    expect(view.streak.best).toBe("Tu mejor racha: 1 triunfo. Todavía no le ganaste dos seguidos.");
    expect(view.biggestLoss).toBeNull();
    expect(view.noBiggestLoss).toBe("Nunca te ganaron en tu período. Que siga así.");
    expect(view.finals).toEqual([]);
    expect(view.noFinals).toMatch(/^No se cruzaron en ninguna final/);
  });

  it("a pair with no wins asks for the first one and has no biggest win", () => {
    const view = buildRivalryView(
      inputFor([game("g1", "2020-03-01", "club-b", "club-a", 1, 0)], {
        startDate: "2020-01-01",
        startMode: "other",
      }),
    );
    expect(view.biggestWin).toBeNull();
    expect(view.noBiggestWin).toMatch(/^Todavía no le ganaste en tu período/);
    expect(view.stakes.join(" ")).toContain("Todavía no le ganaste desde que sos hincha.");
    expect(view.streak.best).toBe("Todavía no le ganaste en tu período.");
    expect(view.lastMatch?.home).toMatchObject({ name: "Beto", isFan: false });
  });

  it("a pair that never met has no numbers, no stakes and its own included line", () => {
    const view = buildRivalryView(
      inputFor([game("g1", "2020-03-01", "club-a", "club-c", 1, 0)], { startDate: "2020-01-01" }),
    );
    expect(view.neverMet).toBe(true);
    expect(view.record.bar).toEqual({ won: 0, drawn: 0, lost: 0 });
    expect(view.record.balance).toBe("0");
    expect(view.stakes).toEqual([]);
    expect(view.lastMatch).toBeNull();
    expect(view.streak.headline).toBeNull();
    expect(view.included).toBe(NEVER_MET_INCLUDED);
  });

  it("a start in the future has an empty period: no notice and no stakes", () => {
    const view = buildRivalryView(inputFor(null, { startDate: "2030-01-01" }));
    expect(view.neverMet).toBe(true);
    expect(view.coverage.show).toBe(false);
    expect(view.stakes).toEqual([]);
    expect(view.included).toBe("Todavía no hay partidos cargados para este período.");
  });

  it("writes a negative balance with its minus sign", () => {
    const view = buildRivalryView(
      inputFor(
        [
          game("g1", "2020-03-01", "club-b", "club-a", 1, 0),
          game("g2", "2020-03-08", "club-b", "club-a", 2, 0),
        ],
        { startDate: "2020-01-01" },
      ),
    );
    expect(view.record.balance).toBe("-2");
  });
});

describe("privacy", () => {
  it("never contains the start date, in any spelling, for 50 random dates", () => {
    const base = inputFor(null);
    for (let i = 0; i < 50; i++) {
      const year = 1950 + ((i * 7) % 70);
      const month = String(1 + ((i * 5) % 12)).padStart(2, "0");
      const day = String(2 + ((i * 3) % 25)).padStart(2, "0");
      const startDate = `${year}-${month}-${day}`;
      const text = JSON.stringify(buildRivalryView({ ...base, startDate }));
      expect(text).not.toContain(startDate);
      expect(text).not.toContain(`${day}/${month}/${year}`);
      expect(text).not.toContain(`${year}${month}${day}`);
      expect(text).not.toContain(`${Number(day)} de`.concat(" ", monthName(month), ` de ${year}`));
    }
  });
});

function monthName(month: string): string {
  return [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ][Number(month) - 1];
}
