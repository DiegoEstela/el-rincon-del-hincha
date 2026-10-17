import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClubResolver } from "../../../../scripts/ingest/core/club-resolver";
import { KAGGLE_LOOKALIKE_NAMES } from "../../../fixtures/clubs/source-names";

const clubs = JSON.parse(readFileSync("data/clubs.json", "utf8")) as {
  id: string;
  aliases: string[];
}[];
const at = (line: number, season = "s1") => ({ file: "f.txt", line, season });

describe("createClubResolver", () => {
  it("resolves exact names and their NFD spelling", () => {
    const r = createClubResolver(clubs);
    expect(r.resolve("Vélez Sarsfield", at(1))).toBe("velez-sarsfield");
    expect(r.resolve("Vélez Sarsfield".normalize("NFD"), at(2))).toBe("velez-sarsfield");
    expect(r.problems()).toEqual([]);
  });

  it("never resolves lookalike names", () => {
    const r = createClubResolver(clubs);
    for (const name of [...KAGGLE_LOOKALIKE_NAMES, "Velez Sarsfield"]) {
      expect(r.resolve(name, at(1))).toBeNull();
    }
  });

  it("reports every unknown name once, sorted, with its first location", () => {
    const r = createClubResolver(clubs);
    r.resolve("Zeta FC", { file: "a.txt", line: 9, season: "s1" });
    r.resolve("Alfa FC", { file: "a.txt", line: 4, season: "s1" });
    r.resolve("Zeta FC", { file: "b.txt", line: 1, season: "s2" });
    expect(r.problems()).toEqual([
      'unknown club "Alfa FC" (first seen at a.txt:4)',
      'unknown club "Zeta FC" (first seen at a.txt:9)',
    ]);
  });

  it("fails when two names of one season resolve to the same club", () => {
    const r = createClubResolver([{ id: "x", aliases: ["X One", "X Two"] }]);
    r.resolve("X One", at(1, "2024"));
    r.resolve("X Two", at(2, "2024"));
    expect(r.problems()).toEqual(['season 2024: "X One" and "X Two" both resolve to the club "x"']);
  });

  it("allows the two spellings in different seasons", () => {
    const r = createClubResolver([{ id: "x", aliases: ["X One", "X Two"] }]);
    r.resolve("X One", at(1, "2023"));
    r.resolve("X Two", at(2, "2024"));
    expect(r.problems()).toEqual([]);
  });
});
