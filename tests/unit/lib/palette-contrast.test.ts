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
// The glow follows --accent (lime by default; club accents are pinned in club-theme-contrast).
const lime = (alpha: number) => {
  const n = parseInt(t("accent").slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
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

describe("accent-based glows", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const nav = readFileSync(join(process.cwd(), "src/components/layout/nav-links.tsx"), "utf8");
  const outsideRoot = css.replace(/:root\s*\{[^}]*\}/, "");

  it("no longer hardcodes the lime outside :root", () => {
    expect(outsideRoot).not.toContain("198 255 61");
    expect(nav).not.toContain("198_255_61");
  });
  it("mixes the glow and the lawn stripes from --accent", () => {
    expect(outsideRoot).toContain("color-mix(in srgb, var(--accent) 8%, transparent)");
    expect(outsideRoot).toContain("color-mix(in srgb, var(--accent) 3%, transparent)");
    expect(nav).toContain("color-mix(in_srgb,var(--accent)_8%,transparent)");
  });
});

describe("rivals screen: dominance chips (plan 0015)", () => {
  // Each chip is its semantic color on a 5% tint of the same color, over the glass and the glow.
  // 12% looked richer but failed: "Parejo" fell to 4.20:1 and "Te domina" to 4.06:1 over the glow.
  const tint = (token: string, surface: string) => {
    const n = parseInt(t(token).slice(1), 16);
    return composite(`rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / 0.05)`, surface);
  };

  for (const token of ["win", "even", "loss"]) {
    for (const [name, surface] of Object.entries({ glassOnBg, glassOnRaised, worst })) {
      it(`${token} text is at least 4.5:1 on its 5% tint over ${name}`, () => {
        expect(contrastRatio(t(token), tint(token, surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("vitrina (plan 0018)", () => {
  for (const [name, surface] of Object.entries({ glassOnBg, glassOnRaised, worst, raised })) {
    it(`the gold of the year and of the counter is at least 4.5:1 on ${name}`, () => {
      expect(contrastRatio(t("gold"), surface)).toBeGreaterThanOrEqual(4.5);
    });

    it(`the outline of a silhouette (muted) is at least 3:1 on ${name} (non-text contrast)`, () => {
      expect(contrastRatio(t("muted"), surface)).toBeGreaterThanOrEqual(3);
    });
  }

  it("the mark inside a lit trophy (the background) is at least 3:1 on the gold", () => {
    expect(contrastRatio(t("background"), t("gold"))).toBeGreaterThanOrEqual(3);
  });
});
