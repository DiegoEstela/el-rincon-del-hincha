import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkManifest,
  excerptFileName,
  manifestSchema,
  type Manifest,
} from "../../../../../scripts/ingest/rsssf/manifest";

const sha = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const TEXT = '<a name="1apertura">\nRound 1\n';

const page = (extra: Record<string, unknown> = {}) => ({
  url: "https://www.rsssf.org/tablesa/arg2019.html",
  retrieved_on: "2026-10-19",
  sha256: sha("whole page"),
  bytes: 10,
  encoding: "windows-1252",
  authors: ["Osvaldo José Gorgazzi"],
  last_updated: "18 Mar 2021",
  layout: "full-names-2017",
  excerpts: [
    {
      name: "1apertura",
      start: '<a name="1apertura">',
      end: '<a name="2">',
      sha256: sha(TEXT),
    },
  ],
  ignore: [],
  variants: [],
  tableExceptions: [],
  ...extra,
});
const manifest = (pages = [page()]) => ({ version: 1, pages });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rsssf-manifest-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const writeExcerpt = (text: string | Uint8Array, name = "arg2019.1apertura.txt") =>
  writeFileSync(join(dir, name), text);

describe("manifestSchema (plan 0017, T9)", () => {
  it("accepts a well-formed manifest", () => {
    expect(manifestSchema.safeParse(manifest()).success).toBe(true);
  });

  it("rejects URLs outside www.rsssf.org/tablesa", () => {
    for (const url of [
      "http://www.rsssf.org/tablesa/arg2019.html",
      "https://rsssf.org/tablesa/arg2019.html",
      "https://www.rsssf.org/tablesb/arg2019.html",
      "https://www.rsssf.org/tablesa/Arg2019.html",
      "https://www.rsssf.org/tablesa/arg2019.html?x=1",
      "https://evil.org/tablesa/arg2019.html",
    ]) {
      expect(manifestSchema.safeParse(manifest([page({ url })])).success, url).toBe(false);
    }
  });

  it("rejects a bad date, hash, layout, empty authors or an excerpt without markers", () => {
    const bad = [
      { retrieved_on: "19/10/2026" },
      { sha256: "abc" },
      { layout: "mystery" },
      { authors: [] },
      { excerpts: [{ name: "x", start: "", end: "e", sha256: sha("x") }] },
      { excerpts: [{ name: "x", start: "s", end: "e", sha256: "nope" }] },
      { encoding: "utf-16" },
    ];
    for (const extra of bad) {
      expect(manifestSchema.safeParse(manifest([page(extra)])).success).toBe(false);
    }
  });

  it("rejects unknown keys, so a typo cannot hide", () => {
    expect(manifestSchema.safeParse(manifest([page({ authorz: [] })])).success).toBe(false);
  });
});

describe("excerptFileName", () => {
  it("is the page name, the excerpt name and .txt", () => {
    expect(excerptFileName("https://www.rsssf.org/tablesa/arg2019.html", "1apertura")).toBe(
      "arg2019.1apertura.txt",
    );
  });
});

describe("checkManifest (plan 0017, T9)", () => {
  const ok = () => manifestSchema.parse(manifest()) as Manifest;

  it("passes when the excerpt exists and matches its hash", () => {
    writeExcerpt(TEXT);
    expect(checkManifest(ok(), dir)).toEqual([]);
  });

  it("reports a missing excerpt file", () => {
    expect(checkManifest(ok(), dir)).toEqual([
      expect.stringMatching(/arg2019\.1apertura\.txt.*missing/),
    ]);
  });

  it("reports a changed excerpt, naming both hashes", () => {
    writeExcerpt(TEXT + "tampered");
    expect(checkManifest(ok(), dir)[0]).toMatch(/sha256 mismatch/);
  });

  it("reports mailto and the About this document block", () => {
    const text = '<a name="1apertura">\n<a href="mailto:x@y.z">x</a>\nAbout this document\n';
    const m = manifestSchema.parse(
      manifest([
        page({ excerpts: [{ name: "1apertura", start: "s", end: "e", sha256: sha(text) }] }),
      ]),
    );
    writeExcerpt(text);
    const problems = checkManifest(m, dir);
    expect(problems.some((p) => /mailto/.test(p))).toBe(true);
    expect(problems.some((p) => /About this document/i.test(p))).toBe(true);
  });

  it("reports an anchor that is not one of its own markers", () => {
    const text = '<a name="1apertura">\nx\n<a name="copa-argentina">\n';
    const m = manifestSchema.parse(
      manifest([
        page({
          excerpts: [
            { name: "1apertura", start: '<a name="1apertura">', end: "e", sha256: sha(text) },
          ],
        }),
      ]),
    );
    writeExcerpt(text);
    expect(checkManifest(m, dir)).toEqual([expect.stringMatching(/copa-argentina/)]);
  });

  it("reports a manifest not sorted by URL, and a duplicated URL", () => {
    const a = page({ url: "https://www.rsssf.org/tablesa/arg2025.html" });
    const b = page();
    const unsorted = manifestSchema.parse(manifest([a, b]));
    expect(checkManifest(unsorted, dir).some((p) => /sorted by url/i.test(p))).toBe(true);
    const dup = manifestSchema.parse(manifest([b, b]));
    expect(checkManifest(dup, dir).some((p) => /duplicate/i.test(p))).toBe(true);
  });

  it("reports duplicated excerpt names inside a page", () => {
    const e = { name: "1apertura", start: "s", end: "e", sha256: sha(TEXT) };
    const m = manifestSchema.parse(manifest([page({ excerpts: [e, e] })]));
    writeExcerpt(TEXT);
    expect(checkManifest(m, dir).some((p) => /duplicate excerpt/i.test(p))).toBe(true);
  });

  it("checks a directory that does not exist as missing files", () => {
    mkdirSync(join(dir, "sub"));
    expect(checkManifest(ok(), join(dir, "nope"))[0]).toMatch(/missing/);
  });
});
