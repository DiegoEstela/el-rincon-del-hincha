// Club accent derivation (ADR 0013, decision 1). Pure; runs at build time on the server only.
// Client modules never import this file: the browser only sets `data-club` on <html>.
import { composite, contrastRatio } from "./contrast";
import { hexToOklch, oklchToHex } from "./oklch";

/** AA for text (4.5) plus 0.1 of margin for rounding and for browsers mixing tints in OKLab. */
export const ACCENT_TARGET = 4.6;

/** Same values as the `:root` tokens of globals.css (pinned by tests/unit/lib/palette-contrast). */
const BACKGROUND = "#07140d";
const RAISED = "#0d2318";
const GLASS = "rgb(255 255 255 / 0.06)";
const GLOW_ALPHA = 0.08;
const TINT_ALPHA = 0.12;

const CHROMATIC = 0.04;
const INK_DARK = "#0a1a00";
const INK_LIGHT = "#ffffff";

export type ClubColors = { primary: string; secondary: string; tertiary?: string };
export type ClubTheme = { accent: string; accentContrast: string };
export type AccentSurfaces = {
  background: string;
  raised: string;
  glassOnBackground: string;
  glassOnRaised: string;
  glassOnGlow: string;
  tint: string;
};

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
};

/** The six surfaces an accent colored text can sit on, with the glow and tint of that accent. */
export function accentSurfaces(accent: string): AccentSurfaces {
  return {
    background: BACKGROUND,
    raised: RAISED,
    glassOnBackground: composite(GLASS, BACKGROUND),
    glassOnRaised: composite(GLASS, RAISED),
    glassOnGlow: composite(GLASS, composite(rgba(accent, GLOW_ALPHA), RAISED)),
    tint: composite(rgba(accent, TINT_ALPHA), RAISED),
  };
}

/** Smallest contrast ratio of `accent` text over the six surfaces. */
export function minAccentRatio(accent: string): number {
  return Math.min(...Object.values(accentSurfaces(accent)).map((s) => contrastRatio(accent, s)));
}

/** First chromatic color among primary, secondary and tertiary; the lightest if none is. */
export function pickAccentBase(colors: ClubColors): string {
  const list = [colors.primary, colors.secondary, colors.tertiary].filter(
    (c): c is string => c !== undefined,
  );
  const chromatic = list.find((c) => hexToOklch(c).c >= CHROMATIC);
  if (chromatic) return chromatic;
  return list.reduce((a, b) => (hexToOklch(b).l > hexToOklch(a).l ? b : a));
}

/**
 * Raises OKLCH lightness only (hue fixed, chroma reduced only as the sRGB gamut forces) to the
 * smallest lightness whose rounded hex reaches `target` on every accent surface.
 */
export function liftToContrast(hex: string, target: number = ACCENT_TARGET): string {
  const passes = (candidate: string) => minAccentRatio(candidate) >= target;
  if (passes(hex)) return hex;
  const { l, c, h } = hexToOklch(hex);
  const brightest = oklchToHex(1, c, h);
  if (!passes(brightest)) {
    throw new RangeError(`No lightness of ${hex} reaches a contrast of ${target}.`);
  }
  let low = l;
  let high = 1;
  let best = brightest;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const candidate = oklchToHex(mid, c, h);
    if (passes(candidate)) {
      best = candidate;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

/** Text color on accent fills: the dark ink when it reaches 4.5:1, else white, else it throws. */
export function accentContrastFor(accent: string): string {
  for (const ink of [INK_DARK, INK_LIGHT]) {
    if (contrastRatio(ink, accent) >= 4.5) return ink;
  }
  throw new RangeError(`No text color reaches 4.5:1 on ${accent}.`);
}

export function deriveClubTheme(colors: ClubColors): ClubTheme {
  const accent = liftToContrast(pickAccentBase(colors));
  return { accent, accentContrast: accentContrastFor(accent) };
}
