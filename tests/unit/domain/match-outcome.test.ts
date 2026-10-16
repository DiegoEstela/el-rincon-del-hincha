import { describe, expect, it } from "vitest";
import { clubView as clubViewIn, outcomeFor, tallyClubSeason } from "@/domain/match-outcome";
import type { Match } from "@/data-model/types";

const base: Match = {
  id: "m",
  season_id: "s1",
  date: "2020-03-01",
  home_id: "club-a",
  away_id: "club-b",
  home_goals: 2,
  away_goals: 1,
  decision: null,
  home_penalties: null,
  away_penalties: null,
  stage: "Regular",
  is_final: false,
  status: "played",
  source: "fixture:synthetic",
  verified: false,
};
const m = (over: Partial<Match>): Match => ({ ...base, ...over });

describe("outcomeFor", () => {
  it("gives W/L for a home win", () => {
    expect(outcomeFor(base, "club-a")).toBe("W");
    expect(outcomeFor(base, "club-b")).toBe("L");
  });
  it("gives W/L for an away win", () => {
    const away = m({ home_goals: 0, away_goals: 1 });
    expect(outcomeFor(away, "club-a")).toBe("L");
    expect(outcomeFor(away, "club-b")).toBe("W");
  });
  it("gives D for a draw", () => {
    const draw = m({ home_goals: 1, away_goals: 1 });
    expect(outcomeFor(draw, "club-a")).toBe("D");
    expect(outcomeFor(draw, "club-b")).toBe("D");
  });
  it("counts a penalty shoot-out as a draw for both sides", () => {
    const pens = m({
      home_goals: 1,
      away_goals: 1,
      decision: "penalties",
      home_penalties: 4,
      away_penalties: 3,
    });
    expect(outcomeFor(pens, "club-a")).toBe("D");
    expect(outcomeFor(pens, "club-b")).toBe("D");
  });
  it("counts the extra time result as is", () => {
    expect(outcomeFor(m({ decision: "extra_time" }), "club-a")).toBe("W");
  });
  it("does not count suspended matches", () => {
    const s = m({ status: "suspended", home_goals: null, away_goals: null });
    expect(outcomeFor(s, "club-a")).toBeNull();
  });
  it("counts administrative results", () => {
    expect(outcomeFor(m({ status: "administrative_result" }), "club-a")).toBe("W");
  });
  it("returns null for a club that did not play, or a missing score", () => {
    expect(outcomeFor(base, "club-z")).toBeNull();
    expect(outcomeFor(m({ home_goals: null }), "club-a")).toBeNull();
    expect(outcomeFor(m({ away_goals: null }), "club-a")).toBeNull();
  });
});

describe("tallyClubSeason", () => {
  const matches = [
    m({ id: "1" }),
    m({ id: "2", home_id: "club-b", away_id: "club-a", home_goals: 1, away_goals: 1 }),
    m({ id: "3", home_goals: 0, away_goals: 3 }),
    m({ id: "4", status: "suspended", home_goals: null, away_goals: null }),
    m({ id: "5", season_id: "other" }),
    m({ id: "6", home_id: "club-c", away_id: "club-d" }),
  ];
  it("tallies P/W/D/L of a club in a season, ignoring other seasons and clubs", () => {
    expect(tallyClubSeason(matches, "club-a", "s1")).toEqual({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
    });
  });
  it("returns zeros when the club has no counted matches", () => {
    expect(tallyClubSeason(matches, "club-z", "s1")).toEqual({
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
    });
  });
});

const clubView = (match: Match, clubId: string) => clubViewIn(match, clubId, "league-x");

describe("clubView", () => {
  it("sees a home match from the home side", () => {
    expect(clubView(base, "club-a")).toEqual({
      match: base,
      competitionId: "league-x",
      rivalId: "club-b",
      outcome: "W",
      goalsFor: 2,
      goalsAgainst: 1,
      shootout: null,
      isAdministrative: false,
    });
  });
  it("swaps goals and rival for the away side", () => {
    const view = clubView(base, "club-b");
    expect(view).toMatchObject({ rivalId: "club-a", outcome: "L", goalsFor: 1, goalsAgainst: 2 });
  });
  it("records the shoot-out as won or lost from each side, still a draw", () => {
    const pens = m({
      home_goals: 1,
      away_goals: 1,
      decision: "penalties",
      home_penalties: 4,
      away_penalties: 3,
    });
    expect(clubView(pens, "club-a")).toMatchObject({ outcome: "D", shootout: "won" });
    expect(clubView(pens, "club-b")).toMatchObject({ outcome: "D", shootout: "lost" });
  });
  it("keeps the shoot-out null when the penalty counts are missing", () => {
    const pens = m({ home_goals: 1, away_goals: 1, decision: "penalties" });
    expect(clubView(pens, "club-a")).toMatchObject({ outcome: "D", shootout: null });
  });
  it("never counts shoot-out goals in the score", () => {
    const pens = m({
      home_goals: 1,
      away_goals: 1,
      decision: "penalties",
      home_penalties: 4,
      away_penalties: 3,
    });
    expect(clubView(pens, "club-a")).toMatchObject({ goalsFor: 1, goalsAgainst: 1 });
  });
  it("flags administrative results", () => {
    expect(clubView(m({ status: "administrative_result" }), "club-a")?.isAdministrative).toBe(true);
    expect(clubView(base, "club-a")?.isAdministrative).toBe(false);
  });
  it("returns null for suspended matches, a club not in the match, or a missing score", () => {
    expect(
      clubView(m({ status: "suspended", home_goals: null, away_goals: null }), "club-a"),
    ).toBeNull();
    expect(clubView(base, "club-z")).toBeNull();
    expect(clubView(m({ away_goals: null }), "club-a")).toBeNull();
  });
});
