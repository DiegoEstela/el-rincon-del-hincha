import { describe, expect, it } from "vitest";
import { WIN_MILESTONE_STEP, whatIsAtStake } from "@/domain/at-stake";
import { Dominance } from "@/domain/dominance";

const stake = (balance: number, won = 0) => whatIsAtStake({ balance, won });

describe("what is at stake: wins and losses to change the dominance class", () => {
  it.each([
    [-3, 2],
    [-2, 1],
  ])("a balance of %i needs %i wins to be even", (balance, wins) => {
    expect(stake(balance)).toMatchObject({
      winsToImprove: wins,
      improvesTo: Dominance.Even,
      lossesToWorsen: null,
      worsensTo: null,
    });
  });
  it.each([
    [-1, 3],
    [0, 2],
    [1, 1],
  ])("an even balance of %i needs %i wins to dominate", (balance, wins) => {
    expect(stake(balance)).toMatchObject({ winsToImprove: wins, improvesTo: Dominance.Dominates });
  });
  it.each([
    [-1, 1],
    [0, 2],
    [1, 3],
  ])("an even balance of %i needs %i losses to be dominated", (balance, losses) => {
    expect(stake(balance)).toMatchObject({
      lossesToWorsen: losses,
      worsensTo: Dominance.Dominated,
    });
  });
  it("has nothing to improve when already dominating, and one loss from even at +2", () => {
    expect(stake(2)).toMatchObject({
      winsToImprove: null,
      improvesTo: null,
      lossesToWorsen: 1,
      worsensTo: Dominance.Even,
    });
    expect(stake(4)).toMatchObject({ winsToImprove: null, lossesToWorsen: 3 });
  });
  it("has nothing to worsen when already dominated", () => {
    expect(stake(-2).lossesToWorsen).toBeNull();
    expect(stake(-5).lossesToWorsen).toBeNull();
  });
  it("uses custom thresholds", () => {
    const custom = { dominatesFrom: 3, dominatedUpTo: -3 };
    expect(whatIsAtStake({ balance: 0, won: 0 }, custom)).toMatchObject({
      winsToImprove: 3,
      lossesToWorsen: 3,
    });
  });
});

describe("what is at stake: next win milestone (step 10)", () => {
  it("pins the default step", () => {
    expect(WIN_MILESTONE_STEP).toBe(10);
  });
  it.each([
    [0, 10, 10],
    [1, 10, 9],
    [29, 30, 1],
    [30, 40, 10],
  ])("with %i wins the next milestone is %i, %i wins away", (won, milestone, winsNeeded) => {
    expect(stake(0, won).nextWinMilestone).toEqual({ milestone, winsNeeded });
  });
  it("uses a custom step", () => {
    expect(whatIsAtStake({ balance: 0, won: 12 }, undefined, 25).nextWinMilestone).toEqual({
      milestone: 25,
      winsNeeded: 13,
    });
  });
  it("rejects a step that is not a positive integer", () => {
    expect(() => whatIsAtStake({ balance: 0, won: 1 }, undefined, 0)).toThrow(RangeError);
    expect(() => whatIsAtStake({ balance: 0, won: 1 }, undefined, 2.5)).toThrow(RangeError);
  });
});
