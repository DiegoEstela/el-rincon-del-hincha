import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeSource, fetchPinned } from "../../../../scripts/ingest/core/pinned-fetch";

const URL_OK = "https://raw.githubusercontent.com/openfootball/south-america/abc/argentina/x.txt";
const hashOf = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const respond =
  (body: Uint8Array, status = 200) =>
  async () =>
    new Response(body as BodyInit, { status });
const cp1252 = "windows-1252" as const;

describe("decodeSource and encodings (plan 0017, T3)", () => {
  it("decodes utf-8 by default, so existing inputs are unchanged", () => {
    const bytes = new TextEncoder().encode("Colón");
    expect(decodeSource({ name: "x", url: URL_OK, sha256: hashOf(bytes) }, bytes)).toBe("Colón");
  });

  it("decodes windows-1252: 0xF3 is ó and 0x93/0x94 are curly quotes", () => {
    const bytes = Uint8Array.from([0x43, 0x6f, 0x6c, 0xf3, 0x6e, 0x20, 0x93, 0x78, 0x94, 0xe9]);
    const file = { name: "x", url: URL_OK, sha256: hashOf(bytes), encoding: cp1252 };
    expect(decodeSource(file, bytes)).toBe("Colón “x”é");
  });

  it("rejects a decoded C1 control character, naming the file", () => {
    for (const byte of [0x81, 0x8d, 0x8f, 0x90, 0x9d]) {
      const bytes = Uint8Array.from([0x61, byte, 0x62]);
      const file = { name: "page.html", url: URL_OK, sha256: hashOf(bytes), encoding: cp1252 };
      expect(() => decodeSource(file, bytes)).toThrow(/page\.html.*control character/);
    }
  });

  it("rejects invalid utf-8 as before", () => {
    const bytes = Uint8Array.from([0xff, 0xfe]);
    expect(() => decodeSource({ name: "x", url: URL_OK, sha256: hashOf(bytes) }, bytes)).toThrow();
  });

  it("checks the sha256 on the bytes before decoding", () => {
    const bytes = Uint8Array.from([0xe9]);
    const file = { name: "x", url: URL_OK, sha256: "0".repeat(64), encoding: cp1252 };
    expect(() => decodeSource(file, bytes)).toThrow(/sha256 mismatch/);
  });

  it("fetchPinned decodes with the declared encoding", async () => {
    const bytes = Uint8Array.from([0xe9]);
    const file = { name: "x", url: URL_OK, sha256: hashOf(bytes), encoding: cp1252 };
    expect(await fetchPinned(file, { fetchImpl: respond(bytes) })).toBe("é");
  });
});

describe("hosts and caps per adapter (plan 0017, T4)", () => {
  const RSSSF = "https://www.rsssf.org/tablesa/arg2019.html";
  const bytes = new TextEncoder().encode("page");
  const file = { name: "arg2019.html", url: RSSSF, sha256: hashOf(bytes) };
  const hosts = ["www.rsssf.org"];

  it("rejects www.rsssf.org unless the adapter lists it", async () => {
    await expect(fetchPinned(file, { fetchImpl: respond(bytes) })).rejects.toThrow(/not allowed/);
    expect(await fetchPinned(file, { fetchImpl: respond(bytes), allowedHosts: hosts })).toBe(
      "page",
    );
  });

  it("still rejects other hosts, http and redirects", async () => {
    const options = { fetchImpl: respond(bytes), allowedHosts: hosts };
    await expect(fetchPinned({ ...file, url: "https://evil.org/x.html" }, options)).rejects.toThrow(
      /not allowed/,
    );
    await expect(
      fetchPinned({ ...file, url: "http://www.rsssf.org/x.html" }, options),
    ).rejects.toThrow(/https/);
    await expect(fetchPinned(file, { ...options, fetchImpl: respond(bytes, 301) })).rejects.toThrow(
      /status 301/,
    );
  });

  it("applies the cap of the adapter", async () => {
    const big = new Uint8Array(3_000_000);
    const bigFile = { ...file, sha256: hashOf(big) };
    await expect(
      fetchPinned(bigFile, { fetchImpl: respond(big), allowedHosts: hosts }),
    ).rejects.toThrow(/too large/);
    const text = await fetchPinned(bigFile, {
      fetchImpl: respond(big),
      allowedHosts: hosts,
      maxBytes: 4_000_000,
    });
    expect(text).toHaveLength(3_000_000);
  });
});
