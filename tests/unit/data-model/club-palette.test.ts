import { describe, expect, it } from "vitest";
import { CLUB_PALETTE, paletteHex } from "@/data-model/club-palette";
import { contrastRatio } from "@/lib/contrast";

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

  it("has a lighter celeste so Arsenal's celeste and rojo are told apart on the crest", () => {
    expect(paletteHex("celeste claro")).toBe("#a9d6f5");
    expect(contrastRatio(paletteHex("celeste claro"), paletteHex("rojo"))).toBeGreaterThanOrEqual(
      3,
    );
    // The base celeste is too close to rojo, which is why the variant exists.
    expect(contrastRatio(paletteHex("celeste"), paletteHex("rojo"))).toBeLessThan(3);
  });
});
