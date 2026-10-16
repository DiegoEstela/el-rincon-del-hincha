import { describe, expect, it } from "vitest";
import { foldName, resolveClubId } from "@/data-model/club-aliases";

// The accented strings use explicit unicode escapes on purpose: a formatter or an editor could
// silently normalize literal characters and turn these tests into a comparison of equal strings.
const COMPOSED = "Vélez Sarsfield"; // e with acute accent as one code point (NFC)
const DECOMPOSED = "Vélez Sarsfield"; // e followed by U+0301 combining acute accent (NFD)

const clubs = [
  { id: "velez-sarsfield", aliases: ["Vélez Sarsfield", "Velez"] },
  { id: "huracan", aliases: ["Huracán", "Huracan"] },
  { id: "independiente", aliases: ["Independiente"] },
  { id: "independiente-rivadavia", aliases: ["Independiente Rivadavia", "Ind Rivadavia"] },
];

describe("foldName", () => {
  it("lowercases, strips diacritics and collapses spaces", () => {
    expect(foldName("  Vélez   Sarsfield ")).toBe("velez sarsfield");
    expect(foldName("Lanús")).toBe("lanus");
  });

  it("folds composed and decomposed accents to the same value", () => {
    expect(COMPOSED).not.toBe(DECOMPOSED);
    expect(foldName(COMPOSED)).toBe(foldName(DECOMPOSED));
  });
});

describe("resolveClubId", () => {
  it("resolves an exact alias", () => {
    expect(resolveClubId(clubs, "Vélez Sarsfield")).toBe("velez-sarsfield");
    expect(resolveClubId(clubs, "Ind Rivadavia")).toBe("independiente-rivadavia");
  });

  it("resolves composed and decomposed accents the same", () => {
    expect(COMPOSED).not.toBe(DECOMPOSED);
    expect(resolveClubId(clubs, COMPOSED)).toBe("velez-sarsfield");
    expect(resolveClubId(clubs, DECOMPOSED)).toBe("velez-sarsfield");
  });

  it("trims surrounding spaces", () => {
    expect(resolveClubId(clubs, "  Huracán ")).toBe("huracan");
  });

  it("does not resolve case differences", () => {
    expect(resolveClubId(clubs, "velez")).toBeNull();
  });

  it("does not resolve lookalikes or prefixes", () => {
    expect(resolveClubId(clubs, "Huracan (C)")).toBeNull();
    expect(resolveClubId(clubs, "Independiente Rivadavia")).toBe("independiente-rivadavia");
    expect(resolveClubId(clubs, "Independiente Riv")).toBeNull();
  });

  it("returns null for an unknown name", () => {
    expect(resolveClubId(clubs, "Nadie FC")).toBeNull();
  });
});
