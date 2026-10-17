import { describe, expect, it } from "vitest";
import { FIXED_NOW, makeMatch, validDataset } from "../../fixtures/data-model/dataset";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { fanPeriod } from "@/domain/period";
import { groupRivals } from "@/domain/rivals";
import type { Match } from "@/data-model/types";

const index = (matches?: Match[]) => {
  const ds = validDataset();
  if (matches) ds["matches.json"] = matches;
  return buildStatsIndex(statsDataFrom(ds));
};
const period = fanPeriod("2020-01-01", FIXED_NOW);

describe("groupRivals: competitionIds", () => {
  it("lists, sorted, the competitions with counted matches in the period", () => {
    expect(groupRivals(index(), "club-a", period).competitionIds).toEqual(["cup-y", "league-x"]);
  });

  it("follows the tournament type filter", () => {
    expect(
      groupRivals(index(), "club-a", period, { competitionTypes: ["league"] }).competitionIds,
    ).toEqual(["league-x"]);
    expect(
      groupRivals(index(), "club-a", period, { competitionTypes: ["national_cup"] }).competitionIds,
    ).toEqual(["cup-y"]);
  });

  it("does not list a competition whose only matches in the period are suspended", () => {
    const matches = [
      makeMatch("s1", "league-x-2020", "2020-03-22", "club-b", "club-c", null, null, {
        status: "suspended",
      }),
      makeMatch("c1", "cup-y-2020", "2020-05-01", "club-b", "club-d", 2, 1),
    ];
    expect(groupRivals(index(matches), "club-b", period).competitionIds).toEqual(["cup-y"]);
  });

  it("is empty for an empty period", () => {
    const future = fanPeriod("2999-01-01", FIXED_NOW);
    expect(groupRivals(index(), "club-a", future).competitionIds).toEqual([]);
  });

  it("is empty when the club has no counted match in the filter", () => {
    expect(
      groupRivals(index(), "club-a", period, { competitionTypes: ["international"] })
        .competitionIds,
    ).toEqual([]);
  });
});
