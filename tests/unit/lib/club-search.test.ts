import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clubSchema } from "@/data-model/schemas";
import { toClubOption } from "@/lib/club-options";
import { searchClubs, searchFold, type SearchableClub } from "@/lib/club-search";

const fixture: SearchableClub[] = [
  { id: "a", searchKeys: ["Alfa Club", "Alfa"] },
  { id: "b", searchKeys: ["Beta Alfa", "Beta"] },
  { id: "c", searchKeys: ["Gamma", "Super Alfa Mix"] },
];
const ids = (list: SearchableClub[]) => list.map((c) => c.id);

describe("searchFold", () => {
  it("drops case, accents, dots, apostrophes and extra spaces", () => {
    expect(searchFold("  Atl.  Tucumán ")).toBe("atl tucuman");
    expect(searchFold("Newell’s")).toBe("newells");
    expect(searchFold("Newell's")).toBe("newells");
  });
});

describe("searchClubs on a fixture", () => {
  it("returns every club in order for an empty or blank query", () => {
    expect(ids(searchClubs(fixture, ""))).toEqual(["a", "b", "c"]);
    expect(ids(searchClubs(fixture, "   "))).toEqual(["a", "b", "c"]);
  });
  it("ranks exact, then prefix, then word prefix, then contains", () => {
    const clubs: SearchableClub[] = [
      { id: "contains", searchKeys: ["Xalfax"] },
      { id: "word", searchKeys: ["Beta Alfa"] },
      { id: "prefix", searchKeys: ["Alfa Club"] },
      { id: "exact", searchKeys: ["Alfa"] },
    ];
    expect(ids(searchClubs(clubs, "alfa"))).toEqual(["exact", "prefix", "word", "contains"]);
  });
  it("splits words on spaces, hyphens and parentheses", () => {
    const clubs: SearchableClub[] = [
      { id: "h", searchKeys: ["Uno-Dos"] },
      { id: "p", searchKeys: ["Uno (Dos)"] },
    ];
    expect(ids(searchClubs(clubs, "dos"))).toEqual(["h", "p"]);
  });
  it("keeps input order on ties and excludes non matches", () => {
    expect(ids(searchClubs(fixture, "alfa"))).toEqual(["a", "b", "c"]);
    expect(searchClubs(fixture, "zzz")).toEqual([]);
  });
  it("scores a club by its best key", () => {
    const clubs: SearchableClub[] = [
      { id: "late", searchKeys: ["Zeta Alfa"] },
      { id: "best", searchKeys: ["Zeta", "Alfa"] },
    ];
    expect(ids(searchClubs(clubs, "alfa"))).toEqual(["best", "late"]);
  });
});

const clubs = clubSchema
  .array()
  .parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8").replace(/^﻿/, "")),
  )
  // The keys the picker really uses: source-only aliases ("CA Boca Juniors") are left out.
  .map((c) => toClubOption(c));

describe("searchClubs on the real dataset", () => {
  it("finds Vélez however it is typed", () => {
    for (const q of ["VELEZ", "vélez", "velez"]) {
      expect(ids(searchClubs(clubs, q))).toEqual(["velez-sarsfield"]);
    }
  });
  it("finds Newell's with and without the apostrophe", () => {
    expect(ids(searchClubs(clubs, "newells"))).toEqual(["newells-old-boys"]);
    expect(ids(searchClubs(clubs, "newell's"))).toEqual(["newells-old-boys"]);
  });
  it("finds Atlético Tucumán by its abbreviation", () => {
    expect(ids(searchClubs(clubs, "atl tucuman"))).toEqual(["atletico-tucuman"]);
    expect(ids(searchClubs(clubs, "Atl. Tucumán"))).toEqual(["atletico-tucuman"]);
  });
  it("ranks the Centrals: Rosario first, then Córdoba, then Barracas", () => {
    expect(ids(searchClubs(clubs, "central"))).toEqual([
      "rosario-central",
      "central-cordoba-sde",
      "barracas-central",
    ]);
  });
  it("finds both La Plata clubs", () => {
    expect(ids(searchClubs(clubs, "la plata"))).toEqual([
      "estudiantes-la-plata",
      "gimnasia-la-plata",
    ]);
  });
  it("ranks the San clubs before Unión (alias 'Unión de Santa Fe')", () => {
    const found = ids(searchClubs(clubs, "san"));
    expect(found.slice(0, 2)).toEqual(["san-lorenzo", "san-martin-san-juan"]);
    expect(found).toContain("union");
    expect(found.indexOf("union")).toBeGreaterThan(1);
  });
  it("returns nothing for gibberish", () => {
    expect(searchClubs(clubs, "zzz")).toEqual([]);
  });
});
