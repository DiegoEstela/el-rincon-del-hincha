import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function runCli(dir: string) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/validate-data.ts", `tests/fixtures/data-validate/${dir}`],
    { cwd: root, encoding: "utf8" },
  );
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("pnpm data:validate (CLI)", () => {
  it("passes on an empty directory with 0 files", () => {
    const r = runCli("empty");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("0 file(s)");
  });

  it("passes on the valid synthetic dataset", () => {
    const r = runCli("valid");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("data:validate ok (9 file(s) checked)");
  });

  it("strips a UTF-8 BOM before parsing", () => {
    const r = runCli("bom");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("1 file(s)");
  });

  it("fails on invalid data and lists each issue", () => {
    const r = runCli("invalid");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("[duplicate-match] matches.json#m1-copy:");
    expect(r.stderr).toContain("[missing-source] clubs.json#club-a:");
  });

  it("fails with a friendly message when the directory does not exist", () => {
    const r = runCli("does-not-exist");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("directory not found");
    expect(r.stderr).not.toContain("ENOENT");
    expect(r.stderr).not.toMatch(/at .*\.ts:\d+/);
  });

  it("fails on broken JSON with invalid-json", () => {
    const r = runCli("broken-json");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("[invalid-json] clubs.json");
  });

  it("names the club and the field for a missing source and an invalid jersey pattern", () => {
    const r = runCli("clubs-invalid");
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("[missing-source] clubs.json#club-sin-fuente:");
    expect(r.stderr).toContain("[schema] clubs.json#club-patron-invalido: jersey_pattern:");
    expect(r.stderr).toContain("data:validate failed: 2 issue(s)");
  });
});
