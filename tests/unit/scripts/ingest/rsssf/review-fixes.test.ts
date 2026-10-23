import { describe, expect, it } from "vitest";
import { IngestError } from "../../../../../scripts/ingest/core/errors";
import type { TournamentConfig } from "../../../../../scripts/ingest/rsssf/config";
import type { ManifestPage } from "../../../../../scripts/ingest/rsssf/manifest";
import { normalizeRsssf } from "../../../../../scripts/ingest/rsssf/normalize";
import { sliceExcerpt } from "../../../../../scripts/ingest/rsssf/slicer";
import { prepareText } from "../../../../../scripts/ingest/rsssf/text";
import type { ParsedMatch } from "../../../../../scripts/ingest/rsssf/types";

const clubs = [
  { id: "a", aliases: ["CA A"] },
  { id: "b", aliases: ["CA B"] },
] as never;
const T: TournamentConfig = {
  id: "liga-2025-clausura",
  competition_id: "liga",
  name: "Clausura 2025",
  page: "arg2025",
  excerpt: "1clausura",
  window: { from: "2025-07-01", to: "2025-12-31" },
  mode: { kind: "own" },
  tableCoversSeason: false,
};
const page = (extra: Partial<ManifestPage> = {}) =>
  ({ variants: [], tableExceptions: [], ...extra }) as unknown as ManifestPage;
let line = 0;
const m = (date: string, extra: Partial<ParsedMatch> = {}): ParsedMatch => ({
  line: ++line,
  date,
  stage: "Fecha 1",
  home: "CA A",
  away: "CA B",
  homeGoals: null,
  awayGoals: null,
  extraTime: false,
  penalties: null,
  abandoned: null,
  resumed: null,
  ...extra,
});
const problemsOf = (matches: ParsedMatch[], p = page()): string[] => {
  try {
    normalizeRsssf(
      [{ tournament: T, page: p, parsed: { excerpt: "x", matches, tables: [] } }],
      clubs,
      [],
    );
  } catch (e) {
    return (e as IngestError).problems;
  }
  return [];
};

describe("review fixes (plan 0017)", () => {
  it("reports the same fixture abandoned twice before it is completed", () => {
    const problems = problemsOf([
      m("2025-08-01", { abandoned: "0-0" }),
      m("2025-08-02", { abandoned: "1-0" }),
    ]);
    expect(problems.join()).toMatch(/abandoned twice/);
  });

  it("reports a match completed before the day it was abandoned", () => {
    const problems = problemsOf([
      m("2025-08-10", { abandoned: "0-0" }),
      m("2025-08-01", { homeGoals: 1, awayGoals: 0, resumed: "45m" }),
    ]);
    expect(problems.join()).toMatch(/before the day it was abandoned/);
  });

  it("collects a bad completion date instead of throwing a bare error", () => {
    const bad = m("2025-08-01", {
      homeGoals: 1,
      awayGoals: 0,
      abandoned: "x",
      resumed: "time on 24 Xyz",
    });
    expect(problemsOf([bad]).join()).toMatch(/unknown month "Xyz"|cannot read when/);
    const outside = m("2025-08-01", {
      homeGoals: 1,
      awayGoals: 0,
      abandoned: "x",
      resumed: "time on 24 Feb",
    });
    expect(problemsOf([outside]).join()).toMatch(/outside the window/);
  });

  it("reports a played match that has no score", () => {
    expect(problemsOf([m("2025-08-01")]).join()).toMatch(/has no score/);
  });

  it("reports a table exception for a tournament whose table is not checked", () => {
    const exception = { excerpt: "1clausura", club: "Club A", reason: "points deducted" };
    const problems = problemsOf(
      [m("2025-08-01", { homeGoals: 1, awayGoals: 0 })],
      page({ tableExceptions: [exception] }),
    );
    expect(problems.join()).toMatch(/exception for Club A is unused \(no table is checked\)/);
  });

  it("rejects a slicer marker with a character outside latin1", () => {
    expect(() => sliceExcerpt(Uint8Array.from([0x61]), "a€", "b")).toThrow(/outside latin1/);
    expect(() => sliceExcerpt(Uint8Array.from([0x61]), "a", "€")).toThrow(/outside latin1/);
  });

  it("rejects a numeric entity out of range, naming the line", () => {
    expect(() => prepareText("x &#99999999; y", "p.txt")).toThrow(/p\.txt:1.*out of range/);
    expect(() => prepareText("x &#x110000; y", "p.txt")).toThrow(/out of range/);
  });
});
