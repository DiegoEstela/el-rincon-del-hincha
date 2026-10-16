import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composite, contrastRatio } from "@/lib/contrast";
import { parseRootTokens } from "@/lib/css-tokens";

const tokens = parseRootTokens(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"));
const t = (name: string) => {
  const value = tokens[name];
  if (!value) throw new Error(`Missing token --${name}`);
  return value;
};

const GLOW_CAP = 0.08;
const lime = (alpha: number) => {
  const { r, g, b } = { r: 198, g: 255, b: 61 };
  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

const background = t("background");
const raised = t("background-raised");
const glassOnBg = composite(t("glass"), background);
const glassOnRaised = composite(t("glass"), raised);
const worst = composite(t("glass"), composite(lime(GLOW_CAP), raised));
const activeTint = composite(lime(0.12), raised);
const surfaces = { background, raised, glassOnBg, glassOnRaised, worst };

describe("palette tokens", () => {
  it("matches the agreed Césped y neón values (ADR 0007)", () => {
    expect({
      background: t("background"),
      raised: t("background-raised"),
      foreground: t("foreground"),
      muted: t("muted"),
      lineStrong: t("line-strong"),
      accent: t("accent"),
      accentContrast: t("accent-contrast"),
      gold: t("gold"),
      win: t("win"),
      even: t("even"),
      loss: t("loss"),
    }).toEqual({
      background: "#07140d",
      raised: "#0d2318",
      foreground: "#ecfdf3",
      muted: "#9db8a9",
      lineStrong: "#5a7a68",
      accent: "#c6ff3d",
      accentContrast: "#0a1a00",
      gold: "#f5c542",
      win: "#4ade80",
      even: "#a8b5ad",
      loss: "#ff8a8a",
    });
  });
});

describe("WCAG AA contrast", () => {
  for (const name of ["foreground", "muted", "accent", "gold", "win", "even", "loss"]) {
    for (const [surface, color] of Object.entries(surfaces)) {
      it(`${name} text is >= 4.5:1 on ${surface}`, () => {
        expect(contrastRatio(t(name), color)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("accent-contrast is readable on accent and gold", () => {
    expect(contrastRatio(t("accent-contrast"), t("accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t("accent-contrast"), t("gold"))).toBeGreaterThanOrEqual(4.5);
  });

  it("active nav item text is readable on the lime tint", () => {
    expect(contrastRatio(t("accent"), activeTint)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t("foreground"), activeTint)).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring is >= 3:1 against background and the active tint", () => {
    expect(contrastRatio(t("accent"), background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t("accent"), activeTint)).toBeGreaterThanOrEqual(3);
  });

  it("control borders (--line-strong) are >= 3:1 on background and raised", () => {
    expect(contrastRatio(t("line-strong"), background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t("line-strong"), raised)).toBeGreaterThanOrEqual(3);
  });
});

describe("opaque bottom bar and info menu", () => {
  it("keeps nav text readable on the solid raised surface", () => {
    expect(contrastRatio(t("muted"), raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t("accent"), raised)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t("accent"), activeTint)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t("foreground"), raised)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the bar, sheet and button borders visible", () => {
    expect(contrastRatio(t("line-strong"), background)).toBeGreaterThanOrEqual(3);
  });
});
