import { describe, expect, it } from "vitest";
import { isRealIsoDate } from "@/data-model/dates";

describe("isRealIsoDate", () => {
  it("accepts a leap day and rejects a non-leap one", () => {
    expect(isRealIsoDate("2024-02-29")).toBe(true);
    expect(isRealIsoDate("2023-02-29")).toBe(false);
  });
  it("rejects an impossible month or day", () => {
    expect(isRealIsoDate("2026-13-01")).toBe(false);
    expect(isRealIsoDate("2026-00-10")).toBe(false);
    expect(isRealIsoDate("2026-04-31")).toBe(false);
  });
  it("rejects anything that is not exactly YYYY-MM-DD", () => {
    expect(isRealIsoDate("16/10/2026")).toBe(false);
    expect(isRealIsoDate("2026-1-1")).toBe(false);
    expect(isRealIsoDate("")).toBe(false);
    expect(isRealIsoDate(" 2026-10-16")).toBe(false);
  });
  it("accepts an ordinary date", () => {
    expect(isRealIsoDate("2026-10-16")).toBe(true);
  });
});
