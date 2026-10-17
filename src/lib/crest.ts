// Geometry of the generic club crest (ADR 0005, plan 0008): a shield with a chief (top band) in the
// primary color holding the initials, and the shirt pattern in the body. Drawn as data so it is
// testable without a DOM; `src/components/crest.tsx` only turns it into SVG.
import type { CrestSpec } from "./club-options";

export const CREST_VIEWBOX = "0 0 100 120";
export const SHIELD_PATH = "M10 8H90V62C90 92 70 108 50 114C30 108 10 92 10 62Z";

export type CrestShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; fill: string }
  | { kind: "polygon"; points: string; fill: string };

export type CrestShapes = {
  outline: { path: string; stroke: string };
  body: CrestShape[];
  chief: { x: number; y: number; width: number; height: number; fill: string };
  initials: { text: string; x: number; y: number; fontSize: number; fill: string };
};

const BODY_TOP = 40;
const rect = (x: number, y: number, width: number, height: number, fill: string): CrestShape => ({
  kind: "rect",
  x,
  y,
  width,
  height,
  fill,
});

function bodyShapes({ pattern, primary, secondary }: CrestSpec): CrestShape[] {
  const base = rect(10, BODY_TOP, 80, 80, primary);
  switch (pattern) {
    case "solid":
      return [base];
    case "vertical_stripes":
      return [base, rect(26, BODY_TOP, 16, 80, secondary), rect(58, BODY_TOP, 16, 80, secondary)];
    case "hoops":
      return [base, rect(10, 54, 80, 12, secondary), rect(10, 78, 80, 12, secondary)];
    case "sash":
      return [
        base,
        { kind: "polygon", points: "10,40 34,40 90,96 90,120 66,120 10,64", fill: secondary },
      ];
    case "halves":
      return [rect(10, BODY_TOP, 40, 80, primary), rect(50, BODY_TOP, 40, 80, secondary)];
    case "other":
      return [base, rect(10, 62, 80, 20, secondary)];
  }
}

function initialsFontSize(length: number): number {
  if (length <= 2) return 26;
  return length === 3 ? 22 : 17;
}

export function crestShapes(spec: CrestSpec): CrestShapes {
  return {
    outline: { path: SHIELD_PATH, stroke: spec.tertiary ?? spec.secondary },
    body: bodyShapes(spec),
    chief: { x: 10, y: 8, width: 80, height: BODY_TOP - 8, fill: spec.primary },
    initials: {
      text: spec.initials,
      x: 50,
      y: 32,
      fontSize: initialsFontSize(spec.initials.length),
      fill: spec.initialsInk,
    },
  };
}
