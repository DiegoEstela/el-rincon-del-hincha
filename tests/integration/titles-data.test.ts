// Plan 0017, T20: the titles in data/ checked against the matches with code that does not use the
// adapter. The champions come from the RSSSF list of champions, from the final in openfootball (the
// 2020 Copa de la Liga) and from the final of each domestic cup in RSSSF (Phase B2).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { matchSchema, titleSchema } from "@/data-model/schemas";

const read = (file: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf8")) as unknown[];
const titles = titleSchema.array().parse(read("titles.json"));
const matches = matchSchema.array().parse(read("matches.json"));

const EXPECTED: [season: string, club: string][] = [
  ["copa-de-la-liga-profesional-2020", "boca-juniors"],
  ["primera-division-2018-19", "racing-club"],
  ["primera-division-2019-20", "boca-juniors"],
  ["primera-division-2021", "river-plate"],
  ["primera-division-2022", "boca-juniors"],
  ["primera-division-2023", "river-plate"],
  ["primera-division-2024", "velez-sarsfield"],
  ["primera-division-2025-apertura", "platense"],
  ["primera-division-2025-clausura", "estudiantes-la-plata"],
  // The domestic cups of 2023 to 2025, from their finals (checked against the Spanish Wikipedia).
  ["copa-argentina-2023", "estudiantes-la-plata"],
  ["copa-argentina-2024", "central-cordoba-sde"],
  ["copa-argentina-2025", "independiente-rivadavia"],
  ["supercopa-argentina-2023", "river-plate"],
  ["supercopa-argentina-2024", "velez-sarsfield"],
  ["supercopa-internacional-2023", "talleres-cordoba"],
  ["supercopa-internacional-2024", "velez-sarsfield"],
  ["supercopa-internacional-2025", "rosario-central"],
  ["trofeo-de-campeones-2023", "river-plate"],
  ["trofeo-de-campeones-2024", "estudiantes-la-plata"],
  ["trofeo-de-campeones-2025", "estudiantes-la-plata"],
];

describe("data/titles.json", () => {
  it("has the champion of each loaded season, and nothing else", () => {
    expect(titles.map((t) => [t.season_id, t.club_id]).sort()).toEqual(EXPECTED.slice().sort());
    expect(titles.every((t) => !t.shared && !t.verified)).toBe(true);
  });

  it("never holds the 2025 Anual LPF, which the regulations did not foresee", () => {
    expect(
      titles.some(
        (t) => t.club_id === "rosario-central" && t.competition_id === "primera-division",
      ),
    ).toBe(false);
  });

  it("dates each title on its final, or on the last match of the season", () => {
    for (const title of titles) {
      const season = matches.filter((m) => m.season_id === title.season_id);
      const finals = season.filter((m) => m.is_final).map((m) => m.date);
      const expected = (finals.length > 0 ? finals : season.map((m) => m.date)).sort().at(-1);
      expect(title.awarded_on, title.id).toBe(expected);
    }
  });

  it("has a champion who played in the season, and sources that exist", () => {
    for (const title of titles) {
      const played = matches.some(
        (m) =>
          m.season_id === title.season_id &&
          (m.home_id === title.club_id || m.away_id === title.club_id),
      );
      expect(played, title.id).toBe(true);
      expect(title.source, title.id).toMatch(
        /^https:\/\/(www\.rsssf\.org\/tablesa\/(argchamp\.html#champions|arg\d{4}\.html#[a-z0-9]+)|github\.com\/openfootball\/)/,
      );
    }
  });

  it("names Boca as winner of the 2020 final on penalties", () => {
    const final = matches.find((m) => m.id === "2021-01-17-boca-juniors-banfield")!;
    expect(final).toMatchObject({
      home_goals: 1,
      away_goals: 1,
      home_penalties: 5,
      away_penalties: 3,
    });
    expect(titles.find((t) => t.season_id === final.season_id)?.source).toBe(final.source);
  });
});
