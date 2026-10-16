import { describe, expect, it } from "vitest";
import { checkScores } from "@/data-model/rules/scores";
import type { Dataset, Match } from "@/data-model/types";
import { loadModel } from "./migrations";
import { accepts, compileCheck, type Row } from "./sql-eval";
import { parseMigrations } from "./sql-model";

const { model } = loadModel();

// Checks the evaluator cannot run (regular expressions, jsonb and array functions).
const unsupported = (check: string) => /~|->|\?&|array_position|jsonb_typeof|'\{\}'/.test(check);
const dbAccepts = (table: string, row: Row) =>
  accepts(model.tables.get(table)!.checks, row, unsupported);

describe("the three-valued evaluator", () => {
  const run = (expr: string, row: Row = {}) => compileCheck(expr)(row);
  it("follows SQL NULL semantics", () => {
    expect(run("a = 1", { a: null })).toBeNull();
    expect(run("a is null", { a: null })).toBe(true);
    expect(run("a is not distinct from b", { a: null, b: null })).toBe(true);
    expect(run("a is distinct from 'x'", { a: null })).toBe(true);
    expect(run("a = 1 and b = 2", { a: null, b: 3 })).toBe(false);
    expect(run("a = 1 and b = 2", { a: null, b: 2 })).toBeNull();
    expect(run("a = 1 or b = 2", { a: null, b: 2 })).toBe(true);
    expect(run("a = 1 or b = 2", { a: null, b: 3 })).toBeNull();
    expect(run("a in ('x', 'y')", { a: "x" })).toBe(true);
    expect(run("a in ('x', 'y')", { a: "z" })).toBe(false);
    expect(run('"end" >= start + 1', { end: 5, start: 4 })).toBe(true);
  });
  it("throws on syntax it does not support", () => {
    expect(() => run("a ~ 'x'", { a: "x" })).toThrow();
    expect(() => run("a = 1 )")).toThrow();
  });
});

describe("matches score and penalty checks", () => {
  const base: Match = {
    id: "m",
    season_id: "s",
    date: "2020-01-01",
    home_id: "a",
    away_id: "b",
    home_goals: 1,
    away_goals: 1,
    decision: null,
    home_penalties: null,
    away_penalties: null,
    stage: "",
    is_final: false,
    status: "played",
    source: "x",
    verified: true,
  };
  const validatorAccepts = (m: Match) =>
    checkScores({ "matches.json": [m] } as unknown as Dataset).length === 0;

  it("accepts exactly what the validator accepts, over the whole truth table", () => {
    let cases = 0;
    for (const decision of [null, "penalties", "extra_time"] as const) {
      for (const status of ["played", "suspended", "administrative_result"] as const) {
        for (const home_goals of [null, 0, 2, -1]) {
          for (const away_goals of [null, 0, 2]) {
            for (const home_penalties of [null, 3, -1]) {
              for (const away_penalties of [null, 3, 5]) {
                const m: Match = {
                  ...base,
                  decision,
                  status,
                  home_goals,
                  away_goals,
                  home_penalties,
                  away_penalties,
                };
                cases += 1;
                expect(dbAccepts("matches", m), JSON.stringify(m)).toBe(validatorAccepts(m));
              }
            }
          }
        }
      }
    }
    expect(cases).toBe(972);
  });

  it("rejects penalty counts without a shoot-out when decision is null (the NULL hole)", () => {
    const m = { ...base, decision: null, home_penalties: 4, away_penalties: 3 };
    expect(dbAccepts("matches", m)).toBe(false);
  });
  it("rejects a shoot-out with unequal goals, equal counts or a missing count", () => {
    const shoot = { ...base, decision: "penalties" as const, home_penalties: 4, away_penalties: 3 };
    expect(dbAccepts("matches", shoot)).toBe(true);
    expect(dbAccepts("matches", { ...shoot, home_goals: 2 })).toBe(false);
    expect(dbAccepts("matches", { ...shoot, away_penalties: 4 })).toBe(false);
    expect(dbAccepts("matches", { ...shoot, away_penalties: null })).toBe(false);
  });
  it("accepts a suspended match without a score and an extra-time win", () => {
    expect(
      dbAccepts("matches", { ...base, status: "suspended", home_goals: null, away_goals: null }),
    ).toBe(true);
    expect(dbAccepts("matches", { ...base, decision: "extra_time", home_goals: 2 })).toBe(true);
  });

  it("the evaluator catches the original check, whose penalty branch could be NULL", () => {
    const buggy = parseMigrations([
      `create table public.matches (
        home_goals integer,
        away_goals integer,
        decision text,
        home_penalties integer,
        away_penalties integer,
        check (
          (decision is distinct from 'penalties' and home_penalties is null and away_penalties is null)
          or (
            decision = 'penalties'
            and home_penalties is not null
            and away_penalties is not null
            and home_penalties <> away_penalties
            and home_goals is not distinct from away_goals
          )
        )
      );`,
    ]).tables.get("matches")!;
    const row = { ...base, decision: null, home_penalties: 4, away_penalties: 3 };
    expect(accepts(buggy.checks, row, unsupported)).toBe(true); // the hole: wrongly accepted
    expect(validatorAccepts(row)).toBe(false);
  });
});

describe("other row checks never evaluate to NULL for a bad row", () => {
  it("seasons: start <= end", () => {
    const row = { id: "s", competition_id: "c", name: "n", source: "x" };
    expect(dbAccepts("seasons", { ...row, start: "2020-01-02", end: "2020-01-01" })).toBe(false);
    expect(dbAccepts("seasons", { ...row, start: "2020-01-01", end: "2020-01-01" })).toBe(true);
  });
  it("coverage: from <= to, open-ended allowed", () => {
    const row = { club_id: "a", competition_id: "c", complete: true, source: "x" };
    expect(dbAccepts("coverage", { ...row, from: "2020-02-01", to: "2020-01-01" })).toBe(false);
    expect(dbAccepts("coverage", { ...row, from: "2020-01-01", to: null })).toBe(true);
  });
  it("standings: won + drawn + lost = played, counts non-negative", () => {
    const row = { club_id: "a", season_id: "s", source: "x" };
    expect(dbAccepts("standings", { ...row, played: 3, won: 1, drawn: 1, lost: 1 })).toBe(true);
    expect(dbAccepts("standings", { ...row, played: 4, won: 1, drawn: 1, lost: 1 })).toBe(false);
    expect(dbAccepts("standings", { ...row, played: 1, won: 2, drawn: 0, lost: -1 })).toBe(false);
  });
  it("every CHECK of the evaluable tables compiles", () => {
    for (const t of ["matches", "seasons", "coverage", "standings", "titles", "movements"]) {
      for (const c of model.tables.get(t)!.checks.filter((x) => !unsupported(x))) {
        expect(() => compileCheck(c), `${t}: ${c}`).not.toThrow();
      }
    }
  });
});
