// The reviewed manifest of the RSSSF pages in use (plan 0017, ADR 0020 decisions 1 and 2). It pins
// every page by sha256 and every excerpt we keep by sha256, and carries the reviewed lists the
// parsers need (ignored lines, accepted spelling variants, table exceptions).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const RSSSF_LAYOUTS = [
  "round-colon-1950s",
  "tabbed-scorers-1970s",
  "plain-2000s",
  "full-names-2017",
  "table-only",
  "champions-list",
] as const;

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const excerptSchema = z.strictObject({
  name: z.string().regex(/^[a-z0-9-]+$/),
  /** Exact byte strings (latin1) that delimit the excerpt in the page. */
  start: z.string().min(1),
  end: z.string().min(1),
  sha256: hex64,
});

export const pageSchema = z.strictObject({
  url: z.string().regex(/^https:\/\/www\.rsssf\.org\/tablesa\/[a-z0-9-]+\.html$/),
  retrieved_on: isoDate,
  sha256: hex64,
  bytes: z.number().int().positive(),
  encoding: z.enum(["windows-1252", "utf-8"]),
  authors: z.array(z.string().min(1)).min(1),
  /** The text the page itself shows as its last update. */
  last_updated: z.string().min(1),
  layout: z.enum(RSSSF_LAYOUTS),
  excerpts: z.array(excerptSchema).min(1),
  /** Reviewed lines the parser may skip, exact text. */
  ignore: z.array(z.string()),
  /** Reviewed pairs of spellings of one club that appear in one tournament. */
  variants: z.array(z.tuple([z.string(), z.string()])),
  /** Reviewed differences between a final table and the parsed matches, with the reason. */
  tableExceptions: z.array(
    z.strictObject({ excerpt: z.string(), club: z.string(), reason: z.string().min(1) }),
  ),
});

export const manifestSchema = z.strictObject({
  version: z.literal(1),
  pages: z.array(pageSchema),
});

export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestPage = z.infer<typeof pageSchema>;

/** `arg2019.1apertura.txt`: the page name, the excerpt name and .txt. */
export function excerptFileName(url: string, excerpt: string): string {
  const page = new URL(url).pathname
    .split("/")
    .pop()!
    .replace(/\.html$/, "");
  return `${page}.${excerpt}.txt`;
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Every problem of the manifest and of the excerpt files in `dir`; empty when all is in order. */
export function checkManifest(manifest: Manifest, dir: string): string[] {
  const problems: string[] = [];
  const urls = manifest.pages.map((p) => p.url);
  if (new Set(urls).size !== urls.length) problems.push("manifest: duplicate page URL");
  if (urls.some((u, i) => i > 0 && u < urls[i - 1])) {
    problems.push("manifest: pages must be sorted by URL");
  }
  for (const page of manifest.pages) {
    const names = page.excerpts.map((e) => e.name);
    if (new Set(names).size !== names.length) problems.push(`${page.url}: duplicate excerpt name`);
    const ownAnchors = new Set(page.excerpts.flatMap((e) => anchorsIn(e.start)));
    for (const excerpt of page.excerpts) {
      const file = excerptFileName(page.url, excerpt.name);
      const path = join(dir, file);
      if (!existsSync(path)) {
        problems.push(`${file}: excerpt file is missing`);
        continue;
      }
      const bytes = readFileSync(path);
      const actual = sha256(bytes);
      if (actual !== excerpt.sha256) {
        problems.push(`${file}: sha256 mismatch (manifest ${excerpt.sha256}, file ${actual})`);
      }
      const text = Buffer.from(bytes).toString("latin1");
      if (/mailto:/i.test(text)) problems.push(`${file}: contains a mailto link`);
      if (/about this document/i.test(text))
        problems.push(`${file}: contains the "About this document" author block`);
      for (const anchor of anchorsIn(text)) {
        if (!ownAnchors.has(anchor)) {
          problems.push(`${file}: contains the anchor "${anchor}", which is not one of its own`);
        }
      }
    }
  }
  return problems;
}

function anchorsIn(text: string): string[] {
  return [...text.matchAll(/<a\s+name="([^"]+)"/gi)].map((m) => m[1]);
}

/** Reads and validates `manifest.json` of a directory (throws with the schema issues). */
export function loadManifest(dir: string): Manifest {
  const path = join(dir, "manifest.json");
  return manifestSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
