import { describe, expect, it } from "vitest";
import { isAfter, isWithin, todayInBuenosAires } from "@/data-model/dates";

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
