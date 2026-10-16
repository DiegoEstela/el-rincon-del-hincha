import { describe, expect, it } from "vitest";
import { CLUB_PALETTE, paletteHex } from "@/data-model/club-palette";

describe("club palette", () => {
  it("has only valid lowercase 6-digit hex values", () => {
    for (const { name, hex } of CLUB_PALETTE) {
      expect(hex, name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has unique names and unique values", () => {
    expect(new Set(CLUB_PALETTE.map((c) => c.name)).size).toBe(CLUB_PALETTE.length);
    expect(new Set(CLUB_PALETTE.map((c) => c.hex)).size).toBe(CLUB_PALETTE.length);
  });

  it("looks a color up by name and throws on an unknown one", () => {
    expect(paletteHex("blanco")).toBe("#ffffff");
    expect(() => paletteHex("fucsia")).toThrow(/fucsia/);
  });
});
