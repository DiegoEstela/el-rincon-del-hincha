import { describe, expect, it } from "vitest";
import { fanPeriod, inPeriod, laterStart } from "@/domain/period";

const NOW = new Date("2026-10-16T15:00:00Z");

describe("fan period: start inclusive, end is today in Buenos Aires", () => {
  it("runs from the start date to today", () => {
    expect(fanPeriod("2020-03-01", NOW)).toEqual({
      start: "2020-03-01",
      end: "2026-10-16",
      isEmpty: false,
    });
  });
  it("uses the Buenos Aires calendar day for the end", () => {
    expect(fanPeriod("2020-03-01", new Date("2026-10-16T02:30:00Z")).end).toBe("2026-10-15");
    expect(fanPeriod("2020-03-01", new Date("2026-10-16T03:00:00Z")).end).toBe("2026-10-16");
  });
  it("is empty when the start is in the future", () => {
    expect(fanPeriod("2026-10-17", NOW).isEmpty).toBe(true);
  });
  it("is not empty when the start is today", () => {
    expect(fanPeriod("2026-10-16", NOW).isEmpty).toBe(false);
  });
  it("rejects a start that is not a real YYYY-MM-DD date", () => {
    expect(() => fanPeriod("2026-13-01", NOW)).toThrow(RangeError);
    expect(() => fanPeriod("16/10/2026", NOW)).toThrow(RangeError);
    expect(() => fanPeriod("2026-02-30", NOW)).toThrow(RangeError);
  });
});

describe("inPeriod", () => {
  const period = fanPeriod("2020-03-01", NOW);
  it("includes both bounds", () => {
    expect(inPeriod("2020-03-01", period)).toBe(true);
    expect(inPeriod("2026-10-16", period)).toBe(true);
  });
  it("excludes the day before the start and the day after today", () => {
    expect(inPeriod("2020-02-29", period)).toBe(false);
    expect(inPeriod("2026-10-17", period)).toBe(false);
  });
  it("includes nothing when the period is empty", () => {
    const future = fanPeriod("2026-12-01", NOW);
    expect(inPeriod("2026-12-01", future)).toBe(false);
    expect(inPeriod("2026-10-16", future)).toBe(false);
  });
});

describe("laterStart", () => {
  it("returns the later of two start dates in either order", () => {
    expect(laterStart("2020-01-01", "2022-05-05")).toBe("2022-05-05");
    expect(laterStart("2022-05-05", "2020-01-01")).toBe("2022-05-05");
  });
  it("returns the same date when equal", () => {
    expect(laterStart("2020-01-01", "2020-01-01")).toBe("2020-01-01");
  });
});
