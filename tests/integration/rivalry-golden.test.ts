// Plan 0016, T4: head-to-head values on the real dataset, checked by hand against the match
// records. If the data or the engine changes one of them, this fails and someone looks at why.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FILE_SCHEMAS, type DatasetFile } from "@/data-model/schemas";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { headToHead } from "@/domain/head-to-head";
import { fanPeriod } from "@/domain/period";

const NOW = new Date("2026-10-17T12:00:00Z");

const load = (file: DatasetFile) =>
  FILE_SCHEMAS[file]
    .array()
    .parse(JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8")));

const index = buildStatsIndex(
  statsDataFrom({
    "clubs.json": load("clubs.json"),
    "competitions.json": load("competitions.json"),
    "seasons.json": load("seasons.json"),
    "matches.json": load("matches.json"),
    "coverage.json": load("coverage.json"),
    "titles.json": [],
    "movements.json": [],
    "rivalries.json": [],
    "standings.json": [],
  } as never),
);

const h2h = (club: string, rival: string, start: string) =>
  headToHead(index, club, rival, fanPeriod(start, NOW));

describe("River v Boca from 1990-05-20", () => {
  const h = h2h("river-plate", "boca-juniors", "1990-05-20");

  it("has 9 played, 5-2-2, goals 10 to 7 and dominates", () => {
    expect(h.record).toMatchObject({
      played: 9,
      won: 5,
      drawn: 2,
      lost: 2,
      goalsFor: 10,
      goalsAgainst: 7,
      balance: 3,
    });
    expect(h.dominance).toBe("dominates");
    expect(h.competitionIds).toEqual(["copa-de-la-liga-profesional", "primera-division"]);
    expect(h.coverage.isComplete).toBe(false);
  });

  it("has the last match, the streaks and the biggest results", () => {
    expect(h.lastMatch?.match.id).toBe("2025-10-19-boca-juniors-river-plate");
    expect(h.currentStreak).toEqual({
      outcome: "L",
      length: 1,
      from: "2025-10-19",
      to: "2025-10-19",
    });
    expect(h.bestWinStreak).toEqual({
      outcome: "W",
      length: 3,
      from: "2023-05-07",
      to: "2025-04-27",
    });
    expect(h.currentUnbeaten).toBeNull();
    expect(h.currentWinless).toEqual({ length: 1, from: "2025-10-19", to: "2025-10-19" });
    expect(h.biggestWin?.match.id).toBe("2018-09-23-boca-juniors-river-plate");
    expect(h.biggestLoss?.match.id).toBe("2025-10-19-boca-juniors-river-plate");
    expect(h.finals).toEqual([]);
  });

  it("has what is at stake", () => {
    expect(h.atStake).toEqual({
      winsToImprove: null,
      improvesTo: null,
      lossesToWorsen: 2,
      worsensTo: "even",
      nextWinMilestone: { milestone: 10, winsNeeded: 5 },
    });
  });
});

describe("Boca v Banfield from 1990-05-20", () => {
  const h = h2h("boca-juniors", "banfield", "1990-05-20");

  it("counts the shoot-out of the only final as a draw and a final won", () => {
    expect(h.record).toMatchObject({ played: 9, won: 5, drawn: 2, lost: 2 });
    expect(h.record.shootouts).toEqual({ played: 1, won: 1, lost: 0 });
    expect(h.finals).toHaveLength(1);
    expect(h.finals[0]).toMatchObject({
      seasonId: "copa-de-la-liga-profesional-2020",
      winner: "club",
    });
    expect(h.finals[0].legs[0].match).toMatchObject({
      id: "2021-01-17-boca-juniors-banfield",
      home_penalties: 5,
      away_penalties: 3,
    });
    expect(h.finals[0].legs[0]).toMatchObject({ outcome: "D", shootout: "won" });
  });
});

describe("Belgrano v Talleres from 2000-01-01", () => {
  const h = h2h("belgrano", "talleres-cordoba", "2000-01-01");

  it("has not won in 4 and is one defeat from being dominated", () => {
    expect(h.record).toMatchObject({ played: 5, won: 0, drawn: 4, lost: 1, balance: -1 });
    expect(h.dominance).toBe("even");
    expect(h.currentWinless).toEqual({ length: 5, from: "2018-10-07", to: "2025-10-05" });
    expect(h.currentUnbeaten).toEqual({ length: 4, from: "2023-05-21", to: "2025-10-05" });
    expect(h.atStake).toMatchObject({
      winsToImprove: 3,
      improvesTo: "dominates",
      lossesToWorsen: 1,
      worsensTo: "dominated",
    });
    expect(h.bestWinStreak).toBeNull();
  });
});

describe("pairs with little or no history", () => {
  it("River v San Martín de Tucumán is two wins: the league in 2019 and the Copa Argentina in 2025", () => {
    const h = h2h("river-plate", "san-martin-tucuman", "1990-05-20");
    expect(h.record).toMatchObject({ played: 2, won: 2, drawn: 0, lost: 0 });
    expect(h.atStake.winsToImprove).toBeNull();
  });

  it("Aldosivi v Deportivo Riestra never met in the loaded data and shows an incomplete notice", () => {
    const h = h2h("aldosivi", "deportivo-riestra", "1990-05-20");
    expect(h.record.played).toBe(0);
    expect(h.lastMatch).toBeNull();
    expect(h.currentStreak).toBeNull();
    expect(h.biggestWin).toBeNull();
    expect(h.finals).toEqual([]);
    expect(h.competitionIds).toEqual([]);
    expect(h.coverage.isComplete).toBe(false);
  });
});
