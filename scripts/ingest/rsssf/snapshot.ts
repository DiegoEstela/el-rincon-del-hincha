// Refreshes the pinned RSSSF excerpts (plan 0017, ADR 0020 decision 2). It is the only code that
// requests rsssf.org: one page at a time, at least five seconds apart, https only, no redirects, a
// 2 MB cap and a user agent with no personal data. It refreshes the pages already listed in the
// manifest; adding a page or an excerpt is a reviewed edit of the manifest. All the work is done in
// memory first, so a failure leaves every file as it was.
import { createHash } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";
import { fetchBytes, type FetchLike } from "../core/pinned-fetch";
import { excerptFileName, loadManifest, type ManifestPage } from "./manifest";
import { sliceExcerpt } from "./slicer";
import { prepareText } from "./text";

export const SNAPSHOT_USER_AGENT =
  "rincon-del-hincha-data-snapshot/1.0 (+https://github.com/DiegoEstela/el-rincon-del-hincha)";

export type SnapshotOptions = {
  /** The `sources/rsssf` directory: `manifest.json` and the excerpts. */
  dir: string;
  fetchImpl?: FetchLike;
  now: Date;
  sleep?: (ms: number) => Promise<void>;
  /** Pause between two requests (default 5000 ms; never lower in the real script). */
  delayMs?: number;
  /** Only list the pages that changed; write nothing. */
  check?: boolean;
};

export type SnapshotResult = { changed: string[]; written: string[] };

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const defaultSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** The text a person reads, to check the authors and the last update against the manifest. */
function visibleText(page: ManifestPage, bytes: Uint8Array): string {
  const decoded = new TextDecoder(page.encoding).decode(bytes);
  return prepareText(decoded, page.url)
    .lines.map((l) => l.text)
    .join("\n")
    .normalize("NFC");
}

type Refreshed = { page: ManifestPage; next: ManifestPage; files: Map<string, Uint8Array> };

function refresh(page: ManifestPage, bytes: Uint8Array, retrievedOn: string): Refreshed {
  const text = visibleText(page, bytes);
  for (const author of page.authors) {
    if (!text.includes(author.normalize("NFC"))) {
      throw new Error(`${page.url}: the author "${author}" is not on the page any more`);
    }
  }
  const updated = /Last updated:?\s*([^\n]+)/i.exec(text);
  if (updated === null) throw new Error(`${page.url}: the page shows no last update`);
  const files = new Map<string, Uint8Array>();
  const excerpts = page.excerpts.map((excerpt) => {
    const slice = sliceExcerpt(bytes, excerpt.start, excerpt.end);
    files.set(excerptFileName(page.url, excerpt.name), slice);
    return { ...excerpt, sha256: sha256(slice) };
  });
  const next: ManifestPage = {
    ...page,
    retrieved_on: retrievedOn,
    sha256: sha256(bytes),
    bytes: bytes.length,
    last_updated: updated[1].trim(),
    excerpts,
  };
  return { page, next, files };
}

export async function runSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
  const { dir, now, check = false, delayMs = 5000, sleep = defaultSleep } = options;
  const manifest = loadManifest(dir);
  const refreshed: Refreshed[] = [];

  for (const [index, page] of manifest.pages.entries()) {
    if (index > 0) await sleep(delayMs);
    const bytes = await fetchBytes(page.url, page.url, {
      fetchImpl: options.fetchImpl,
      allowedHosts: ["www.rsssf.org"],
      maxBytes: 2_000_000,
      userAgent: SNAPSHOT_USER_AGENT,
    });
    if (sha256(bytes) === page.sha256) continue;
    refreshed.push(refresh(page, bytes, now.toISOString().slice(0, 10)));
  }

  const changed = refreshed.map((r) => r.page.url);
  if (check || refreshed.length === 0) return { changed, written: [] };

  const nextManifest = {
    ...manifest,
    pages: manifest.pages.map((p) => refreshed.find((r) => r.page.url === p.url)?.next ?? p),
  };
  const manifestText = await format(JSON.stringify(nextManifest), {
    parser: "json",
    printWidth: 100,
  });
  const written: string[] = [];
  for (const { files } of refreshed) {
    for (const [name, bytes] of files) {
      writeFileSync(join(dir, name), bytes);
      written.push(name);
    }
  }
  const temp = join(dir, "manifest.json.tmp");
  writeFileSync(temp, manifestText);
  renameSync(temp, join(dir, "manifest.json"));
  return { changed, written };
}
