import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { directoryLoader, runAdapter } from "../../../../scripts/ingest/core/adapter";
import { openfootballAdapter } from "../../../../scripts/ingest/openfootball";
import { OPENFOOTBALL_ONLY_GAPS } from "../../../fixtures/ingest/openfootball/gaps";
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
  // A full ingestion formats about 2,400 records with Prettier: slow under coverage instrumentation.
  it("ingests the fixtures with fetch stubbed to throw", { timeout: 60_000 }, async () => {
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
        coverageGaps: OPENFOOTBALL_ONLY_GAPS,
      });
      expect(result.report.files).toHaveLength(8);
      expect(fetchStub).not.toHaveBeenCalled();
    } finally {
      rmSync(inputs, { recursive: true, force: true });
    }
  });
});
