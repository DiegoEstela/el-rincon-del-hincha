// Test tooling: used by the palette AA tests, not by the running app.
export type Rgba = { r: number; g: number; b: number; a: number };
export type AALevel = "text" | "large" | "ui";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/i;

export function parseColor(input: string): Rgba {
  const value = input.trim();
  const hex = HEX.exec(value);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = RGB.exec(value);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] ? Number(rgb[4]) : 1,
    };
  }
  throw new Error(`Unsupported color: ${input}`);
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const { r, g, b } = parseColor(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** Alpha-composites `foreground` over an opaque `background` and returns a 6-digit hex. */
export function composite(foreground: string, background: string): string {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return `#${toHex(mix(fg.r, bg.r))}${toHex(mix(fg.g, bg.g))}${toHex(mix(fg.b, bg.b))}`;
}

export function meetsAA(ratio: number, level: AALevel): boolean {
  return ratio >= (level === "text" ? 4.5 : 3);
}
