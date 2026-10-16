import { describe, expect, it } from "vitest";
import { DATASET_FILES } from "@/data-model/schemas";
import { securityViolations } from "./gates";
import { loadModel } from "./migrations";
import { netPrivileges, parseMigrations } from "./sql-model";

const { files, sql, model } = loadModel();
const REFERENCE_TABLES = DATASET_FILES.map((f) => f.replace(/\.json$/, ""));

describe("migration files", () => {
  it("are named YYYYMMDDHHMMSS_snake_name.sql with unique timestamps", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    const stamps = files.map((f) => f.slice(0, 14));
    expect(new Set(stamps).size).toBe(stamps.length);
  });
  it("create exactly the nine data tables plus comparisons", () => {
    expect([...model.tables.keys()].sort()).toEqual([...REFERENCE_TABLES, "comparisons"].sort());
  });
  it("revoke the default privileges in the first migration", () => {
    expect(parseMigrations([sql[0]!]).defaultPrivilegeRevokes).toBe(true);
  });
});

describe("security gate over the real migrations", () => {
  it("reports no violation", () => {
    expect(securityViolations(model)).toEqual([]);
  });
});

describe("reference tables are public read-only", () => {
  it.each(REFERENCE_TABLES)("%s: one select policy, anon reads, service_role writes", (name) => {
    const policies = model.policies.filter((p) => p.table === name);
    expect(policies).toEqual([
      { name: `${name}_read`, table: name, command: "select", roles: ["anon", "authenticated"] },
    ]);
    expect([...netPrivileges(model, name, "anon")]).toEqual(["select"]);
    expect([...netPrivileges(model, name, "authenticated")]).toEqual(["select"]);
    expect([...netPrivileges(model, name, "service_role")].sort()).toEqual([
      "delete",
      "insert",
      "select",
      "update",
    ]);
  });
  it("matches has both history indexes", () => {
    const cols = model.indexes.filter((i) => i.table === "matches").map((i) => i.columns.join(","));
    expect(cols).toContain("home_id,date");
    expect(cols).toContain("away_id,date");
  });
  it("matches blocks duplicate fixtures regardless of home/away order", () => {
    const dup = model.indexes.find((i) => i.table === "matches" && i.unique);
    expect(dup?.columns).toEqual([
      "season_id",
      "date",
      "least(home_id, away_id)",
      "greatest(home_id, away_id)",
    ]);
  });
});

describe("the gate itself catches mistakes", () => {
  const T = "create table public.t (id text primary key);";
  const RLS = "alter table public.t enable row level security;";
  const bad = (text: string) => securityViolations(parseMigrations([text]));

  it("accepts a correct table", () => {
    const ok = `${T} ${RLS} grant select on table public.t to anon;
      create policy "t_read" on public.t for select to anon using (true);`;
    expect(bad(ok)).toEqual([]);
  });
  it("fails a table without RLS", () => {
    expect(bad(T)).toEqual(["t: row level security is never enabled"]);
  });
  it("fails RLS enabled in a later file", () => {
    const v = securityViolations(parseMigrations([T, RLS]));
    expect(v.join()).toMatch(/different file/);
  });
  it("fails a table without a primary key", () => {
    expect(bad(`create table public.t (id text); ${RLS}`).join()).toMatch(/no primary key/);
  });
  it("fails write policies and policies without a role list", () => {
    const all = `${T} ${RLS} create policy p on public.t for all to anon using (true);`;
    expect(bad(all).join()).toMatch(/lets anon all/);
    const ins = `${T} ${RLS} create policy p on public.t for insert to authenticated with check (true);`;
    expect(bad(ins).join()).toMatch(/authenticated insert/);
    const noTo = `${T} ${RLS} create policy p on public.t for select using (true);`;
    expect(bad(noTo).join()).toMatch(/no explicit "to"/);
  });
  it("fails grant all and truncate to anon, even with RLS", () => {
    expect(bad(`${T} ${RLS} grant all on table public.t to anon;`).join()).toMatch(
      /anon keeps .*truncate/,
    );
    expect(bad(`${T} ${RLS} grant truncate on table public.t to anon;`).join()).toMatch(/truncate/);
  });
  it("fails a re-grant after an earlier revoke", () => {
    const text = `${T} ${RLS} revoke all on table public.t from anon; grant insert on table public.t to anon;`;
    expect(bad(text).join()).toMatch(/anon keeps insert/);
  });
  it("passes when a later revoke removes an earlier grant", () => {
    const text = `${T} ${RLS} grant all on table public.t to anon; revoke all on table public.t from anon;`;
    expect(bad(text)).toEqual([]);
  });
  it("fails a security definer function without an empty search_path", () => {
    const f = (opt: string) =>
      `create function public.f() returns int language sql security definer ${opt} as $$ select 1 $$;`;
    expect(bad(f("")).join()).toMatch(/search_path/);
    expect(bad(f("set search_path = public")).join()).toMatch(/search_path/);
    const locked = `${f("set search_path = ''")} revoke all on function public.f() from public;`;
    expect(bad(locked)).toEqual([]);
  });
  it("fails a security definer function that clients can execute", () => {
    const f = `create function public.f() returns int language sql security definer set search_path = '' as $$ select 1 $$;`;
    expect(bad(f).join()).toMatch(/executable by public/);
    const anon = `${f} revoke all on function public.f() from public; grant execute on function public.f() to anon;`;
    expect(bad(anon).join()).toMatch(/executable by anon/);
  });
  it("ignores keywords inside comments", () => {
    const text = `-- grant all on table public.t to anon;\n/* create table public.t (id text); */ select 1;`;
    expect(bad(text)).toEqual([]);
  });
});
