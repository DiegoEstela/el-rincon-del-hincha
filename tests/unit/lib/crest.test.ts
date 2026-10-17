import { describe, expect, it } from "vitest";
import type { CrestSpec } from "@/lib/club-options";
import { CREST_VIEWBOX, SHIELD_PATH, crestShapes } from "@/lib/crest";

const base: CrestSpec = {
  pattern: "solid",
  primary: "#d62828",
  secondary: "#ffffff",
  initials: "RP",
  initialsInk: "#ffffff",
};
const spec = (patch: Partial<CrestSpec>): CrestSpec => ({ ...base, ...patch });
const fills = (s: CrestSpec) => crestShapes(s).body.map((shape) => shape.fill);

describe("crestShapes body", () => {
  it("solid is a single layer in the primary color", () => {
    const { body } = crestShapes(spec({ pattern: "solid" }));
    expect(body).toHaveLength(1);
    expect(fills(spec({ pattern: "solid" }))).toEqual(["#d62828"]);
  });
  it("vertical stripes are the primary base and 2 secondary stripes", () => {
    const s = spec({ pattern: "vertical_stripes" });
    expect(fills(s)).toEqual(["#d62828", "#ffffff", "#ffffff"]);
    expect(crestShapes(s).body.every((shape) => shape.kind === "rect")).toBe(true);
  });
  it("hoops are the primary base and 2 secondary bands", () => {
    const s = spec({ pattern: "hoops" });
    expect(fills(s)).toEqual(["#d62828", "#ffffff", "#ffffff"]);
  });
  it("a sash is the primary base and 1 secondary polygon", () => {
    const { body } = crestShapes(spec({ pattern: "sash" }));
    expect(body.map((shape) => shape.kind)).toEqual(["rect", "polygon"]);
    expect(body[1].fill).toBe("#ffffff");
  });
  it("halves are 2 rects, primary then secondary", () => {
    const { body } = crestShapes(spec({ pattern: "halves" }));
    expect(body.map((shape) => shape.kind)).toEqual(["rect", "rect"]);
    expect(body.map((shape) => shape.fill)).toEqual(["#d62828", "#ffffff"]);
  });
  it("other is the primary base and a horizontal chest band", () => {
    const { body } = crestShapes(spec({ pattern: "other" }));
    expect(body).toHaveLength(2);
    expect(body[1]).toMatchObject({ kind: "rect", fill: "#ffffff" });
  });
});

describe("crestShapes frame and initials", () => {
  it("outlines in the tertiary color when there is one, else the secondary", () => {
    expect(crestShapes(spec({ tertiary: "#111111" })).outline).toEqual({
      path: SHIELD_PATH,
      stroke: "#111111",
    });
    expect(crestShapes(spec({})).outline.stroke).toBe("#ffffff");
  });
  it("paints the chief in the primary color with the given ink", () => {
    const { chief, initials } = crestShapes(spec({ initialsInk: "#0a1a00" }));
    expect(chief.fill).toBe("#d62828");
    expect(initials).toMatchObject({ text: "RP", fill: "#0a1a00" });
  });
  it("sizes the initials by length", () => {
    const size = (initials: string) => crestShapes(spec({ initials })).initials.fontSize;
    expect(size("R")).toBe(26);
    expect(size("RP")).toBe(26);
    expect(size("HUR")).toBe(22);
    expect(size("GELP")).toBe(17);
  });
  it("uses a 100 x 120 viewBox", () => {
    expect(CREST_VIEWBOX).toBe("0 0 100 120");
  });
});
