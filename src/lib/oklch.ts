// OKLCH helpers (Bjorn Ottosson's OKLab matrices). Used at build time on the server to derive club
// accents; never imported by client modules. No dependency.
import { parseColor } from "./contrast";

export type Oklch = { l: number; c: number; h: number };

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = parseColor(hex);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** Linear sRGB of an OKLCH color (may fall outside 0..1 when out of gamut). */
function toLinearRgb(L: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPSILON = 1e-6;
const inGamut = (rgb: number[]) => rgb.every((v) => v >= -EPSILON && v <= 1 + EPSILON);
const hex2 = (v: number) =>
  Math.round(fromLinear(Math.min(1, Math.max(0, v))) * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * OKLCH to a 6-digit hex. When the color is outside the sRGB gamut, chroma is bisected down
 * (lightness and hue kept) until it fits. Lightness is clamped to 0..1.
 */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const L = Math.min(1, Math.max(0, lightness));
  let rgb = toLinearRgb(L, chroma, hue);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = chroma;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (inGamut(toLinearRgb(L, mid, hue))) low = mid;
      else high = mid;
    }
    rgb = toLinearRgb(L, low, hue);
  }
  return `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;
}
