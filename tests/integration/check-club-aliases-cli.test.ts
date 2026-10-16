import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("check-club-aliases (CLI)", () => {
  it("prints a friendly message and exits with code 2 when the CSV is missing", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/check-club-aliases.ts", "tools/does-not-exist.csv"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("CSV not found: it is a local-only file under tools/");
    expect(result.stderr).not.toContain("ENOENT");
  });
});
