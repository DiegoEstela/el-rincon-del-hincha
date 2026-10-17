import { describe, expect, it } from "vitest";
import { fanPeriod, narrowPeriod } from "@/domain/period";

const NOW = new Date("2026-10-17T15:00:00Z");
const period = fanPeriod("1990-05-20", NOW);

describe("narrowPeriod", () => {
  it("clamps whole years inside the period", () => {
    expect(narrowPeriod(period, { fromYear: 2019, toYear: 2021 })).toEqual({
      start: "2019-01-01",
      end: "2021-12-31",
      isEmpty: false,
    });
  });

  it("keeps the fan start when the first year is earlier or the same year", () => {
    expect(narrowPeriod(period, { fromYear: 1980, toYear: 2000 }).start).toBe("1990-05-20");
    expect(narrowPeriod(period, { fromYear: 1990, toYear: 2000 }).start).toBe("1990-05-20");
  });

  it("keeps today (Buenos Aires) when the last year is the current year or later", () => {
    expect(narrowPeriod(period, { fromYear: 2020, toYear: 2026 }).end).toBe("2026-10-17");
    expect(narrowPeriod(period, { fromYear: 2020, toYear: 2030 }).end).toBe("2026-10-17");
    // 02:30 UTC is still the 16th in Buenos Aires.
    const late = fanPeriod("1990-05-20", new Date("2026-10-17T02:30:00Z"));
    expect(narrowPeriod(late, { fromYear: 2020, toYear: 2026 }).end).toBe("2026-10-16");
  });

  it("is empty for a range entirely before the start or after today", () => {
    expect(narrowPeriod(period, { fromYear: 1980, toYear: 1989 }).isEmpty).toBe(true);
    expect(narrowPeriod(period, { fromYear: 2027, toYear: 2030 }).isEmpty).toBe(true);
  });

  it("stays empty when the period is already empty", () => {
    const empty = fanPeriod("2999-01-01", NOW);
    expect(narrowPeriod(empty, { fromYear: 2999, toYear: 3000 }).isEmpty).toBe(true);
  });

  it("throws a RangeError with no date in the message for invalid years", () => {
    const bad = [
      { fromYear: 2022, toYear: 2020 },
      { fromYear: 2020.5, toYear: 2021 },
      { fromYear: 1879, toYear: 2021 },
      { fromYear: 2020, toYear: 10000 },
      { fromYear: Number.NaN, toYear: 2021 },
    ];
    for (const range of bad) {
      expect(() => narrowPeriod(period, range)).toThrow(RangeError);
      try {
        narrowPeriod(period, range);
      } catch (e) {
        expect((e as Error).message).not.toMatch(/\d{4}-\d{2}-\d{2}|1990/);
      }
    }
  });
});
