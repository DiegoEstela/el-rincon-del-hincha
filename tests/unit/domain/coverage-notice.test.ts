import { describe, expect, it } from "vitest";
import { FIXED_NOW, makeCoverage, validDataset } from "../../fixtures/data-model/dataset";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { coverageNotice, mergeCompleteIntervals } from "@/domain/coverage-notice";
import { fanPeriod } from "@/domain/period";
import type { Coverage } from "@/data-model/types";

const row = (from: string, to: string | null, complete = true) =>
  makeCoverage("club-a", "league-x", from, to, complete);

describe("mergeCompleteIntervals", () => {
  it("ignores rows that are not complete", () => {
    expect(mergeCompleteIntervals([row("2020-01-01", null, false)])).toEqual([]);
  });
  it("merges overlapping rows", () => {
    const rows = [row("2020-01-01", "2021-06-30"), row("2021-01-01", "2022-12-31")];
    expect(mergeCompleteIntervals(rows)).toEqual([{ from: "2020-01-01", to: "2022-12-31" }]);
  });
  it("keeps the longer end when a row is contained in another", () => {
    const rows = [row("2020-01-01", "2022-12-31"), row("2021-01-01", "2021-12-31")];
    expect(mergeCompleteIntervals(rows)).toEqual([{ from: "2020-01-01", to: "2022-12-31" }]);
  });
  it("merges adjacent rows (to, then the next day)", () => {
    const rows = [row("2020-01-01", "2021-06-30"), row("2021-07-01", null)];
    expect(mergeCompleteIntervals(rows)).toEqual([{ from: "2020-01-01", to: null }]);
  });
  it("keeps a gap of one day apart", () => {
    const rows = [row("2020-01-01", "2021-06-30"), row("2021-07-02", "2022-01-01")];
    expect(mergeCompleteIntervals(rows)).toEqual([
      { from: "2020-01-01", to: "2021-06-30" },
      { from: "2021-07-02", to: "2022-01-01" },
    ]);
  });
  it("lets an ongoing row (to: null) absorb later rows", () => {
    const rows = [row("2020-01-01", null), row("2023-01-01", "2023-12-31")];
    expect(mergeCompleteIntervals(rows)).toEqual([{ from: "2020-01-01", to: null }]);
  });
  it("makes the merge ongoing when a later overlapping row is ongoing", () => {
    const rows = [row("2020-01-01", "2022-12-31"), row("2021-01-01", null)];
    expect(mergeCompleteIntervals(rows)).toEqual([{ from: "2020-01-01", to: null }]);
  });
  it("accepts unsorted input without mutating it", () => {
    const rows = [row("2021-07-01", null), row("2020-01-01", "2021-06-30")];
    const copy = [...rows];
    expect(mergeCompleteIntervals(rows)).toEqual([{ from: "2020-01-01", to: null }]);
    expect(rows).toEqual(copy);
  });
});

function indexWith(coverage: Coverage[]) {
  return buildStatsIndex({ ...statsDataFrom(validDataset()), coverage });
}

describe("coverageNotice (ADR 0003: per competition, partial coverage is shown)", () => {
  const period = fanPeriod("2019-06-01", FIXED_NOW);

  it("is partial with the start of the complete stretch when the start is earlier", () => {
    const index = indexWith([row("2020-01-01", null)]);
    expect(coverageNotice(index, ["club-a"], period, ["league-x"])).toEqual({
      isComplete: false,
      competitions: [
        {
          competitionId: "league-x",
          status: "partial",
          completeFrom: "2020-01-01",
          completeTo: null,
        },
      ],
    });
  });
  it("is complete when the start is exactly the first covered day", () => {
    const notice = coverageNotice(
      indexWith([row("2020-01-01", null)]),
      ["club-a"],
      fanPeriod("2020-01-01", FIXED_NOW),
      ["league-x"],
    );
    expect(notice.isComplete).toBe(true);
    expect(notice.competitions[0]).toMatchObject({
      status: "complete",
      completeFrom: "2020-01-01",
    });
  });
  it("is partial when the period ends after a closed coverage end (the 2025-05-04 case)", () => {
    const notice = coverageNotice(
      indexWith([row("2020-01-01", "2025-05-04")]),
      ["club-a"],
      fanPeriod("2021-01-01", FIXED_NOW),
      ["league-x"],
    );
    expect(notice.competitions[0]).toEqual({
      competitionId: "league-x",
      status: "partial",
      completeFrom: "2020-01-01",
      completeTo: "2025-05-04",
    });
  });
  it("points to the stretch closest to the period end when there are several", () => {
    const notice = coverageNotice(
      indexWith([row("2010-01-01", "2012-12-31"), row("2018-01-01", null)]),
      ["club-a"],
      fanPeriod("2005-01-01", FIXED_NOW),
      ["league-x"],
    );
    expect(notice.competitions[0]).toMatchObject({ status: "partial", completeFrom: "2018-01-01" });
  });
  it("is missing when there are no complete rows covering the period", () => {
    const notice = coverageNotice(indexWith([]), ["club-a"], period, ["league-x"]);
    expect(notice.competitions[0]).toEqual({
      competitionId: "league-x",
      status: "missing",
      completeFrom: null,
      completeTo: null,
    });
    const before = coverageNotice(
      indexWith([row("2000-01-01", "2010-12-31")]),
      ["club-a"],
      fanPeriod("2015-01-01", FIXED_NOW),
      ["league-x"],
    );
    expect(before.competitions[0].status).toBe("missing");
  });
  it("is missing when only incomplete rows exist", () => {
    const index = indexWith([row("2000-01-01", null, false)]);
    const notice = coverageNotice(index, ["club-a"], period, ["league-x"]);
    expect(notice.competitions[0].status).toBe("missing");
  });
  it("ignores the rows of an unrelated club", () => {
    const other = makeCoverage("club-d", "league-x", "2000-01-01", null);
    const notice = coverageNotice(indexWith([other]), ["club-a"], period, ["league-x"]);
    expect(notice.competitions[0].status).toBe("missing");
  });
  it("ignores the rows of another competition", () => {
    const other = makeCoverage("club-a", "cup-y", "2000-01-01", null);
    const notice = coverageNotice(indexWith([other]), ["club-a"], period, ["league-x"]);
    expect(notice.competitions[0].status).toBe("missing");
  });
  it("merges the rows of two clubs: complete coverage of either one is enough", () => {
    const rows = [
      makeCoverage("club-a", "league-x", "2022-01-01", null),
      makeCoverage("club-b", "league-x", "2019-01-01", null),
    ];
    const notice = coverageNotice(indexWith(rows), ["club-a", "club-b"], period, ["league-x"]);
    expect(notice.isComplete).toBe(true);
  });
  it("is complete only when every listed competition is complete", () => {
    const rows = [row("2019-01-01", null), makeCoverage("club-a", "cup-y", "2022-01-01", null)];
    const notice = coverageNotice(indexWith(rows), ["club-a"], period, ["league-x", "cup-y"]);
    expect(notice.competitions.map((c) => c.status)).toEqual(["partial", "complete"]);
    expect(notice.isComplete).toBe(false);
  });
  it("lists the competitions in a stable order without duplicates", () => {
    const rows = [row("2019-01-01", null), makeCoverage("club-a", "cup-y", "2019-01-01", null)];
    const notice = coverageNotice(indexWith(rows), ["club-a"], period, [
      "league-x",
      "cup-y",
      "league-x",
    ]);
    expect(notice.competitions.map((c) => c.competitionId)).toEqual(["cup-y", "league-x"]);
  });
  it("shows nothing for an empty period", () => {
    const future = fanPeriod("2030-01-01", FIXED_NOW);
    expect(coverageNotice(indexWith([]), ["club-a"], future, ["league-x"])).toEqual({
      isComplete: true,
      competitions: [],
    });
  });
  it("is incomplete when a real period has no competitions at all", () => {
    expect(coverageNotice(indexWith([]), ["club-a"], period, [])).toEqual({
      isComplete: false,
      competitions: [],
    });
  });
});
