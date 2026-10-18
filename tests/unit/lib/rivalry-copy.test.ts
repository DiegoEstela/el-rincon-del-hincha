import { describe, expect, it } from "vitest";
import { makeMatch } from "../../fixtures/data-model/dataset";
import { clubView } from "@/domain/match-outcome";
import type { AtStake } from "@/domain/at-stake";
import type { MatchView } from "@/domain/types";
import type { Match } from "@/data-model/types";
import {
  STAKE_NEAR,
  bestStreakLine,
  competitionLabel,
  finalLine,
  formatMatchDate,
  matchesCount,
  penaltiesNote,
  resultLabel,
  stakeLines,
  streakHeadline,
} from "@/lib/rivalry-copy";

describe("formatMatchDate", () => {
  it("writes the day without a leading zero and the month in Spanish", () => {
    expect(formatMatchDate("2025-04-27")).toBe("27 de abril de 2025");
    expect(formatMatchDate("2021-01-01")).toBe("1 de enero de 2021");
    expect(formatMatchDate("2018-09-23")).toBe("23 de septiembre de 2018");
  });
});

describe("resultLabel and matchesCount", () => {
  it("names the three results", () => {
    expect([resultLabel("W"), resultLabel("D"), resultLabel("L")]).toEqual([
      "Ganaste",
      "Empataste",
      "Perdiste",
    ]);
  });
  it("uses the singular for one match", () => {
    expect(matchesCount(1)).toBe("1 partido");
    expect(matchesCount(8)).toBe("8 partidos");
  });
});

function view(extra: Partial<Match>, fanHome = true): MatchView {
  const [home, away] = fanHome ? ["club-a", "club-b"] : ["club-b", "club-a"];
  const match = makeMatch("m1", "league-x-2020", "2020-01-01", home, away, 1, 1, extra);
  const result = clubView(match, "club-a", "league-x");
  if (result === null) throw new Error("does not count");
  return result;
}

describe("penaltiesNote", () => {
  it("is null without a shoot-out", () => {
    expect(penaltiesNote(view({}))).toBeNull();
  });
  it("puts the fan first when the fan is home or away, in a won shoot-out", () => {
    const home = { decision: "penalties" as const, home_penalties: 5, away_penalties: 3 };
    expect(penaltiesNote(view(home, true))).toBe("Ganaste 5 a 3 por penales");
    const away = { decision: "penalties" as const, home_penalties: 3, away_penalties: 5 };
    expect(penaltiesNote(view(away, false))).toBe("Ganaste 5 a 3 por penales");
  });
  it("says perdiste for a lost shoot-out", () => {
    const lost = { decision: "penalties" as const, home_penalties: 3, away_penalties: 4 };
    expect(penaltiesNote(view(lost, true))).toBe("Perdiste 3 a 4 por penales");
  });
  it("counts a missing penalty score as zero", () => {
    // The engine only sets a shoot-out when both scores exist; the note still never prints null.
    const base = view({ decision: "penalties", home_penalties: 1, away_penalties: 0 });
    const noAway = { ...base, match: { ...base.match, away_penalties: null } };
    expect(penaltiesNote(noAway)).toBe("Ganaste 1 a 0 por penales");
    const noHome = { ...base, match: { ...base.match, home_penalties: null } };
    expect(penaltiesNote(noHome)).toBe("Ganaste 0 a 0 por penales");
  });
});

describe("competitionLabel", () => {
  it("joins competition and season, and does not repeat a name", () => {
    expect(competitionLabel("Primera División", "Liga Profesional 2025")).toBe(
      "Primera División · Liga Profesional 2025",
    );
    expect(competitionLabel("Copa X", "Copa X")).toBe("Copa X");
  });
});

const at = (extra: Partial<AtStake>): AtStake => ({
  winsToImprove: null,
  improvesTo: null,
  lossesToWorsen: null,
  worsensTo: null,
  nextWinMilestone: { milestone: 10, winsNeeded: 10 },
  ...extra,
});
const stakes = (
  atStake: AtStake,
  extra: Partial<Parameters<typeof stakeLines>[0]> = {},
): string[] =>
  stakeLines({ played: 5, won: 2, atStake, rivalShortName: "Boca", startMode: "birth", ...extra });

describe("stakeLines", () => {
  it("has a boundary at STAKE_NEAR", () => {
    expect(STAKE_NEAR).toBe(3);
  });
  it("says nothing for a pair that never met", () => {
    expect(stakes(at({ winsToImprove: 2, improvesTo: "dominates" }), { played: 0 })).toEqual([]);
  });
  it("tells how many wins make the fan dominate, singular and plural", () => {
    const one = stakes(at({ winsToImprove: 1, improvesTo: "dominates" }));
    expect(one[0]).toBe("Con 1 triunfo más pasás a dominar este historial.");
    const two = stakes(at({ winsToImprove: 2, improvesTo: "dominates" }));
    expect(two[0]).toBe("Con 2 triunfos más pasás a dominar este historial.");
  });
  it("tells how many wins even a dominated record", () => {
    const lines = stakes(at({ winsToImprove: 2, improvesTo: "even" }));
    expect(lines[0]).toBe("Con 2 triunfos más emparejás este historial.");
  });
  it("gives the cushion line for a dominating record, singular and plural", () => {
    expect(stakes(at({ lossesToWorsen: 1, worsensTo: "even" }))[0]).toBe(
      "Tenés colchón: haría falta 1 derrota más para que esto vuelva a estar parejo.",
    );
    expect(stakes(at({ lossesToWorsen: 3, worsensTo: "even" }))[0]).toBe(
      "Tenés colchón: harían falta 3 derrotas más para que esto vuelva a estar parejo.",
    );
  });
  it("has no dominance line when nothing changes", () => {
    expect(stakes(at({}))).toEqual([]);
  });
  it("warns only when even and 3 or fewer losses away", () => {
    const even = (losses: number) =>
      at({ winsToImprove: 3, improvesTo: "dominates", lossesToWorsen: losses });
    expect(stakes(even(1))[1]).toBe("Ojo: con 1 derrota más te pasan a dominar.");
    expect(stakes(even(2))[1]).toBe("Ojo: con 2 derrotas más te pasan a dominar.");
    expect(stakes(even(3))[1]).toBe("Ojo: con 3 derrotas más te pasan a dominar.");
    expect(stakes(even(4))).toHaveLength(1);
  });
  it("shows the milestone at 1, 2 and 3 wins and hides it at 4", () => {
    const m = (winsNeeded: number) => at({ nextWinMilestone: { milestone: 30, winsNeeded } });
    expect(stakes(m(1))).toEqual(["Estás a 1 victoria de las 30 contra Boca desde que naciste."]);
    expect(stakes(m(2))).toEqual(["Estás a 2 victorias de las 30 contra Boca desde que naciste."]);
    expect(stakes(m(3))).toHaveLength(1);
    expect(stakes(m(4))).toEqual([]);
  });
  it("changes the ending for a start that is not the birth date", () => {
    const line = stakes(at({ nextWinMilestone: { milestone: 10, winsNeeded: 1 } }), {
      startMode: "other",
    });
    expect(line).toEqual(["Estás a 1 victoria de las 10 contra Boca desde que sos hincha."]);
  });
  it("replaces the milestone with the first win line when there are no wins", () => {
    const base = at({ nextWinMilestone: { milestone: 10, winsNeeded: 1 } });
    expect(stakes(base, { won: 0 })).toEqual([
      "Todavía no le ganaste desde que naciste. El primero se va a gritar el doble.",
    ]);
    expect(stakes(base, { won: 0, startMode: "other" })).toEqual([
      "Todavía no le ganaste desde que sos hincha. El primero se va a gritar el doble.",
    ]);
  });
  it("gives at most three lines and no dates", () => {
    const lines = stakes(
      at({
        winsToImprove: 3,
        improvesTo: "dominates",
        lossesToWorsen: 1,
        nextWinMilestone: { milestone: 10, winsNeeded: 2 },
      }),
    );
    expect(lines).toHaveLength(3);
    expect(lines.join(" ")).not.toMatch(/\d{4}/);
  });
});

const streak = (outcome: "W" | "D" | "L", length: number) => ({
  outcome,
  length,
  from: "2023-05-07",
  to: "2025-04-27",
});
const run = (length: number) => ({ length, from: "2023-05-07", to: "2025-04-27" });

describe("streakHeadline", () => {
  it("is null without matches", () => {
    expect(streakHeadline(null, null, null)).toBeNull();
  });
  it("reads a run of one", () => {
    expect(streakHeadline(streak("W", 1), run(1), null)).toBe("Ganaste el último.");
    expect(streakHeadline(streak("D", 1), run(1), run(1))).toBe("Empataste el último.");
    expect(streakHeadline(streak("L", 1), null, run(1))).toBe("Perdiste el último.");
  });
  it("reads a run of three", () => {
    expect(streakHeadline(streak("W", 3), run(3), null)).toBe("Venís de 3 triunfos seguidos.");
    expect(streakHeadline(streak("D", 3), run(3), run(3))).toBe("Venís de 3 empates seguidos.");
    expect(streakHeadline(streak("L", 3), null, run(3))).toBe("Venís de 3 derrotas seguidas.");
  });
  it("prefers a longer unbeaten run", () => {
    expect(streakHeadline(streak("W", 2), run(4), null)).toBe("Venís de 4 sin perder.");
  });
  it("prefers a longer winless run", () => {
    expect(streakHeadline(streak("D", 3), run(3), run(4))).toBe("Venís de 4 partidos sin ganarle.");
  });
  it("prefers unbeaten when both are longer and unbeaten is not shorter", () => {
    expect(streakHeadline(streak("D", 1), run(3), run(3))).toBe("Venís de 3 sin perder.");
  });
  it("falls to the winless run when it is longer than the unbeaten one", () => {
    expect(streakHeadline(streak("D", 1), run(2), run(3))).toBe("Venís de 3 partidos sin ganarle.");
  });
});

describe("bestStreakLine", () => {
  it("covers no win, one win and several wins", () => {
    expect(bestStreakLine(null)).toBe("Todavía no le ganaste en tu período.");
    expect(bestStreakLine(streak("W", 1))).toBe(
      "Tu mejor racha: 1 triunfo. Todavía no le ganaste dos seguidos.",
    );
    expect(bestStreakLine(streak("W", 3))).toBe(
      "Tu mejor racha: 3 triunfos seguidos, de mayo de 2023 a abril de 2025.",
    );
  });
  it("does not repeat a month", () => {
    expect(bestStreakLine({ outcome: "W", length: 2, from: "2023-05-07", to: "2023-05-28" })).toBe(
      "Tu mejor racha: 2 triunfos seguidos, en mayo de 2023.",
    );
  });
});

describe("finalLine", () => {
  it("names the winner", () => {
    expect(finalLine("club")).toBe("Ganaste la final");
    expect(finalLine("rival")).toBe("Perdiste la final");
    expect(finalLine(null)).toBe("Final sin ganador en nuestros datos");
  });
});
