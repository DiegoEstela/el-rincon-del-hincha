import { describe, expect, it } from "vitest";
import { nextDay, previousDay } from "@/data-model/dates";

describe("previousDay", () => {
  it("returns the calendar day before", () => {
    expect(previousDay("2021-02-12")).toBe("2021-02-11");
  });

  it("crosses month and year boundaries", () => {
    expect(previousDay("2021-03-01")).toBe("2021-02-28");
    expect(previousDay("2024-03-01")).toBe("2024-02-29");
    expect(previousDay("2025-01-01")).toBe("2024-12-31");
  });

  it("is the inverse of nextDay", () => {
    for (const d of ["2020-02-29", "2023-12-31", "2019-07-26"]) {
      expect(previousDay(nextDay(d))).toBe(d);
    }
  });
});
