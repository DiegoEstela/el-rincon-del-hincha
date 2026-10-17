import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clubSchema } from "@/data-model/schemas";
import { clubInitials, initialsInk, toClubOption } from "@/lib/club-options";
import { contrastRatio } from "@/lib/contrast";

const clubs = clubSchema
  .array()
  .parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8").replace(/^﻿/, "")),
  );

const EXPECTED: Record<string, string> = {
  aldosivi: "ALD",
  "argentinos-juniors": "AJ",
  arsenal: "ARS",
  colon: "COL",
  "independiente-rivadavia": "IR",
  patronato: "PAT",
  "san-martin-tucuman": "SMT",
  "atletico-tucuman": "AT",
  banfield: "BAN",
  "barracas-central": "BC",
  belgrano: "BEL",
  "boca-juniors": "BJ",
  "central-cordoba-sde": "CC",
  "defensa-y-justicia": "DJ",
  "deportivo-riestra": "DR",
  "estudiantes-la-plata": "ELP",
  "gimnasia-la-plata": "GELP",
  "godoy-cruz": "GC",
  huracan: "HUR",
  independiente: "IND",
  instituto: "INS",
  lanus: "LAN",
  "newells-old-boys": "NOB",
  platense: "PLA",
  "racing-club": "RC",
  "river-plate": "RP",
  "rosario-central": "RC",
  "san-lorenzo": "SL",
  "san-martin-san-juan": "SMSJ",
  "sarmiento-junin": "SAR",
  "talleres-cordoba": "TAL",
  tigre: "TIG",
  union: "UNI",
  "velez-sarsfield": "VS",
};

describe("clubInitials", () => {
  it("matches the approved table for every club", () => {
    expect(clubs).toHaveLength(34);
    for (const club of clubs) expect(clubInitials(club.name)).toBe(EXPECTED[club.id]);
  });
  it("skips de, del and y, and strips accents and apostrophes", () => {
    expect(clubInitials("Boca del Río")).toBe("BR");
    expect(clubInitials("Newell's Old Boys")).toBe("NOB");
    expect(clubInitials("Ñandú Juniors")).toBe("NJ");
  });
  it("uses three letters for one word and caps multiword at four", () => {
    expect(clubInitials("Húracan")).toBe("HUR");
    expect(clubInitials("Al")).toBe("AL");
    expect(clubInitials("Uno Dos Tres Cuatro Cinco")).toBe("UDTC");
  });
});

describe("initialsInk", () => {
  it("picks the ink that contrasts more", () => {
    expect(initialsInk("#ffd60a")).toBe("#0a1a00");
    expect(initialsInk("#0b1f4d")).toBe("#ffffff");
  });
  it("reaches 4.5:1 on every club primary", () => {
    for (const club of clubs) {
      const primary = club.colors.primary;
      expect(contrastRatio(initialsInk(primary), primary), club.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("toClubOption", () => {
  const river = clubs.find((c) => c.id === "river-plate")!;
  it("keeps only the allowed fields", () => {
    const option = toClubOption(river);
    expect(Object.keys(option).sort()).toEqual(["crest", "id", "name", "searchKeys", "shortName"]);
    expect(Object.keys(option.crest).sort()).toEqual([
      "initials",
      "initialsInk",
      "pattern",
      "primary",
      "secondary",
      "tertiary",
    ]);
    const json = JSON.stringify(option);
    expect(json).not.toContain("source");
    expect(json).not.toContain("city");
    expect(json).not.toContain("founded");
  });
  it("maps the crest and omits tertiary when the club has none", () => {
    const option = toClubOption(river);
    expect(option.crest).toMatchObject({ pattern: "sash", initials: "RP", tertiary: "#111111" });
    const plain = toClubOption(clubs.find((c) => c.id === "aldosivi")!);
    expect("tertiary" in plain.crest).toBe(false);
  });
  it("dedupes the search keys, ignoring case and accents", () => {
    expect(toClubOption(clubs.find((c) => c.id === "aldosivi")!).searchKeys).toEqual(["Aldosivi"]);
    expect(toClubOption(clubs.find((c) => c.id === "huracan")!).searchKeys).toEqual(["Huracán"]);
    expect(toClubOption(river).searchKeys).toEqual(["River Plate", "River"]);
  });
});
