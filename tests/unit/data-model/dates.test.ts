import { describe, expect, it } from "vitest";
import { isAfter, isWithin, nextDay, todayInBuenosAires } from "@/data-model/dates";

describe("todayInBuenosAires", () => {
  it("still returns the previous day before 03:00 UTC", () => {
    expect(todayInBuenosAires(new Date("2026-10-16T02:30:00Z"))).toBe("2026-10-15");
  });
  it("returns the same day from 03:00 UTC", () => {
    expect(todayInBuenosAires(new Date("2026-10-16T03:00:00Z"))).toBe("2026-10-16");
  });
  it("handles the year boundary", () => {
    expect(todayInBuenosAires(new Date("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
  });
});

describe("todayInBuenosAires at the UTC midnight edge", () => {
  it("is still the previous day at exactly 00:00Z (21:00 in Buenos Aires)", () => {
    expect(todayInBuenosAires(new Date("2026-10-16T00:00:00Z"))).toBe("2026-10-15");
  });
});

describe("seasons that span two calendar years", () => {
  it("compares plain dates correctly across the year boundary", () => {
    expect(isWithin("2019-12-31", "2019-08-01", "2020-06-30")).toBe(true);
    expect(isWithin("2020-01-01", "2019-08-01", "2020-06-30")).toBe(true);
    expect(isWithin("2020-07-01", "2019-08-01", "2020-06-30")).toBe(false);
    expect(isWithin("2019-07-31", "2019-08-01", "2020-06-30")).toBe(false);
  });
});

describe("isAfter", () => {
  it("compares calendar dates", () => {
    expect(isAfter("2026-10-17", "2026-10-16")).toBe(true);
    expect(isAfter("2026-10-16", "2026-10-16")).toBe(false);
    expect(isAfter("2026-10-15", "2026-10-16")).toBe(false);
  });
});

describe("isWithin", () => {
  it("is inclusive on both bounds", () => {
    expect(isWithin("2020-01-01", "2020-01-01", "2020-12-31")).toBe(true);
    expect(isWithin("2020-12-31", "2020-01-01", "2020-12-31")).toBe(true);
    expect(isWithin("2019-12-31", "2020-01-01", "2020-12-31")).toBe(false);
    expect(isWithin("2021-01-01", "2020-01-01", "2020-12-31")).toBe(false);
  });
});

describe("nextDay", () => {
  it("moves to the first day of the next month", () => {
    expect(nextDay("2020-01-31")).toBe("2020-02-01");
  });
  it("handles leap years", () => {
    expect(nextDay("2020-02-28")).toBe("2020-02-29");
    expect(nextDay("2021-02-28")).toBe("2021-03-01");
  });
  it("handles the year boundary", () => {
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});
