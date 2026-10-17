import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { directoryLoader, runAdapter } from "../../../../scripts/ingest/core/adapter";
import { openfootballAdapter } from "../../../../scripts/ingest/openfootball";
import { FIXTURE_CLUBS } from "../../../fixtures/ingest/openfootball/clubs";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nonet-"));
  writeFileSync(join(dir, "clubs.json"), JSON.stringify(FIXTURE_CLUBS));
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe("tests never touch the network", () => {
  it("ingests the fixtures with fetch stubbed to throw", async () => {
    const fetchStub = vi.fn(() => {
      throw new Error("network access in a test");
    });
    vi.stubGlobal("fetch", fetchStub);
    const inputs = mkdtempSync(join(tmpdir(), "nonet-in-"));
    try {
      cpSync(join(process.cwd(), "tests/fixtures/ingest/openfootball"), inputs, {
        recursive: true,
      });
      const result = await runAdapter(openfootballAdapter, {
        dir,
        loader: directoryLoader(inputs),
        now: new Date("2026-10-17T12:00:00Z"),
      });
      expect(result.report.files).toHaveLength(8);
      expect(fetchStub).not.toHaveBeenCalled();
    } finally {
      rmSync(inputs, { recursive: true, force: true });
    }
  });
});
