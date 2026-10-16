import { describe, expect, it } from "vitest";
import { START_DATE_MIN, validateStartDate } from "@/domain/start-date";

// 02:30Z is still 2026-10-15 in Buenos Aires.
const now = new Date("2026-10-16T02:30:00Z");

describe("validateStartDate", () => {
  it("exposes the same lower bound as the database", () => {
    expect(START_DATE_MIN).toBe("1880-01-01");
  });

  it("rejects empty and blank values", () => {
    expect(validateStartDate("", now)).toEqual({ ok: false, error: "empty" });
    expect(validateStartDate("   ", now)).toEqual({ ok: false, error: "empty" });
  });

  it("rejects a value that is not YYYY-MM-DD", () => {
    expect(validateStartDate("15/10/2026", now)).toEqual({ ok: false, error: "format" });
  });

  it("rejects a date that does not exist", () => {
    expect(validateStartDate("2023-02-29", now)).toEqual({ ok: false, error: "not_a_date" });
  });

  it("enforces the lower bound inclusively", () => {
    expect(validateStartDate("1879-12-31", now)).toEqual({ ok: false, error: "too_early" });
    expect(validateStartDate("1880-01-01", now)).toEqual({ ok: true, date: "1880-01-01" });
  });

  it("uses today in Buenos Aires as the upper bound", () => {
    expect(validateStartDate("2026-10-15", now)).toEqual({ ok: true, date: "2026-10-15" });
    expect(validateStartDate("2026-10-16", now)).toEqual({ ok: false, error: "future" });
    expect(validateStartDate("2026-10-16", new Date("2026-10-16T03:00:00Z"))).toEqual({
      ok: true,
      date: "2026-10-16",
    });
  });

  it("trims surrounding spaces", () => {
    expect(validateStartDate("  1990-05-20 ", now)).toEqual({ ok: true, date: "1990-05-20" });
  });

  it("never echoes the input in an error result", () => {
    for (const input of ["15/10/2026", "2023-02-29", "1879-12-31", "2099-01-01", "1990-5-2"]) {
      const result = validateStartDate(input, now);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(input);
    }
  });
});
