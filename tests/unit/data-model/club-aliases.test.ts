import { describe, expect, it } from "vitest";
import { foldName, resolveClubId } from "@/data-model/club-aliases";

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
    expect(foldName("Vélez")).toBe(foldName("Vélez"));
  });
});

describe("resolveClubId", () => {
  it("resolves an exact alias", () => {
    expect(resolveClubId(clubs, "Vélez Sarsfield")).toBe("velez-sarsfield");
    expect(resolveClubId(clubs, "Ind Rivadavia")).toBe("independiente-rivadavia");
  });

  it("resolves composed and decomposed accents the same", () => {
    expect(resolveClubId(clubs, "Vélez Sarsfield")).toBe("velez-sarsfield");
    expect(resolveClubId(clubs, "Vélez Sarsfield")).toBe("velez-sarsfield");
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
