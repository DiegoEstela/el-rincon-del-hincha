import { describe, expect, it } from "vitest";
import { sliceExcerpt } from "../../../../../scripts/ingest/rsssf/slicer";

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p)),
  );

describe("sliceExcerpt (plan 0017, T10)", () => {
  it("returns the bytes from the start marker to just before the end marker", () => {
    const page = bytes('head <a name="a"> body ', [0xe9], ' more <a name="b"> tail');
    const out = sliceExcerpt(page, '<a name="a">', '<a name="b">');
    expect(Buffer.from(out).toString("latin1")).toBe('<a name="a"> body é more ');
  });

  it("keeps the exact bytes, with no decoding", () => {
    const page = bytes("S", [0x81, 0x8d, 0xff], "E");
    expect([...sliceExcerpt(page, "S", "E")]).toEqual([0x53, 0x81, 0x8d, 0xff]);
  });

  it("fails when the start marker is missing or repeated", () => {
    expect(() => sliceExcerpt(bytes("abc END"), "START", "END")).toThrow(/start marker.*not found/);
    expect(() => sliceExcerpt(bytes("START a START b END"), "START", "END")).toThrow(
      /start marker.*more than once/,
    );
  });

  it("fails when the end marker is missing", () => {
    expect(() => sliceExcerpt(bytes("START body"), "START", "END")).toThrow(
      /end marker.*not found/,
    );
  });

  it("fails when the end marker is only before the start", () => {
    expect(() => sliceExcerpt(bytes("END then START body"), "START", "END")).toThrow(
      /end marker.*after the start/,
    );
  });

  it("uses the first end marker after the start", () => {
    const out = sliceExcerpt(bytes("START a END b END"), "START", "END");
    expect(Buffer.from(out).toString("latin1")).toBe("START a ");
  });

  it("treats an empty marker as an error", () => {
    expect(() => sliceExcerpt(bytes("abc"), "", "c")).toThrow(/marker/);
    expect(() => sliceExcerpt(bytes("abc"), "a", "")).toThrow(/marker/);
  });
});
