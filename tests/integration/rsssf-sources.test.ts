// Plan 0017: the pinned excerpts in sources/rsssf are intact, hold no cup data, and reproduce the
// RSSSF records that are in data/ byte for byte.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { directoryLoader, runAdapter } from "../../scripts/ingest/core/adapter";
import { rsssfAdapter } from "../../scripts/ingest/rsssf";
import { checkManifest, loadManifest } from "../../scripts/ingest/rsssf/manifest";

const SOURCES = join(process.cwd(), "sources/rsssf");
const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

describe("sources/rsssf", () => {
  const manifest = loadManifest(SOURCES);

  it("has excerpts that match the manifest and nothing else in them", () => {
    expect(checkManifest(manifest, SOURCES)).toEqual([]);
  });

  it("lists only pages of the Argentine first division, with an author each", () => {
    for (const page of manifest.pages) {
      expect(page.url).toMatch(/^https:\/\/www\.rsssf\.org\/tablesa\/arg(?:\d+|champ)\.html$/);
      expect(page.authors.length).toBeGreaterThan(0);
    }
  });

  it("holds only the excerpts that are listed: the first division and the domestic cups", () => {
    // Anything else on a page (lower divisions, national teams, the Copa de la Liga until its
    // layout exists) stays out. The names are the anchors of the pages.
    const LISTED: Record<string, string[]> = {
      arg2023: ["leaguesuper", "lpfsuper", "nationalcup", "supercup"],
      arg2024: ["leaguesuper", "lpfsuper", "nationalcup", "supercup"],
      arg2025: ["1apertura", "1clausura", "1champtroph", "lpfsuper", "nationalcup"],
      argchamp: ["champions"],
    };
    const found = Object.fromEntries(
      manifest.pages.map((p) => [
        p.url.split("/").pop()!.replace(".html", ""),
        p.excerpts.map((e) => e.name),
      ]),
    );
    expect(found).toEqual(LISTED);
    // Lower divisions and the national teams never appear in an excerpt.
    const forbidden =
      /primera nacional|primera b|torneo federal|national teams|libertadores(?! de am)|sudamericana/i;
    for (const file of readdirSync(SOURCES).filter((f) => f.endsWith(".txt"))) {
      const text = readFileSync(join(SOURCES, file)).toString("latin1");
      expect(text, file).not.toMatch(forbidden);
    }
  });

  it("reproduces the RSSSF records of data/ exactly", { timeout: 120_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "rsssf-real-"));
    temps.push(dir);
    cpSync(join(process.cwd(), "data"), dir, { recursive: true });
    const result = await runAdapter(rsssfAdapter, {
      dir,
      loader: directoryLoader(SOURCES),
      now: new Date("2026-10-23T12:00:00Z"),
    });
    for (const file of ["matches.json", "seasons.json", "standings.json"]) {
      expect(result.summary[file], file).toMatchObject({ added: 0, removed: 0 });
    }
    expect(result.report.files.map((f) => [f.file, f.parsed])).toEqual([
      ["arg2025.1apertura", 15],
      ["arg2025.1clausura", 255],
      ["arg2023.nationalcup", 60],
      ["arg2024.nationalcup", 60],
      ["arg2025.nationalcup", 62],
      ["arg2023.leaguesuper", 1],
      ["arg2024.leaguesuper", 1],
      ["arg2025.1champtroph", 1],
      ["arg2023.supercup", 1],
      ["arg2024.supercup", 1],
      ["arg2023.lpfsuper", 1],
      ["arg2024.lpfsuper", 1],
      ["arg2025.lpfsuper", 1],
    ]);
    // The only unresolved names left are clubs that never play one of the 34.
    const dropped = result.report.files.flatMap((f) => f.droppedUnknown ?? []);
    expect(dropped.sort()).toEqual(["CA Nueva Chicago", "CD Maipú"]);
  });
});
