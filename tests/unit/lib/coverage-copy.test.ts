import { describe, expect, it } from "vitest";
import {
  CUPS_NOT_LOADED,
  coverageCopy,
  formatMonthYear,
  includedLine,
  joinNames,
} from "@/lib/coverage-copy";
import type { CoverageNotice } from "@/domain/types";

const names = new Map([
  ["primera-division", "Primera División"],
  ["copa-de-la-liga-profesional", "Copa de la Liga Profesional"],
]);

const partial = (completeTo: string | null): CoverageNotice => ({
  isComplete: false,
  competitions: [
    {
      competitionId: "primera-division",
      status: "partial",
      completeFrom: "2018-08-10",
      completeTo,
    },
  ],
});

describe("formatMonthYear", () => {
  it("writes the month in Spanish and the year, with no day", () => {
    expect(formatMonthYear("2018-08-10")).toBe("agosto de 2018");
    expect(formatMonthYear("2025-05-04")).toBe("mayo de 2025");
    expect(formatMonthYear("2021-01-01")).toBe("enero de 2021");
    expect(formatMonthYear("2020-12-31")).toBe("diciembre de 2020");
  });
});

describe("coverageCopy", () => {
  it("says nothing for a complete notice, and never uses the word complete", () => {
    const copy = coverageCopy({ isComplete: true, competitions: [] }, names);
    expect(copy).toEqual({ show: false, heading: "", lead: "", lines: [] });
    expect(JSON.stringify(copy)).not.toMatch(/complet/i);
  });

  it("describes a partial competition with its complete stretch", () => {
    const copy = coverageCopy(partial("2025-05-04"), names);
    expect(copy.show).toBe(true);
    expect(copy.heading).toBe("Tu historial puede estar incompleto");
    expect(copy.lead).toBe("Estos números cuentan solo los partidos que tenemos cargados.");
    expect(copy.lines).toEqual([
      "Primera División: tenemos todos los partidos de agosto de 2018 a mayo de 2025.",
    ]);
  });

  it("describes an ongoing stretch with desde", () => {
    expect(coverageCopy(partial(null), names).lines).toEqual([
      "Primera División: tenemos todos los partidos desde agosto de 2018.",
    ]);
  });

  it("describes a missing competition", () => {
    const copy = coverageCopy(
      {
        isComplete: false,
        competitions: [
          {
            competitionId: "copa-de-la-liga-profesional",
            status: "missing",
            completeFrom: null,
            completeTo: null,
          },
        ],
      },
      names,
    );
    expect(copy.lines).toEqual([
      "Copa de la Liga Profesional: todavía no tenemos sus partidos completos en este período.",
    ]);
  });

  it("skips the competitions that are complete and falls back to the id for an unknown name", () => {
    const copy = coverageCopy(
      {
        isComplete: false,
        competitions: [
          {
            competitionId: "primera-division",
            status: "complete",
            completeFrom: "2018-08-10",
            completeTo: null,
          },
          { competitionId: "mystery", status: "missing", completeFrom: null, completeTo: null },
        ],
      },
      names,
    );
    expect(copy.lines).toEqual([
      "mystery: todavía no tenemos sus partidos completos en este período.",
    ]);
  });

  it("never contains the start date of a fan, whatever the date", () => {
    for (let i = 0; i < 50; i++) {
      const year = 1950 + ((i * 7) % 75);
      const month = String(1 + (i % 12)).padStart(2, "0");
      const day = String(1 + ((i * 3) % 28)).padStart(2, "0");
      const start = `${year}-${month}-${day}`;
      // The copy is built from the coverage notice only: it cannot even receive the date.
      const text = JSON.stringify([
        coverageCopy(partial("2025-05-04"), names),
        includedLine(["primera-division"], names),
      ]);
      expect(text).not.toContain(start);
      expect(text).not.toContain(`${day}/${month}/${year}`);
    }
  });
});

describe("joinNames", () => {
  it("joins with commas and a final y", () => {
    expect(joinNames([], new Map())).toBe("");
    expect(joinNames(["a"], new Map())).toBe("a");
    expect(joinNames(["primera-division", "copa-de-la-liga-profesional"], names)).toBe(
      "Primera División y Copa de la Liga Profesional",
    );
    expect(joinNames(["a", "b", "c"], new Map())).toBe("a, b y c");
  });
});

describe("includedLine", () => {
  it("lists one competition", () => {
    expect(includedLine(["primera-division"], names)).toBe("Contamos: Primera División.");
  });

  it("joins two with y and three with commas and y", () => {
    expect(includedLine(["primera-division", "copa-de-la-liga-profesional"], names)).toBe(
      "Contamos: Primera División y Copa de la Liga Profesional.",
    );
    expect(includedLine(["a", "b", "c"], new Map())).toBe("Contamos: a, b y c.");
  });

  it("says there is nothing loaded for an empty list", () => {
    expect(includedLine([], names)).toBe("Todavía no hay partidos cargados para este período.");
  });
});

describe("CUPS_NOT_LOADED", () => {
  it("is the fixed line about the cups that are not loaded", () => {
    expect(CUPS_NOT_LOADED).toBe(
      "Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas.",
    );
  });
});
