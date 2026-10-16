import { describe, expect, it } from "vitest";
import { enumValues, netPrivileges, parseMigrations } from "./sql-model";

const TABLE = `
-- create table public.ghost (id text primary key);
/* grant all on table public.ghost to anon; */
create table public.x (
  id text primary key,
  "from" date not null,
  "to" date,
  notes text,
  kind text not null check (kind in ('a', 'b')),
  aliases text[] not null,
  colors jsonb not null,
  constraint x_range check ("to" is null or "from" <= "to")
);`;

describe("tables and columns", () => {
  const model = parseMigrations([TABLE]);
  const x = model.tables.get("x");

  it("finds the table and ignores commented-out statements", () => {
    expect([...model.tables.keys()]).toEqual(["x"]);
  });
  it("unquotes column names and keeps types and nullability", () => {
    expect(x?.columns.map((c) => c.name)).toEqual([
      "id",
      "from",
      "to",
      "notes",
      "kind",
      "aliases",
      "colors",
    ]);
    const by = Object.fromEntries((x?.columns ?? []).map((c) => [c.name, c]));
    expect(by["from"]).toMatchObject({ type: "date", nullable: false });
    expect(by["to"]).toMatchObject({ type: "date", nullable: true });
    expect(by["notes"]?.nullable).toBe(true);
    expect(by["aliases"]).toMatchObject({ type: "text[]", nullable: false });
    expect(by["id"]?.nullable).toBe(false);
  });
  it("reads an inline primary key and a table-level composite one", () => {
    expect(x?.primaryKey).toEqual(["id"]);
    const m = parseMigrations([
      `create table public.y (a text not null, "from" date not null, primary key (a, "from"));`,
    ]);
    expect(m.tables.get("y")?.primaryKey).toEqual(["a", "from"]);
  });
  it("records the file index the table was created in", () => {
    const m = parseMigrations(["select 1;", TABLE]);
    expect(m.tables.get("x")?.file).toBe(1);
  });
  it("throws on a create table it cannot parse", () => {
    expect(() => parseMigrations(["create table public.z id text;"])).toThrow(/create table/);
    expect(() => parseMigrations(["create table public.z (id);"])).toThrow(/column/);
  });
});

describe("checks", () => {
  const x = parseMigrations([TABLE]).tables.get("x");
  it("keeps inline and named table-level check expressions", () => {
    expect(x?.checks.some((c) => c.includes("kind in"))).toBe(true);
    expect(x?.checks.some((c) => c.includes('"from" <= "to"'))).toBe(true);
  });
  it("extracts in (...) lists by column", () => {
    expect(enumValues(x!, "kind")).toEqual(["a", "b"]);
    expect(enumValues(x!, "notes")).toBeNull();
  });
});

describe("row level security and policies", () => {
  const sql = `
    ${TABLE}
    alter table public.x enable row level security;
    create policy "x_read" on public.x for select to anon, authenticated using (true);
    create policy x_all on public.x using (true);
    create policy "x_w" on public.x for insert to authenticated with check (true);`;
  const model = parseMigrations([sql]);
  it("records the file that enables RLS", () => {
    expect(model.rls.get("x")).toBe(0);
    expect(parseMigrations([TABLE]).rls.has("x")).toBe(false);
  });
  it("parses policy command and roles; a missing to means public and a missing for means all", () => {
    expect(model.policies).toEqual([
      { name: "x_read", table: "x", command: "select", roles: ["anon", "authenticated"] },
      { name: "x_all", table: "x", command: "all", roles: ["public"] },
      { name: "x_w", table: "x", command: "insert", roles: ["authenticated"] },
    ]);
  });
});

describe("grants and revokes", () => {
  const sql = `
    ${TABLE}
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    grant all on table public.x to anon;
    revoke all on table public.x from anon, authenticated;
    grant select on table public.x to anon, authenticated;
    grant select, insert, update, delete on table public.x to service_role;
    revoke truncate on table public.x from public;
    grant execute on function public.f(text, date) to service_role;`;
  const model = parseMigrations([sql]);
  it("evaluates grants and revokes in order", () => {
    expect([...netPrivileges(model, "x", "anon")]).toEqual(["select"]);
    expect([...netPrivileges(model, "x", "service_role")].sort()).toEqual([
      "delete",
      "insert",
      "select",
      "update",
    ]);
  });
  it("expands all and honors grants to public", () => {
    const m = parseMigrations([`${TABLE} grant all on table public.x to anon;`]);
    expect(netPrivileges(m, "x", "anon").has("truncate")).toBe(true);
    const p = parseMigrations([`${TABLE} grant update on table public.x to public;`]);
    expect(netPrivileges(p, "x", "authenticated").has("update")).toBe(true);
  });
  it("records function grants separately from table grants", () => {
    expect(model.functionGrants).toEqual([
      { action: "grant", privileges: ["execute"], fn: "f", roles: ["service_role"] },
    ]);
  });
  it("detects the default-privilege revoke", () => {
    expect(model.defaultPrivilegeRevokes).toBe(true);
    expect(parseMigrations([TABLE]).defaultPrivilegeRevokes).toBe(false);
  });
});

describe("functions and indexes", () => {
  const sql = `
    create or replace function public.f(p text)
    returns text
    language plpgsql
    security definer
    set search_path = ''
    as $fn$
    begin
      -- grant all on table public.x to anon;
      return p;
    end;
    $fn$;
    create function public.g() returns int language sql as $$ select 1 $$;
    create function public.h() returns int language sql security definer set search_path = public as $$ select 1 $$;
    create unique index x_u on public.x (id, least(a, b));
    create index if not exists x_i on public.x ("from", "to");`;
  const model = parseMigrations([sql]);
  it("parses security mode, search_path and body", () => {
    const f = model.functions.get("f");
    expect(f).toMatchObject({ securityDefiner: true, searchPath: "" });
    expect(f?.body).toContain("return p;");
    expect(model.functions.get("g")).toMatchObject({ securityDefiner: false, searchPath: null });
    expect(model.functions.get("h")).toMatchObject({ securityDefiner: true, searchPath: "public" });
  });
  it("does not treat a statement inside a body as a statement", () => {
    expect(model.tableGrants).toEqual([]);
  });
  it("parses indexes with expressions", () => {
    expect(model.indexes).toEqual([
      { name: "x_u", table: "x", unique: true, columns: ["id", "least(a, b)"] },
      { name: "x_i", table: "x", unique: false, columns: ["from", "to"] },
    ]);
  });
});
