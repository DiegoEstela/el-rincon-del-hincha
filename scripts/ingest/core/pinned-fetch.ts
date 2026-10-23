// Fetch one pinned file: fixed host, timeout, size cap and sha256 check (ADR 0015, decision 2).
// `fetchImpl` is injected so tests never touch the network.
import { createHash } from "node:crypto";

export type SourceEncoding = "utf-8" | "windows-1252";
export type SourceFile = { name: string; url: string; sha256: string; encoding?: SourceEncoding };
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type FetchOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Cap of the body; each adapter may raise it (default 1 MB). */
  maxBytes?: number;
  /** Hosts the adapter may reach (default: raw.githubusercontent.com only). */
  allowedHosts?: readonly string[];
};

const DEFAULT_HOSTS: readonly string[] = ["raw.githubusercontent.com"];
// C1 controls (U+0080 to U+009F) decoded from windows-1252 mean the page is not in that encoding.
const C1_CONTROL = /[\u0080-\u009f]/;

export function checkSha256(file: SourceFile, bytes: Uint8Array): void {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== file.sha256) {
    throw new Error(
      `${file.name}: sha256 mismatch (expected ${file.sha256}, got ${actual}). The pinned input changed.`,
    );
  }
}

/**
 * Checks the sha256 on the bytes, then decodes them. utf-8 is strict (invalid bytes fail);
 * windows-1252 rejects any decoded C1 control character, which means a wrong encoding.
 */
export function decodeSource(file: SourceFile, bytes: Uint8Array): string {
  checkSha256(file, bytes);
  const encoding = file.encoding ?? "utf-8";
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (encoding !== "utf-8" && C1_CONTROL.test(text)) {
    throw new Error(
      `${file.name}: a control character was decoded; the encoding is not ${encoding}`,
    );
  }
  return text;
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

/** The raw bytes of one URL, under the host allowlist, https only, no redirects and a size cap. */
export async function fetchBytes(
  name: string,
  rawUrl: string,
  options: FetchOptions & { userAgent?: string } = {},
): Promise<Uint8Array> {
  const {
    fetchImpl = fetch,
    timeoutMs = 15_000,
    maxBytes = 1_000_000,
    allowedHosts = DEFAULT_HOSTS,
    userAgent,
  } = options;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error(`${name}: only https URLs are allowed`);
  if (!allowedHosts.includes(url.hostname)) {
    throw new Error(
      `${name}: host "${url.hostname}" is not allowed (only ${allowedHosts.join(", ")})`,
    );
  }
  // redirect: "error" keeps the host allowlist meaningful: a 3xx is never followed to another host.
  const response = await fetchImpl(rawUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
    ...(userAgent === undefined ? {} : { headers: { "user-agent": userAgent } }),
  });
  if (response.status !== 200) {
    throw new Error(`${name}: unexpected HTTP status ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Error(`${name}: body too large (${declared} bytes, cap ${maxBytes})`);
  }
  return readCapped(name, response, maxBytes);
}

export async function fetchPinned(file: SourceFile, options: FetchOptions = {}): Promise<string> {
  return decodeSource(file, await fetchBytes(file.name, file.url, options));
}
