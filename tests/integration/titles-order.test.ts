// Plan 0017, T20: both adapters write titles (openfootball from a final, RSSSF from the list of
// champions). They own different sources, so the order of the runs must not matter, and a second
// run must not change a byte.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { directoryLoader, runAdapter } from "../../scripts/ingest/core/adapter";
import { openfootballAdapter } from "../../scripts/ingest/openfootball";
import { rsssfAdapter } from "../../scripts/ingest/rsssf";

const NOW = new Date("2026-10-23T12:00:00Z");
const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function freshData(): string {
  const dir = mkdtempSync(join(tmpdir(), "titles-order-"));
  temps.push(dir);
  cpSync(join(process.cwd(), "data"), dir, { recursive: true });
  writeFileSync(join(dir, "titles.json"), "[]\n");
  return dir;
}
const runOpenfootball = (dir: string) =>
  runAdapter(openfootballAdapter, {
    dir,
    loader: directoryLoader(join(process.cwd(), "tests/fixtures/ingest/openfootball")),
    now: NOW,
  });
const runRsssf = (dir: string) =>
  runAdapter(rsssfAdapter, {
    dir,
    loader: directoryLoader(join(process.cwd(), "sources/rsssf")),
    now: NOW,
  });
const titles = (dir: string) => readFileSync(join(dir, "titles.json"), "utf8");

describe("titles written by two adapters", () => {
  it(
    "are the same whichever adapter runs first, and the same as data/",
    { timeout: 180_000 },
    async () => {
      const a = freshData();
      await runOpenfootball(a);
      await runRsssf(a);
      const b = freshData();
      await runRsssf(b);
      await runOpenfootball(b);
      expect(titles(a)).toBe(titles(b));
      expect(titles(a)).toBe(readFileSync(join(process.cwd(), "data/titles.json"), "utf8"));
      expect(JSON.parse(titles(a))).toHaveLength(9);
    },
  );

  it("do not change on a second run", { timeout: 180_000 }, async () => {
    const dir = freshData();
    await runOpenfootball(dir);
    await runRsssf(dir);
    const first = titles(dir);
    const again = await runRsssf(dir);
    expect(again.summary["titles.json"]).toMatchObject({ added: 0, removed: 0 });
    expect(titles(dir)).toBe(first);
  });

  it(
    "date a title from the matches of this run, not from a stale record of the adapter",
    { timeout: 180_000 },
    async () => {
      const dir = freshData();
      // A stale RSSSF match dated later than the real last match of the 2025 Clausura.
      const matches = JSON.parse(readFileSync(join(dir, "matches.json"), "utf8")) as {
        id: string;
        source: string;
        date: string;
      }[];
      const last = matches.filter((m) => m.source.includes("#1clausura")).at(-1)!;
      matches.push({ ...last, id: "2026-03-01-stale-stale", date: "2026-03-01" });
      writeFileSync(join(dir, "matches.json"), JSON.stringify(matches));
      await runRsssf(dir);
      const clausura = (
        JSON.parse(titles(dir)) as { season_id: string; awarded_on: string }[]
      ).find((t) => t.season_id === "primera-division-2025-clausura");
      expect(clausura?.awarded_on).toBe("2025-12-14");
    },
  );
});
