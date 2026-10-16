import { describe, expect, it } from "vitest";
import { composite, contrastRatio } from "@/lib/contrast";
import {
  ACCENT_TARGET,
  accentContrastFor,
  accentSurfaces,
  deriveClubTheme,
  liftToContrast,
  minAccentRatio,
  pickAccentBase,
} from "@/lib/club-theme";
import { hexToOklch } from "@/lib/oklch";

const hueDrift = (a: string, b: string) => {
  const d = Math.abs(hexToOklch(a).h - hexToOklch(b).h);
  return Math.min(d, 360 - d);
};

describe("pickAccentBase", () => {
  it("takes the primary when it is chromatic", () => {
    expect(pickAccentBase({ primary: "#d62828", secondary: "#1d4ed8" })).toBe("#d62828");
  });
  it("takes the secondary when the primary is white or black", () => {
    expect(pickAccentBase({ primary: "#ffffff", secondary: "#d62828" })).toBe("#d62828");
    expect(pickAccentBase({ primary: "#111111", secondary: "#1a9850" })).toBe("#1a9850");
  });
  it("takes the tertiary when it is the only chromatic color", () => {
    expect(
      pickAccentBase({ primary: "#ffffff", secondary: "#111111", tertiary: "#1d4ed8" }),
    ).toBe("#1d4ed8");
  });
  it("takes the lightest color when all are neutral", () => {
    expect(pickAccentBase({ primary: "#111111", secondary: "#ffffff" })).toBe("#ffffff");
    expect(
      pickAccentBase({ primary: "#111111", secondary: "#444444", tertiary: "#bbbbbb" }),
    ).toBe("#bbbbbb");
  });
});

describe("accentSurfaces", () => {
  it("returns the six surfaces with the glow and the tint mixed from the accent", () => {
    const s = accentSurfaces("#ff6f64");
    expect(Object.keys(s).sort()).toEqual(
      ["background", "glassOnBackground", "glassOnGlow", "glassOnRaised", "raised", "tint"].sort(),
    );
    expect(s.background).toBe("#07140d");
    expect(s.raised).toBe("#0d2318");
    expect(s.tint).toBe(composite("rgb(255 111 100 / 0.12)", "#0d2318"));
    expect(s.glassOnGlow).toBe(
      composite("rgb(255 255 255 / 0.06)", composite("rgb(255 111 100 / 0.08)", "#0d2318")),
    );
  });
});

describe("minAccentRatio", () => {
  it("is the smallest ratio over the surfaces", () => {
    const s = accentSurfaces("#c6ff3d");
    const all = Object.values(s).map((surface) => contrastRatio("#c6ff3d", surface));
    expect(minAccentRatio("#c6ff3d")).toBeCloseTo(Math.min(...all), 10);
  });
});

describe("liftToContrast", () => {
  it("returns a passing color unchanged", () => {
    expect(liftToContrast("#ffd60a")).toBe("#ffd60a");
  });
  it("lifts a dark red to a lighter red with the smallest lift", () => {
    const lifted = liftToContrast("#d62828");
    expect(lifted).not.toBe("#d62828");
    expect(hueDrift("#d62828", lifted)).toBeLessThan(5);
    expect(hexToOklch(lifted).l).toBeGreaterThan(hexToOklch("#d62828").l);
    const ratio = minAccentRatio(lifted);
    expect(ratio).toBeGreaterThanOrEqual(ACCENT_TARGET);
    expect(ratio).toBeLessThan(4.8);
  });
  it("throws when no color can reach the target", () => {
    expect(() => liftToContrast("#d62828", 25)).toThrow(RangeError);
  });
});

describe("accentContrastFor", () => {
  it("uses the dark ink on a light accent", () => {
    expect(accentContrastFor("#c6ff3d")).toBe("#0a1a00");
  });
  it("uses white on a dark accent", () => {
    expect(accentContrastFor("#2a2a8a")).toBe("#ffffff");
  });
  it("throws when neither ink reaches 4.5:1", () => {
    expect(() => accentContrastFor("#777777")).toThrow(RangeError);
  });
});

describe("deriveClubTheme", () => {
  it("combines base, lift and ink", () => {
    const theme = deriveClubTheme({ primary: "#d62828", secondary: "#ffffff" });
    expect(minAccentRatio(theme.accent)).toBeGreaterThanOrEqual(ACCENT_TARGET);
    expect(contrastRatio(theme.accentContrast, theme.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
