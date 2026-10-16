import { describe, expect, it } from "vitest";
import { CLUB_PALETTE } from "@/data-model/club-palette";
import { parseColor } from "@/lib/contrast";
import { hexToOklch, oklchToHex } from "@/lib/oklch";

const near = (a: number, b: number, digits = 3) => Math.abs(a - b) < 10 ** -digits;

describe("hexToOklch", () => {
  it("maps white to L 1 and no chroma", () => {
    const { l, c } = hexToOklch("#ffffff");
    expect(near(l, 1)).toBe(true);
    expect(c).toBeLessThan(0.001);
  });
  it("maps black to L 0", () => {
    expect(near(hexToOklch("#000000").l, 0)).toBe(true);
  });
  it("matches the reference values of pure red", () => {
    const { l, c, h } = hexToOklch("#ff0000");
    expect(near(l, 0.628)).toBe(true);
    expect(near(c, 0.258)).toBe(true);
    expect(Math.abs(h - 29.2)).toBeLessThan(0.1);
  });
});

describe("oklchToHex", () => {
  it("round-trips every palette color within one unit per channel", () => {
    for (const { hex } of CLUB_PALETTE) {
      const { l, c, h } = hexToOklch(hex);
      const back = parseColor(oklchToHex(l, c, h));
      const want = parseColor(hex);
      expect(Math.abs(back.r - want.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - want.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - want.b)).toBeLessThanOrEqual(1);
    }
  });

  it("reduces chroma for an out-of-gamut request and keeps the hue", () => {
    const hex = oklchToHex(0.9, 0.3, 29);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const back = hexToOklch(hex);
    expect(back.c).toBeLessThan(0.3);
    expect(Math.abs(back.h - 29)).toBeLessThan(1);
  });

  it("clamps lightness outside 0..1", () => {
    expect(oklchToHex(1.5, 0, 0)).toBe("#ffffff");
    expect(oklchToHex(-0.5, 0, 0)).toBe("#000000");
  });
});
