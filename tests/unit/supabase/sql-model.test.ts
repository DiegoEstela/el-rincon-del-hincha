import { describe, expect, it } from "vitest";
import { enumValues, netExecute, netPrivileges, parseMigrations } from "./sql-model";

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
  it("records default privileges by object kind, privileges and roles", () => {
    expect(model.defaultPrivileges).toEqual([
      {
        action: "revoke",
        privileges: ["all"],
        objects: "tables",
        roles: ["anon", "authenticated"],
      },
    ]);
    expect(parseMigrations([TABLE]).defaultPrivileges).toEqual([]);
    const m = parseMigrations([
      "alter default privileges for role postgres in schema public revoke execute on functions from public;",
    ]);
    expect(m.defaultPrivileges).toEqual([
      { action: "revoke", privileges: ["execute"], objects: "functions", roles: ["public"] },
    ]);
  });
});

describe("statement allowlist", () => {
  const unknown = (sql: string) => parseMigrations([sql]).unrecognized.map((s) => s.text);
  it("recognizes every statement shape the migrations use", () => {
    const ok = `${TABLE}
      create index i on public.x (id);
      create unique index u on public.x (id);
      create policy p on public.x for select to anon using (true);
      create function public.f() returns int language sql as $$ select 1 $$;
      create extension if not exists pgcrypto with schema extensions;
      alter table public.x enable row level security;
      grant select on table public.x to anon;
      revoke all on table public.x from anon;
      alter default privileges for role postgres in schema public revoke all on tables from anon;
      select cron.schedule('j', '* * * * *', $$select 1$$);`;
    expect(unknown(ok)).toEqual([]);
    expect(parseMigrations([ok]).extensions).toEqual(["pgcrypto"]);
  });
  it.each([
    ["a view", "create view public.v as select 1"],
    ["an insert", "insert into public.x values (1)"],
    ["a drop", "drop table public.x"],
    ["a plain select", "select 1"],
    ["a non-cron select", "select pg_sleep(1)"],
    ["an alter table of an unknown table", "alter table public.x add column y text"],
    ["an alter table that drops a column", "alter table public.clubs drop column city"],
    [
      "a default privilege grant",
      "alter default privileges in schema public grant all on tables to anon",
    ],
    ["a trigger", "create trigger t before insert on public.x execute function public.f()"],
    ["a do block", "do $$ begin null; end $$"],
  ])("reports %s as unrecognized", (_label, sql) => {
    const found = unknown(sql);
    expect(found).toHaveLength(1);
    expect(found[0]!.split(" ")[0]).toBe(sql.split(" ")[0]);
  });
  it.each([
    ["unschedule with a second function call", "select cron.unschedule('x'), public.evil()"],
    ["schedule with a trailing select list item", "select cron.schedule('j', '* * * * *', 'x'), 1"],
    ["a cron call followed by a trailing token", "select cron.unschedule('x') from public.clubs"],
    ["a nested function call as argument", "select cron.unschedule(public.evil())"],
    ["a cron call with a second call after it", "select cron.unschedule('x') union select 1"],
    ["an unknown cron function", "select cron.alter_job(1)"],
  ])("reports %s as unrecognized", (_label, sql) => {
    expect(unknown(sql)).toHaveLength(1);
  });
  it("accepts the two exact cron call shapes", () => {
    expect(unknown("select cron.unschedule('x')")).toEqual([]);
    expect(
      unknown(
        "select cron.unschedule('x') where exists (select 1 from cron.job where jobname = 'x')",
      ),
    ).toEqual([]);
    expect(unknown("select cron.schedule('j', '1 * * * *', $$select 1$$)")).toEqual([]);
  });
  it.each([
    [
      "an E string",
      "select cron.unschedule(E'\\''); grant insert on public.clubs to anon; select cron.unschedule('')",
    ],
    [
      "a lowercase e string",
      "select cron.unschedule(e'\\''); grant insert on public.clubs to anon;",
    ],
  ])("refuses %s, whose escapes it cannot model", (_label, sql) => {
    expect(() => parseMigrations([sql])).toThrow(/escape/i);
  });
  it("treats a backslash in a standard string as a literal, so a grant after it is still seen", () => {
    const m = parseMigrations([
      "select cron.unschedule('a\\'); grant insert on public.clubs to anon; select cron.unschedule('b')",
    ]);
    expect(m.tableGrants.map((g) => g.table)).toEqual(["clubs"]);
  });
  describe("dollar-quote tags follow the PostgreSQL grammar", () => {
    const bypass = (tag: string) =>
      [
        `create policy zz on comparisons for select to service_role using (slug = ${tag} ' ${tag});`,
        "grant insert, update, delete on comparisons to anon;",
        "create policy zy on comparisons for select to service_role using (slug = 'x');",
      ].join("\n");
    it.each([["$a1$"], ["$é$"], ["$t2x$"], ["$_9$"]])(
      "hides a body delimited by %s, so the grant after a lone quote is still seen",
      (tag) => {
        const m = parseMigrations([bypass(tag)]);
        expect(m.tableGrants.map((g) => g.table)).toEqual(["comparisons"]);
        expect(m.unrecognized).toEqual([]);
      },
    );
    it.each([
      ["select $x from t;"],
      ["select $ from t;"],
      ["select $a1 ' ; grant all on t to anon;"],
    ])("refuses a stray dollar it cannot read: %s", (sql) => {
      expect(() => parseMigrations([sql])).toThrow(/dollar/i);
    });
    it("still parses positional parameters, $$ and named bodies", () => {
      const sql = [
        "create function public.f(a int) returns int language sql as $$ select $1 + $2 $$;",
        "create function public.g() returns int language sql as $body$ select 1 $body$;",
      ].join("\n");
      const m = parseMigrations([sql]);
      expect(m.unrecognized).toEqual([]);
    });
  });
  it("records disable and force row level security explicitly", () => {
    const m = parseMigrations([
      `${TABLE} alter table public.x disable row level security; alter table public.x force row level security;`,
    ]);
    expect(m.rlsDisabled.get("x")).toBe(0);
    expect(m.rlsForced.get("x")).toBe(0);
    expect(m.unrecognized).toEqual([]);
    expect(m.rls.has("x")).toBe(false);
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

describe("function execute privileges", () => {
  const f = "create function public.f() returns int language sql as $$ select 1 $$;";
  it("starts with execute for public, as Postgres does", () => {
    expect([...netExecute(parseMigrations([f]), "f")]).toEqual(["public"]);
  });
  it("applies revokes and grants in order", () => {
    const sql = `${f}
      revoke all on function public.f() from public, anon, authenticated;
      grant execute on function public.f() to service_role;`;
    expect([...netExecute(parseMigrations([sql]), "f")]).toEqual(["service_role"]);
  });
  it("keeps a grant that comes after the revoke", () => {
    const sql = `${f} revoke all on function public.f() from public; grant execute on function public.f() to anon;`;
    expect([...netExecute(parseMigrations([sql]), "f")]).toEqual(["anon"]);
  });
});

describe("alter table folded into the table", () => {
  const create = "create table public.t (id text primary key, v integer not null)";
  it("adds a nullable column, drops a not null and adds a check", () => {
    const model = parseMigrations([
      `${create};
alter table public.t add column w text;
alter table public.t alter column v drop not null;
alter table public.t add constraint t_w check (w is null or w <> '');`,
    ]);
    const table = model.tables.get("t")!;
    expect(table.columns.map((c) => [c.name, c.type, c.nullable])).toEqual([
      ["id", "text", false],
      ["v", "integer", true],
      ["w", "text", true],
    ]);
    expect(table.checks).toEqual(["w is null or w <> ''"]);
    expect(model.unrecognized).toEqual([]);
  });
  it("fails loudly on a drop not null of a column that does not exist", () => {
    expect(() =>
      parseMigrations([
        `${create};
alter table public.t alter column q drop not null;`,
      ]),
    ).toThrow(/unknown column/);
  });
});
