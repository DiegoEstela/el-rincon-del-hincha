import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fetchPinned } from "../../../../scripts/ingest/core/pinned-fetch";

const URL_OK = "https://raw.githubusercontent.com/openfootball/south-america/abc/argentina/x.txt";
const body = "hello";
const sha = createHash("sha256").update(body).digest("hex");
const respond =
  (text: string | Uint8Array, status = 200) =>
  async () =>
    new Response(text as BodyInit, { status });

describe("fetchPinned", () => {
  it("returns the text when the sha256 matches", async () => {
    const text = await fetchPinned(
      { name: "x.txt", url: URL_OK, sha256: sha },
      { fetchImpl: respond(body) },
    );
    expect(text).toBe(body);
  });

  it("rejects on a hash mismatch, naming the file and both hashes", async () => {
    await expect(
      fetchPinned(
        { name: "x.txt", url: URL_OK, sha256: "0".repeat(64) },
        { fetchImpl: respond(body) },
      ),
    ).rejects.toThrow(new RegExp(`x\\.txt.*${"0".repeat(64)}.*${sha}`));
  });

  it("never follows redirects", async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      seen = init;
      return new Response(body);
    };
    await fetchPinned({ name: "x.txt", url: URL_OK, sha256: sha }, { fetchImpl });
    expect(seen?.redirect).toBe("error");
  });

  it("stops reading a streamed body as soon as it passes the cap", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(400));
      },
    });
    await expect(
      fetchPinned(
        { name: "x.txt", url: URL_OK, sha256: sha },
        { fetchImpl: async () => new Response(stream), maxBytes: 1000 },
      ),
    ).rejects.toThrow(/too large/i);
    expect(pulled).toBeLessThan(10);
  });

  it("rejects a declared content-length over the cap without reading the body", async () => {
    const response = new Response(body, { headers: { "content-length": "5000000" } });
    await expect(
      fetchPinned({ name: "x.txt", url: URL_OK, sha256: sha }, { fetchImpl: async () => response }),
    ).rejects.toThrow(/too large/i);
  });

  it("rejects a non-200 response", async () => {
    await expect(
      fetchPinned({ name: "x.txt", url: URL_OK, sha256: sha }, { fetchImpl: respond("no", 404) }),
    ).rejects.toThrow(/404/);
  });

  it("rejects a body over the size cap", async () => {
    await expect(
      fetchPinned(
        { name: "x.txt", url: URL_OK, sha256: sha },
        { fetchImpl: respond(new Uint8Array(2_000_000)) },
      ),
    ).rejects.toThrow(/too large/i);
  });

  it("rejects any other host or protocol without calling fetch", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response(body);
    };
    for (const url of ["https://evil.example/x.txt", "http://raw.githubusercontent.com/x.txt"]) {
      await expect(fetchPinned({ name: "x.txt", url, sha256: sha }, { fetchImpl })).rejects.toThrow(
        /host|https/i,
      );
    }
    expect(called).toBe(false);
  });

  it("honors the timeout", async () => {
    const never = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      );
    await expect(
      fetchPinned({ name: "x.txt", url: URL_OK, sha256: sha }, { fetchImpl: never, timeoutMs: 20 }),
    ).rejects.toThrow();
  });
});
