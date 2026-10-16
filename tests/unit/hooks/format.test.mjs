import { describe, expect, it } from "vitest";
import { shouldFormat } from "../../../.claude/hooks/format.mjs";

describe("format", () => {
  it("formats supported extensions", () => {
    for (const f of ["a.ts", "a.TSX", "a.json", "a.md", "a.css", "a.mjs"])
      expect(shouldFormat(f)).toBe(true);
  });
  it("skips others and empty paths", () => {
    for (const f of ["a.png", "a.svg", "a", ""]) expect(shouldFormat(f)).toBe(false);
  });
});
