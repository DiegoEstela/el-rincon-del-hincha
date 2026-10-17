import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FORMER_CLUB_ROWS,
  KAGGLE_CLUB_NAMES,
  KAGGLE_LOOKALIKE_NAMES,
  NEAR_MISS_NAMES,
  OPENFOOTBALL_2025_NAMES,
} from "../../fixtures/clubs/source-names";

const OPENFOOTBALL_DIR = join(process.cwd(), "tests/fixtures/ingest/openfootball");
const openfootballText = ["2018-19", "2019-20", "2020", "2021", "2022", "2023", "2024", "2025"]
  .map((f) => readFileSync(join(OPENFOOTBALL_DIR, `${f}_ar1.txt`), "utf8"))
  .join("\n");

describe("club source-name fixtures", () => {
  it("lists the 30 unique openfootball 2025 names", () => {
    expect(OPENFOOTBALL_2025_NAMES).toHaveLength(30);
    expect(new Set(OPENFOOTBALL_2025_NAMES).size).toBe(30);
  });

  it("lists the four former clubs with unique ids and the exact source spellings", () => {
    expect(FORMER_CLUB_ROWS.map((r) => [r.id, r.openfootball, r.kaggle])).toEqual([
      ["arsenal", "Arsenal de Sarandí", "Arsenal"],
      ["colon", "Colón de Santa Fe", "Colon"],
      ["patronato", "Patronato de Paraná", "Patronato"],
      ["san-martin-tucuman", "San Martín de Tucumán", "San Martin (T)"],
    ]);
    expect(new Set(FORMER_CLUB_ROWS.map((r) => r.id)).size).toBe(4);
  });

  it("proves each former openfootball spelling against the pinned files", () => {
    for (const row of FORMER_CLUB_ROWS) {
      expect(openfootballText.includes(` ${row.openfootball} `), row.openfootball).toBe(true);
    }
  });

  it("lists the 33 unique Kaggle names of the 2025 and former clubs", () => {
    expect(Object.keys(KAGGLE_CLUB_NAMES)).toHaveLength(33);
    expect(new Set(Object.keys(KAGGLE_CLUB_NAMES)).size).toBe(33);
    expect(KAGGLE_CLUB_NAMES["San Martin (T)"]).toBe("san-martin-tucuman");
  });

  it("keeps the lookalike Kaggle names disjoint from every known name", () => {
    const known = new Set([
      ...OPENFOOTBALL_2025_NAMES,
      ...FORMER_CLUB_ROWS.map((r) => r.openfootball),
      ...Object.keys(KAGGLE_CLUB_NAMES),
    ]);
    expect(KAGGLE_LOOKALIKE_NAMES).toHaveLength(20);
    expect(KAGGLE_LOOKALIKE_NAMES).not.toContain("San Martin (T)");
    expect(KAGGLE_LOOKALIKE_NAMES).toContain("San Martin (M)");
    for (const name of KAGGLE_LOOKALIKE_NAMES) expect(known.has(name)).toBe(false);
  });

  it("keeps the near-miss names disjoint from every known name", () => {
    const known = new Set([
      ...OPENFOOTBALL_2025_NAMES,
      ...FORMER_CLUB_ROWS.flatMap((r) => [r.openfootball, r.kaggle]),
      ...Object.keys(KAGGLE_CLUB_NAMES),
    ]);
    expect(NEAR_MISS_NAMES.length).toBeGreaterThan(0);
    for (const name of NEAR_MISS_NAMES) expect(known.has(name), name).toBe(false);
  });
});
