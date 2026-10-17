import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CLUB_IDS, clubDataFor } from "@/lib/club-data.server";

const dataDir = join(process.cwd(), "data");
const clubs = JSON.parse(readFileSync(join(dataDir, "clubs.json"), "utf8")) as { id: string }[];

describe("club-data.server", () => {
  it("lists the 34 club ids in dataset order", () => {
    expect(CLUB_IDS).toHaveLength(34);
    expect(CLUB_IDS).toEqual(clubs.map((c) => c.id));
  });

  it("serves the slice of a club, with its own matches and coverage", () => {
    const doc = clubDataFor("river-plate");
    expect(doc).not.toBeNull();
    expect(doc!.v).toBe(1);
    expect(doc!.clubId).toBe("river-plate");
    expect(doc!.matches.length).toBeGreaterThan(100);
    expect(
      doc!.matches.every((m) => m.home_id === "river-plate" || m.away_id === "river-plate"),
    ).toBe(true);
    expect(doc!.coverage.every((c) => c.club_id === "river-plate")).toBe(true);
    expect(doc!.coverage.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown id and never throws", () => {
    for (const bad of ["nope", "", "BOCA-JUNIORS", "../boca-juniors"]) {
      expect(clubDataFor(bad)).toBeNull();
    }
  });

  it("gives every club a document", () => {
    for (const id of CLUB_IDS) expect(clubDataFor(id)?.clubId).toBe(id);
  });

  it("imports every data file the engine reads that exists in data/", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/club-data.server.ts"), "utf8");
    const used = [
      "clubs.json",
      "competitions.json",
      "seasons.json",
      "matches.json",
      "coverage.json",
      "titles.json",
      "movements.json",
      "rivalries.json",
    ];
    for (const file of used) {
      if (existsSync(join(dataDir, file))) {
        expect(source, `${file} is in data/ but not imported`).toContain(`data/${file}`);
      }
    }
  });
});
