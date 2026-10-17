import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as prettier from "prettier";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "coverage-"));
  for (const f of ["clubs", "competitions", "seasons", "matches"]) {
    cpSync(join(root, "data", `${f}.json`), join(dir, `${f}.json`));
  }
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]) {
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/generate-coverage.ts", ...args],
    { cwd: root, encoding: "utf8" },
  );
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("pnpm data:coverage (CLI)", () => {
  it("writes a Prettier-stable coverage.json and leaves it alone the second time", async () => {
    const first = run([dir]);
    expect(first.code).toBe(0);
    expect(first.stdout).toContain("coverage.json written");
    const text = readFileSync(join(dir, "coverage.json"), "utf8");
    expect(await prettier.check(text, { parser: "json", printWidth: 100 })).toBe(true);
    const mtime = statSync(join(dir, "coverage.json")).mtimeMs;

    await new Promise((r) => setTimeout(r, 25));
    const second = run([dir]);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain("unchanged");
    expect(readFileSync(join(dir, "coverage.json"), "utf8")).toBe(text);
    expect(statSync(join(dir, "coverage.json")).mtimeMs).toBe(mtime);
  }, 60_000);

  it("--check passes when the file is up to date and fails, writing nothing, when it is not", () => {
    expect(run([dir]).code).toBe(0);
    expect(run([dir, "--check"]).code).toBe(0);
    const stale = readFileSync(join(dir, "coverage.json"), "utf8").replace(
      '"complete": true',
      '"complete": false',
    );
    writeFileSync(join(dir, "coverage.json"), stale);
    const check = run([dir, "--check"]);
    expect(check.code).toBe(1);
    expect(check.stderr).toContain("out of date");
    expect(readFileSync(join(dir, "coverage.json"), "utf8")).toBe(stale);
  }, 60_000);

  it("--check fails when there is no file", () => {
    const check = run([dir, "--check"]);
    expect(check.code).toBe(1);
    expect(existsSync(join(dir, "coverage.json"))).toBe(false);
  });

  it("fails and writes nothing when a season is partial and its tail is not a declared gap", () => {
    const seasons = JSON.parse(readFileSync(join(dir, "seasons.json"), "utf8")) as {
      id: string;
      end: string;
    }[];
    seasons.find((s) => s.id === "primera-division-2024")!.end = "2025-03-31";
    writeFileSync(join(dir, "seasons.json"), JSON.stringify(seasons));
    const r = run([dir]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("primera-division-2024");
    expect(existsSync(join(dir, "coverage.json"))).toBe(false);
  });

  it("fails on a directory that does not exist", () => {
    const r = run([join(dir, "missing")]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not found");
  });
});
