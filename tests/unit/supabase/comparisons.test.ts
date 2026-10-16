import { describe, expect, it } from "vitest";
import { loadModel } from "./migrations";
import { netExecute, netPrivileges } from "./sql-model";

const { model, files, sql } = loadModel();
const table = model.tables.get("comparisons");
const FUNCTIONS = ["create_comparison", "get_comparison"];

describe("comparisons table", () => {
  it("has exactly the agreed columns and nothing personal", () => {
    expect(table?.columns.map((c) => c.name)).toEqual([
      "slug",
      "club_id",
      "start_date",
      "nickname",
      "created_at",
      "expires_at",
    ]);
    const personal = table?.columns.filter(
      (c) => /name|email|birth|ip|user_agent/.test(c.name) && c.name !== "nickname",
    );
    expect(personal).toEqual([]);
  });
  it("is keyed by slug and references clubs", () => {
    expect(table?.primaryKey).toEqual(["slug"]);
    expect(table?.constraints.join(" ")).toMatch(/club_id references public\.clubs/);
  });
  it("expires 90 days after creation by default", () => {
    const col = table?.columns.find((c) => c.name === "expires_at");
    expect(col?.default).toMatch(/interval '90 days'/);
    expect(col?.nullable).toBe(false);
  });
  it("checks the slug format, the nickname length and the expiry window", () => {
    const checks = table?.checks.join(" | ") ?? "";
    expect(checks).toContain("slug ~ '^[A-Za-z0-9_-]{22}$'");
    expect(checks).toMatch(/char_length\(nickname\) between 1 and 24/);
    expect(checks).toMatch(/expires_at > created_at/);
    expect(checks).toMatch(/expires_at <= created_at \+ interval '90 days'/);
  });
  it("has row level security, no policy and no privilege for any role", () => {
    expect(model.rls.has("comparisons")).toBe(true);
    expect(model.policies.filter((p) => p.table === "comparisons")).toEqual([]);
    for (const role of ["anon", "authenticated", "service_role", "public"]) {
      expect([...netPrivileges(model, "comparisons", role)], role).toEqual([]);
    }
  });
  it("is created in its own migration, after the reference tables", () => {
    expect(table?.file).toBeGreaterThan(model.tables.get("clubs")?.file ?? 99);
  });
});

describe.each(FUNCTIONS)("%s", (name) => {
  const fn = model.functions.get(name);
  it("is security definer with an empty search_path", () => {
    expect(fn?.securityDefiner).toBe(true);
    expect(fn?.searchPath).toBe("");
  });
  it("can be executed only by service_role", () => {
    expect([...netExecute(model, name)]).toEqual(["service_role"]);
  });
  it("only uses schema-qualified relations", () => {
    expect(fn?.body).not.toMatch(/\b(from|join|into|update)\s+(?!public\.|extensions\.)[a-z_]+\b/i);
  });
});

describe("get_comparison", () => {
  const body = model.functions.get("get_comparison")?.body ?? "";
  it("returns only the row of one slug, and only while it has not expired", () => {
    expect(body).toMatch(/c\.slug = p_slug/);
    expect(body).toMatch(/c\.expires_at > now\(\)/);
  });
  it("returns nothing for a malformed slug and never selects every column", () => {
    expect(body).toContain("p_slug ~ '^[A-Za-z0-9_-]{22}$'");
    expect(body).not.toContain("*");
  });
});

describe("create_comparison", () => {
  const body = model.functions.get("create_comparison")?.body ?? "";
  it("generates a 128-bit slug in the database", () => {
    expect(body).toContain("extensions.gen_random_bytes(16)");
  });
  it("validates the club, the start date and the nickname, and retries a slug collision", () => {
    expect(body).toMatch(/from public\.clubs/);
    expect(body).toContain("1880-01-01");
    expect(body).toContain("America/Argentina/Buenos_Aires");
    expect(body).toMatch(/unique_violation/);
    expect(body).toMatch(/nullif\(/);
  });
});

describe("expiry purge job", () => {
  const cronFile = files.findIndex((f) => f.endsWith("_comparisons_purge_cron.sql"));
  const statements = model.statements.filter((s) => s.file === cronFile).map((s) => s.text);
  it("lives in its own migration", () => {
    expect(cronFile).toBeGreaterThan(-1);
  });
  it("enables pg_cron", () => {
    expect(statements.join("\n")).toMatch(/create extension if not exists pg_cron/i);
  });
  it("unschedules before it schedules, so re-applying is safe", () => {
    const unschedule = statements.findIndex((s) =>
      /cron\.unschedule\('purge-expired-comparisons'\)/.test(s),
    );
    const schedule = statements.findIndex((s) =>
      /cron\.schedule\('purge-expired-comparisons'/.test(s),
    );
    expect(unschedule).toBeGreaterThan(-1);
    expect(schedule).toBeGreaterThan(unschedule);
  });
  it("deletes only expired comparisons, daily", () => {
    const text = sql[cronFile] ?? "";
    expect(text).toMatch(/'17 6 \* \* \*'/);
    expect(text).toContain("delete from public.comparisons where expires_at <= now()");
    expect(text.match(/delete from/gi)).toHaveLength(1);
  });
});
