import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SNAPSHOT_USER_AGENT, runSnapshot } from "../../../../../scripts/ingest/rsssf/snapshot";

const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const URL_A = "https://www.rsssf.org/tablesa/arg2019.html";
const URL_B = "https://www.rsssf.org/tablesa/arg2025.html";
const NOW = new Date("2026-10-20T10:00:00Z");

/** A page as RSSSF would serve it: windows-1252 bytes with an author and a last update. */
const pageBytes = (body: string, updated = "18 Mar 2021") =>
  Uint8Array.from(
    Buffer.from(
      `<html><body>Last updated: ${updated}\n<pre>\n<a name="a1">\n${body}\n<a name="a2">\nrest\n</pre>\nOsvaldo José Gorgazzi</body></html>`,
      "latin1",
    ),
  );
const EXCERPT = (body: string) => `<a name="a1">\n${body}\n`;

const entry = (url: string, bytes: Uint8Array, body: string) => ({
  url,
  retrieved_on: "2026-10-01",
  sha256: sha(bytes),
  bytes: bytes.length,
  encoding: "windows-1252",
  authors: ["Osvaldo José Gorgazzi"],
  last_updated: "18 Mar 2021",
  layout: "full-names-2017",
  excerpts: [
    { name: "main", start: '<a name="a1">', end: '<a name="a2">', sha256: sha(EXCERPT(body)) },
  ],
  ignore: [],
  variants: [],
  tableExceptions: [],
});

let dir: string;
const writeManifest = (pages: unknown[]) =>
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, pages }));
const writeExcerpt = (file: string, body: string) => writeFileSync(join(dir, file), EXCERPT(body));
const readManifest = () => JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rsssf-snap-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function harness(responses: Record<string, Uint8Array | number>) {
  const calls: { url: string; at: number; ua: string | undefined }[] = [];
  let clock = 0;
  return {
    calls,
    options: {
      dir,
      now: NOW,
      delayMs: 5000,
      sleep: async (ms: number) => {
        clock += ms;
      },
      fetchImpl: async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          at: clock,
          ua: (init?.headers as Record<string, string> | undefined)?.["user-agent"],
        });
        const r = responses[url];
        if (typeof r === "number") return new Response("", { status: r });
        return new Response(r as BodyInit);
      },
    },
  };
}

describe("runSnapshot (plan 0017, T11)", () => {
  const oldA = pageBytes("old");
  const newA = pageBytes("new", "2 Oct 2026");

  it("does nothing for a page that has not changed", async () => {
    writeManifest([entry(URL_A, oldA, "old")]);
    writeExcerpt("arg2019.main.txt", "old");
    const h = harness({ [URL_A]: oldA });
    const result = await runSnapshot(h.options);
    expect(result).toEqual({ changed: [], written: [] });
  });

  it("rewrites a changed page: excerpt, hashes, date and last update", async () => {
    writeManifest([entry(URL_A, oldA, "old")]);
    writeExcerpt("arg2019.main.txt", "old");
    const result = await runSnapshot(harness({ [URL_A]: newA }).options);
    expect(result.changed).toEqual([URL_A]);
    expect(readFileSync(join(dir, "arg2019.main.txt"), "latin1")).toBe(EXCERPT("new"));
    const page = readManifest().pages[0];
    expect(page).toMatchObject({
      sha256: sha(newA),
      bytes: newA.length,
      retrieved_on: "2026-10-20",
      last_updated: "2 Oct 2026",
    });
    expect(page.excerpts[0].sha256).toBe(sha(EXCERPT("new")));
  });

  it("with check only lists the changed pages and writes nothing", async () => {
    writeManifest([entry(URL_A, oldA, "old")]);
    writeExcerpt("arg2019.main.txt", "old");
    const before = readFileSync(join(dir, "manifest.json"), "utf8");
    const result = await runSnapshot({ ...harness({ [URL_A]: newA }).options, check: true });
    expect(result).toEqual({ changed: [URL_A], written: [] });
    expect(readFileSync(join(dir, "manifest.json"), "utf8")).toBe(before);
    expect(readFileSync(join(dir, "arg2019.main.txt"), "latin1")).toBe(EXCERPT("old"));
  });

  it("requests one page at a time, at least 5 seconds apart, with a neutral user agent", async () => {
    const oldB = pageBytes("b");
    writeManifest([entry(URL_A, oldA, "old"), entry(URL_B, oldB, "b")]);
    const h = harness({ [URL_A]: oldA, [URL_B]: oldB });
    await runSnapshot(h.options);
    expect(h.calls.map((c) => c.at)).toEqual([0, 5000]);
    for (const call of h.calls) {
      expect(call.ua).toBe(SNAPSHOT_USER_AGENT);
      expect(call.ua).not.toContain("@");
    }
  });

  it("leaves every file unchanged when one fetch fails", async () => {
    const oldB = pageBytes("b");
    writeManifest([entry(URL_A, oldA, "old"), entry(URL_B, oldB, "b")]);
    writeExcerpt("arg2019.main.txt", "old");
    const before = readdirSync(dir).sort();
    const manifestBefore = readFileSync(join(dir, "manifest.json"), "utf8");
    await expect(runSnapshot(harness({ [URL_A]: newA, [URL_B]: 500 }).options)).rejects.toThrow(
      /status 500/,
    );
    expect(readdirSync(dir).sort()).toEqual(before);
    expect(readFileSync(join(dir, "manifest.json"), "utf8")).toBe(manifestBefore);
    expect(readFileSync(join(dir, "arg2019.main.txt"), "latin1")).toBe(EXCERPT("old"));
  });

  it("fails when a listed author is not on the page", async () => {
    const stranger = Uint8Array.from(
      Buffer.from('Last updated: 1 Jan 2026\n<a name="a1">\nx\n<a name="a2">', "latin1"),
    );
    writeManifest([entry(URL_A, oldA, "old")]);
    await expect(runSnapshot(harness({ [URL_A]: stranger }).options)).rejects.toThrow(/author/i);
  });

  it("fails when the page shows no last update", async () => {
    const noDate = Uint8Array.from(
      Buffer.from('<a name="a1">\nx\n<a name="a2">\nOsvaldo José Gorgazzi', "latin1"),
    );
    writeManifest([entry(URL_A, oldA, "old")]);
    await expect(runSnapshot(harness({ [URL_A]: noDate }).options)).rejects.toThrow(/last update/i);
  });

  it("fails when a marker is gone from the page, writing nothing", async () => {
    const noMarker = Uint8Array.from(
      Buffer.from("Last updated: 1 Jan 2026\nOsvaldo José Gorgazzi", "latin1"),
    );
    writeManifest([entry(URL_A, oldA, "old")]);
    writeExcerpt("arg2019.main.txt", "old");
    await expect(runSnapshot(harness({ [URL_A]: noMarker }).options)).rejects.toThrow(
      /start marker/,
    );
    expect(readFileSync(join(dir, "arg2019.main.txt"), "latin1")).toBe(EXCERPT("old"));
  });

  it("fails on an invalid manifest", async () => {
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 2, pages: [] }));
    await expect(runSnapshot(harness({}).options)).rejects.toThrow();
  });
});
