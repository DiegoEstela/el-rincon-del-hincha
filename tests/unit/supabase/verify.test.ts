import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase", "checks", "verify.sql"), "utf8");
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("supabase/checks/verify.sql", () => {
  it("runs inside a transaction that is always rolled back", () => {
    const lines = code
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    expect(lines[0]).toBe("begin;");
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(code).not.toMatch(/\bcommit\b/i);
  });
  it("never changes schema objects", () => {
    expect(code).not.toMatch(/\b(drop|alter|create|truncate)\s/i);
  });
  it("checks RLS, policies, privileges and the roles' behavior", () => {
    expect(code).toMatch(/relrowsecurity = false/);
    expect(code).toMatch(/pg_policies/);
    expect(code).toMatch(/has_table_privilege\('anon'/);
    expect(code).toMatch(/has_table_privilege\('service_role', 'public\.comparisons', 'SELECT'\)/);
    expect(code).toMatch(/set local role anon;/);
    expect(code).toMatch(/insufficient_privilege/);
    expect(code).toMatch(/set local role service_role;/);
    expect(code).toMatch(/public\.create_comparison\(/);
    expect(code).toMatch(/public\.get_comparison\(/);
  });
  it("documents the expected result of every check", () => {
    expect(sql.match(/-- Expected:/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
