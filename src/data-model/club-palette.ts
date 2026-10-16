// The project's own named palette for club colors (ADR 0012). Hex values are a project choice,
// not official club colors, and are never taken from brand manuals, crests or kit templates.
// A variant (for example "rojo claro") exists only when contrast forces a shade within a family.
export type PaletteColor = { readonly name: string; readonly hex: string };

export const CLUB_PALETTE: readonly PaletteColor[] = [
  { name: "blanco", hex: "#ffffff" },
  { name: "negro", hex: "#111111" },
  { name: "rojo", hex: "#d62828" },
  { name: "granate", hex: "#7b1e3a" },
  { name: "azul", hex: "#1d4ed8" },
  { name: "azul marino", hex: "#0b1f4d" },
  { name: "celeste", hex: "#6cb4ee" },
  { name: "amarillo", hex: "#ffd60a" },
  { name: "oro", hex: "#d4a017" },
  { name: "verde", hex: "#1a9850" },
  { name: "verde oscuro", hex: "#0b5d2a" },
  { name: "marrón", hex: "#6b4226" },
  { name: "naranja", hex: "#f77f00" },
  { name: "violeta", hex: "#6a2c91" },
];

export function paletteHex(name: string): string {
  const color = CLUB_PALETTE.find((c) => c.name === name);
  if (!color) throw new Error(`Unknown palette color: ${name}`);
  return color.hex;
}
