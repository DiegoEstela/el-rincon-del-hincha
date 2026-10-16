import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase", "checks", "verify.sql"), "utf8");
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .trim();

// The Supabase SQL Editor shows only the result of the last statement. verify.sql is therefore one
// DO block that always ends by raising an exception carrying the whole report: the exception aborts
// the statement, which rolls back everything it did, and the editor shows the message.
const CHECK_NAMES = [
  "tables without RLS",
  "policies on public tables",
  "anon or authenticated can write: ",
  "role can touch comparisons: ",
  "service_role can select comparisons",
  "execute ",
  "anon can read clubs",
  "anon insert into clubs",
  "anon truncate clubs",
  "anon reads comparisons",
  "anon calls get_comparison",
  "service_role reads comparisons directly",
  "create_comparison returns a 22 character slug",
  "get_comparison finds it",
  "get_comparison with a malformed slug",
  "nickname is trimmed",
];

describe("supabase/checks/verify.sql", () => {
  it("is a single do block, so there is no transaction to forget to roll back", () => {
    expect(code.startsWith("do $verify$")).toBe(true);
    expect(code.endsWith("$verify$;")).toBe(true);
    expect(code.match(/\$verify\$/g)).toHaveLength(2);
    expect(code).not.toMatch(/^\s*(begin|start transaction)\s*;/im);
    expect(code).not.toMatch(/\b(commit|rollback|savepoint)\b/i);
  });
  it("always finishes by raising an exception with the full report", () => {
    expect(code.match(/raise exception/gi)).toHaveLength(1);
    expect(code).toMatch(/raise exception[^;]*;\s*end\s+\$verify\$;$/i);
    expect(code).toMatch(/array_to_string\(v_lines/);
  });
  it("reports one OK or FAIL line per check", () => {
    expect(code).toMatch(/'OK'/);
    expect(code).toMatch(/'FAIL'/);
    expect(code).toMatch(/not like 'OK %'/);
  });
  it("covers every check by name", () => {
    for (const name of CHECK_NAMES) expect(code, name).toContain(name);
  });
  it("never changes schema objects or switches role for the rest of the session", () => {
    expect(code).not.toMatch(/\b(drop|alter|create)\s/i);
    expect(code).not.toMatch(/\bset\s+role\b/i);
    expect(code).toMatch(/set local role/);
    // The one truncate is attempted as anon and must be refused.
    expect(code.match(/\btruncate\s+public/gi)).toHaveLength(1);
  });
  it("checks RLS, policies, privileges and the roles' behavior", () => {
    expect(code).toMatch(/relrowsecurity = false/);
    expect(code).toMatch(/pg_policies/);
    expect(code).toMatch(/has_table_privilege\('anon'/);
    expect(code).toMatch(/has_table_privilege\('service_role', 'public\.comparisons', 'SELECT'\)/);
    expect(code).toMatch(/insufficient_privilege/);
    expect(code).toMatch(/'service_role'/);
    expect(code).toMatch(/public\.create_comparison\(/);
    expect(code).toMatch(/public\.get_comparison\(/);
  });
  it("compares the policy role set without depending on its order", () => {
    expect(code).not.toMatch(/roles::text\[\]\s*=/);
    expect(code).toMatch(/roles::text\[\] <@ array\['anon', 'authenticated'\]/);
    expect(code).toMatch(/roles::text\[\] @> array\['anon', 'authenticated'\]/);
  });
  it("documents the expected result of every check and how to read the output", () => {
    expect(sql.match(/^-- .*Expected:/gm)?.length).toBeGreaterThanOrEqual(6);
    expect(sql).toMatch(/the error message IS the report/i);
    expect(sql).toMatch(/pgcrypto/);
    expect(sql).toMatch(/extensions schema/);
  });
});
