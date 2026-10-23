import { describe, expect, it } from "vitest";
import { checkWindow, resolveDate } from "../../../../../scripts/ingest/rsssf/dates";

const W_1819 = { from: "2018-08-01", to: "2019-07-31" };
const W_1950 = { from: "1950-01-01", to: "1950-12-31" };
const at = "arg2019.1:12";

describe("resolveDate (plan 0017, T13)", () => {
  it("gives the first year to the months of the first half of the window", () => {
    expect(resolveDate("Aug", 10, "Fri", W_1819, at)).toBe("2018-08-10");
    expect(resolveDate("Dec", 22, undefined, W_1819, at)).toBe("2018-12-22");
  });

  it("gives the second year to the months after the new year", () => {
    expect(resolveDate("Jan", 29, undefined, W_1819, at)).toBe("2019-01-29");
    expect(resolveDate("May", 19, "Sun", W_1819, at)).toBe("2019-05-19");
  });

  it("resolves a window inside one calendar year", () => {
    expect(resolveDate("Apr", 2, undefined, W_1950, at)).toBe("1950-04-02");
  });

  it("checks the weekday when it is present", () => {
    expect(() => resolveDate("Aug", 10, "Sat", W_1819, at)).toThrow(/arg2019\.1:12.*Fri.*Sat/);
    expect(() => resolveDate("Aug", 10, "Xyz", W_1819, at)).toThrow(/weekday/);
  });

  it("accepts February 29 only in a leap year", () => {
    const leap = { from: "2019-08-01", to: "2020-07-31" };
    expect(resolveDate("Feb", 29, undefined, leap, at)).toBe("2020-02-29");
    expect(() => resolveDate("Feb", 29, undefined, W_1819, at)).toThrow(/does not exist/);
  });

  it("fails on a month outside the window", () => {
    expect(() =>
      resolveDate("Jul", 5, undefined, { from: "2018-08-01", to: "2019-05-31" }, at),
    ).toThrow(/outside the window/);
  });

  it("fails on an unknown month or an impossible day", () => {
    expect(() => resolveDate("Foo", 1, undefined, W_1819, at)).toThrow(/month/);
    expect(() => resolveDate("Aug", 32, undefined, W_1819, at)).toThrow(/does not exist/);
    expect(() => resolveDate("Aug", 0, undefined, W_1819, at)).toThrow(/does not exist/);
  });
});

describe("checkWindow", () => {
  it("accepts a window of up to 12 months", () => {
    expect(() => checkWindow(W_1819)).not.toThrow();
    expect(() => checkWindow({ from: "2020-01-01", to: "2020-12-31" })).not.toThrow();
  });

  it("rejects a window over 12 months, an inverted one and a bad date", () => {
    expect(() => checkWindow({ from: "2018-08-01", to: "2019-09-01" })).toThrow(/12 months/);
    expect(() => checkWindow({ from: "2019-08-01", to: "2018-08-01" })).toThrow(/before/);
    expect(() => checkWindow({ from: "2019-13-01", to: "2019-12-01" })).toThrow(/date/);
  });
});
