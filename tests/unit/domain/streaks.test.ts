import { describe, expect, it } from "vitest";
import { makeMatch } from "../../fixtures/data-model/dataset";
import { clubView } from "@/domain/match-outcome";
import { computeStreaks } from "@/domain/streaks";
import type { Match } from "@/data-model/types";
import type { MatchView } from "@/domain/types";

let seq = 0;
/** A match of club-a on `date`; `result` is "W", "D", "L" or "P" (draw decided on penalties, won). */
function v(date: string, result: "W" | "D" | "L" | "P"): MatchView {
  seq += 1;
  const extra: Partial<Match> =
    result === "P" ? { decision: "penalties", home_penalties: 4, away_penalties: 3 } : {};
  const goals = { W: [1, 0], D: [1, 1], L: [0, 1], P: [1, 1] }[result];
  const match = makeMatch(
    `s${seq}`,
    "league-x-2020",
    date,
    "club-a",
    "club-b",
    goals[0],
    goals[1],
    extra,
  );
  const view = clubView(match, "club-a", "league-x");
  if (view === null) throw new Error("does not count");
  return view;
}

describe("streaks", () => {
  it("is empty without matches", () => {
    expect(computeStreaks([])).toEqual({ current: null, bestWin: null });
  });
  it("handles a single match", () => {
    const streaks = computeStreaks([v("2020-01-01", "W")]);
    expect(streaks.current).toEqual({
      outcome: "W",
      length: 1,
      from: "2020-01-01",
      to: "2020-01-01",
    });
    expect(streaks.bestWin).toEqual(streaks.current);
  });
  it("gives the current streak of wins with its first and last date", () => {
    const { current } = computeStreaks([
      v("2020-01-01", "L"),
      v("2020-01-08", "W"),
      v("2020-01-15", "W"),
      v("2020-01-22", "W"),
    ]);
    expect(current).toEqual({ outcome: "W", length: 3, from: "2020-01-08", to: "2020-01-22" });
  });
  it("gives the current streak of draws", () => {
    const { current } = computeStreaks([
      v("2020-01-01", "W"),
      v("2020-01-08", "D"),
      v("2020-01-15", "D"),
    ]);
    expect(current).toEqual({ outcome: "D", length: 2, from: "2020-01-08", to: "2020-01-15" });
  });
  it("gives the current streak of losses", () => {
    const { current } = computeStreaks([
      v("2020-01-01", "W"),
      v("2020-01-08", "L"),
      v("2020-01-15", "L"),
    ]);
    expect(current).toEqual({ outcome: "L", length: 2, from: "2020-01-08", to: "2020-01-15" });
  });
  it("breaks a win streak with a shoot-out, which is a draw", () => {
    const { current, bestWin } = computeStreaks([
      v("2020-01-01", "W"),
      v("2020-01-08", "W"),
      v("2020-01-15", "P"),
      v("2020-01-22", "W"),
    ]);
    expect(bestWin).toMatchObject({ length: 2, from: "2020-01-01", to: "2020-01-08" });
    expect(current).toMatchObject({ outcome: "W", length: 1 });
  });
  it("finds the best win streak in the middle of the history", () => {
    const { current, bestWin } = computeStreaks([
      v("2020-01-01", "W"),
      v("2020-01-08", "L"),
      v("2020-01-15", "W"),
      v("2020-01-22", "W"),
      v("2020-01-29", "W"),
      v("2020-02-05", "D"),
    ]);
    expect(bestWin).toEqual({ outcome: "W", length: 3, from: "2020-01-15", to: "2020-01-29" });
    expect(current).toMatchObject({ outcome: "D", length: 1 });
  });
  it("keeps the earliest run when two win streaks have the same length", () => {
    const { bestWin } = computeStreaks([
      v("2020-01-01", "W"),
      v("2020-01-08", "W"),
      v("2020-01-15", "L"),
      v("2020-01-22", "W"),
      v("2020-01-29", "W"),
    ]);
    expect(bestWin).toMatchObject({ length: 2, from: "2020-01-01" });
  });
  it("replaces the best streak only with a strictly longer one", () => {
    const { bestWin } = computeStreaks([
      v("2020-01-01", "W"),
      v("2020-01-08", "L"),
      v("2020-01-15", "W"),
      v("2020-01-22", "W"),
    ]);
    expect(bestWin).toMatchObject({ length: 2, from: "2020-01-15" });
  });
  it("has no best win streak without wins", () => {
    const { current, bestWin } = computeStreaks([v("2020-01-01", "L"), v("2020-01-08", "D")]);
    expect(bestWin).toBeNull();
    expect(current).toMatchObject({ outcome: "D" });
  });
  it("can have the current and the best streak be the same run", () => {
    const { current, bestWin } = computeStreaks([
      v("2020-01-01", "L"),
      v("2020-01-08", "W"),
      v("2020-01-15", "W"),
    ]);
    expect(bestWin).toEqual(current);
  });
});
