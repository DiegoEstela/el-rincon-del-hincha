import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = process.cwd();
const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function run(args: string[]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/ingest/index.ts", ...args], {
    cwd: root,
    encoding: "utf8",
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("pnpm data:ingest (CLI arguments)", () => {
  it("prints usage and exits 1 without an adapter", () => {
    const r = run([]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("Usage: pnpm data:ingest <adapter>");
  });

  it("names the known adapters when the adapter is unknown", () => {
    const r = run(["nope"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('unknown adapter "nope"');
    expect(r.stderr).toContain("openfootball");
  });

  it("fails when --from points to a missing directory", () => {
    const out = mkdtempSync(join(tmpdir(), "cli-out-"));
    temps.push(out);
    cpSync(join(root, "data/clubs.json"), join(out, "clubs.json"));
    const r = run(["openfootball", "--dry-run", "--from", join(out, "missing"), "--out", out]);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/not found/);
    expect(readdirSync(out)).toEqual(["clubs.json"]);
  });

  it("fails when --out points to a missing directory", () => {
    const r = run(["openfootball", "--dry-run", "--out", join(tmpdir(), "does-not-exist-xyz")]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("data directory not found");
  });

  it("dry run against the fixtures lists the unknown clubs and writes nothing", () => {
    const out = mkdtempSync(join(tmpdir(), "cli-out-"));
    temps.push(out);
    cpSync(join(root, "data/clubs.json"), join(out, "clubs.json"));
    const r = run([
      "openfootball",
      "--dry-run",
      "--from",
      join(root, "tests/fixtures/ingest/openfootball"),
      "--out",
      out,
    ]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('unknown club "Arsenal de Sarandí"');
    expect(r.stderr).toContain("data/ was not changed");
    expect(readdirSync(out)).toEqual(["clubs.json"]);
  });
});
