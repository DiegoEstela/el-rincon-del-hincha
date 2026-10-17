import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CLUB_IDS } from "@/lib/club-data.server";
import { clubIdSchema, clubPairSchema, startDateSchema } from "@/lib/engine-input.server";

const NOW = new Date("2026-10-17T12:00:00Z");
const DATES = ["1990-05-20", "20/05/1990", "19900520", "2999-01-01", "1700-01-01"];

describe("clubIdSchema", () => {
  it("accepts the 34 ids", () => {
    for (const id of CLUB_IDS) expect(clubIdSchema.safeParse(id).success).toBe(true);
  });

  it("rejects anything else without echoing it", () => {
    const bad = [
      "",
      "BOCA-JUNIORS",
      "../boca-juniors",
      "boca juniors",
      "x".repeat(10_000),
      7,
      {},
      null,
    ];
    for (const value of bad) {
      const result = clubIdSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).not.toContain("xxxxxxxxxx");
      expect(JSON.stringify(result.error?.issues)).not.toContain("../");
    }
  });
});

describe("startDateSchema", () => {
  const schema = startDateSchema(NOW);

  it("accepts a valid date and returns it trimmed", () => {
    expect(schema.parse(" 1990-05-20 ")).toBe("1990-05-20");
    expect(schema.parse("2026-10-17")).toBe("2026-10-17");
  });

  it("rejects every error of validateStartDate, with the code as the only message", () => {
    const cases: [string, string][] = [
      ["", "empty"],
      ["20/05/1990", "format"],
      ["1990-02-31", "not_a_date"],
      ["1700-01-01", "too_early"],
      ["2999-01-01", "future"],
    ];
    for (const [value, code] of cases) {
      const result = schema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((i) => i.message)).toEqual([code]);
    }
  });

  it("never lets a date into the error", () => {
    for (const value of DATES) {
      const result = schema.safeParse(value);
      const text = JSON.stringify(result.error ?? {});
      for (const date of DATES) expect(text).not.toContain(date);
    }
    expect(JSON.stringify(schema.safeParse(1990).error)).not.toContain("1990-");
  });
});

describe("clubPairSchema", () => {
  it("accepts two different known clubs", () => {
    expect(
      clubPairSchema.safeParse({ clubId: "river-plate", rivalId: "boca-juniors" }).success,
    ).toBe(true);
  });

  it("rejects the same club twice and unknown clubs", () => {
    const same = clubPairSchema.safeParse({ clubId: "river-plate", rivalId: "river-plate" });
    expect(same.success).toBe(false);
    expect(same.error?.issues.map((i) => i.message)).toEqual(["same_club"]);
    expect(clubPairSchema.safeParse({ clubId: "river-plate", rivalId: "nope" }).success).toBe(
      false,
    );
    expect(clubPairSchema.safeParse({ clubId: "nope", rivalId: "river-plate" }).success).toBe(
      false,
    );
  });
});
