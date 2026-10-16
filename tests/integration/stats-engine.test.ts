import { describe, expect, it } from "vitest";
import { FIXED_NOW } from "../fixtures/data-model/dataset";
import { statsWorld } from "../fixtures/domain/stats-world";
import { compareFans } from "@/domain/compare-fans";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { headToHead } from "@/domain/head-to-head";
import { calculateHistory } from "@/domain/history";
import { fanPeriod } from "@/domain/period";
import { groupRivals } from "@/domain/rivals";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

// Frozen input: any mutation by the engine throws in strict mode (ES modules).
const frozen = deepFreeze(statsWorld());
const index = buildStatsIndex(statsDataFrom(frozen));
const clubIds = frozen["clubs.json"].map((c) => c.id);
const period = fanPeriod("2020-01-01", FIXED_NOW);

describe("stats engine on the synthetic world", () => {
  it.each(clubIds)("keeps won + drawn + lost = played for %s", (clubId) => {
    const { record } = calculateHistory(index, clubId, period);
    expect(record.won + record.drawn + record.lost).toBe(record.played);
    expect(record.balance).toBe(record.won - record.lost);
  });

  it.each(clubIds)("sums the rival rows of %s to the club history", (clubId) => {
    const { record } = calculateHistory(index, clubId, period);
    const rows = groupRivals(index, clubId, period).all;
    const sum = (pick: (r: (typeof rows)[number]) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    expect(sum((r) => r.record.played)).toBe(record.played);
    expect(sum((r) => r.record.won)).toBe(record.won);
    expect(sum((r) => r.record.drawn)).toBe(record.drawn);
    expect(sum((r) => r.record.lost)).toBe(record.lost);
    expect(sum((r) => r.record.goalsFor)).toBe(record.goalsFor);
    expect(sum((r) => r.record.goalsAgainst)).toBe(record.goalsAgainst);
    expect(sum((r) => r.record.suspendedExcluded)).toBeLessThanOrEqual(record.suspendedExcluded);
  });

  it.each(clubIds)("agrees with the head-to-head for every rival of %s", (clubId) => {
    for (const row of groupRivals(index, clubId, period).all) {
      const h2h = headToHead(index, clubId, row.rivalId, period);
      expect(h2h.dominance).toBe(row.dominance);
      expect(h2h.record).toEqual(row.record);
    }
  });

  it("compares two fans end to end", () => {
    const comparison = compareFans(
      index,
      { clubId: "club-a", start: "2020-01-01" },
      { clubId: "club-b", start: "2022-01-01" },
      FIXED_NOW,
    );
    expect(comparison.a.period.end).toBe("2026-10-16");
    expect(comparison.headToHead?.record.played).toBe(5);
    const { a, b, ties } = comparison.scoreboard;
    expect(a + b + ties).toBe(8);
  });

  it("is deterministic: the same input gives the same output", () => {
    const first = calculateHistory(index, "club-a", period);
    const second = calculateHistory(index, "club-a", period);
    expect(second).toEqual(first);
  });
});
