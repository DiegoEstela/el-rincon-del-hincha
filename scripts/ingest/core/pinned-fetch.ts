// Fetch one pinned file: fixed host, timeout, size cap and sha256 check (ADR 0015, decision 2).
// `fetchImpl` is injected so tests never touch the network.
import { createHash } from "node:crypto";

export type SourceFile = { name: string; url: string; sha256: string };
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type FetchOptions = { fetchImpl?: FetchLike; timeoutMs?: number; maxBytes?: number };

const ALLOWED_HOST = "raw.githubusercontent.com";

export function checkSha256(file: SourceFile, bytes: Uint8Array): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== file.sha256) {
    throw new Error(
      `${file.name}: sha256 mismatch (expected ${file.sha256}, got ${actual}). The pinned input changed.`,
    );
  }
}

/** Reads the body in chunks and aborts as soon as it passes the cap, so a huge body never fills memory. */
async function readCapped(name: string, response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`${name}: body too large (over ${maxBytes} bytes)`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchPinned(file: SourceFile, options: FetchOptions = {}): Promise<string> {
  const { fetchImpl = fetch, timeoutMs = 15_000, maxBytes = 1_000_000 } = options;
  const url = new URL(file.url);
  if (url.protocol !== "https:") throw new Error(`${file.name}: only https URLs are allowed`);
  if (url.hostname !== ALLOWED_HOST) {
    throw new Error(`${file.name}: host "${url.hostname}" is not allowed (only ${ALLOWED_HOST})`);
  }
  // redirect: "error" keeps the host allowlist meaningful: a 3xx is never followed to another host.
  const response = await fetchImpl(file.url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  if (response.status !== 200) {
    throw new Error(`${file.name}: unexpected HTTP status ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Error(`${file.name}: body too large (${declared} bytes, cap ${maxBytes})`);
  }
  const bytes = await readCapped(file.name, response, maxBytes);
  checkSha256(file, bytes);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
