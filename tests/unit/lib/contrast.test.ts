import { describe, expect, it } from "vitest";
import { composite, contrastRatio, meetsAA, parseColor, relativeLuminance } from "@/lib/contrast";

describe("parseColor", () => {
  it("parses 6 and 3 digit hex, any case", () => {
    expect(parseColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#FFF")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#0a1a00")).toEqual({ r: 10, g: 26, b: 0, a: 1 });
  });

  it("parses rgb() with alpha using space syntax", () => {
    expect(parseColor("rgb(255 255 255 / 0.06)")).toEqual({ r: 255, g: 255, b: 255, a: 0.06 });
  });

  it("parses rgb() without alpha", () => {
    expect(parseColor("rgb(10 20 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });

  it("throws on invalid input", () => {
    expect(() => parseColor("nope")).toThrow();
    expect(() => parseColor("#12")).toThrow();
  });
});

describe("relativeLuminance / contrastRatio", () => {
  it("black is 0 and white is 1", () => {
    expect(relativeLuminance("#000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 5);
  });

  it("white on black is 21, identical colors are 1", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#c6ff3d", "#07140d")).toBeCloseTo(
      contrastRatio("#07140d", "#c6ff3d"),
      10,
    );
  });
});

describe("composite", () => {
  it("returns the background at alpha 0 and the foreground at alpha 1", () => {
    expect(composite("rgb(255 255 255 / 0)", "#07140d")).toBe("#07140d");
    expect(composite("#ff0000", "#07140d")).toBe("#ff0000");
  });

  it("blends 6% white over the background", () => {
    expect(composite("rgb(255 255 255 / 0.06)", "#07140d")).toBe("#16221c");
  });
});

describe("meetsAA", () => {
  it("requires 4.5 for text", () => {
    expect(meetsAA(4.49, "text")).toBe(false);
    expect(meetsAA(4.5, "text")).toBe(true);
  });

  it("requires 3 for large text and UI", () => {
    expect(meetsAA(2.99, "large")).toBe(false);
    expect(meetsAA(3, "large")).toBe(true);
    expect(meetsAA(3, "ui")).toBe(true);
    expect(meetsAA(2.99, "ui")).toBe(false);
  });
});
