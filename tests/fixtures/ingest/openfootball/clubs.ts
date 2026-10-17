// Clubs used by the openfootball ingestion tests: the real `data/clubs.json` plus five synthetic
// records for the names that are not in it yet (issue #48 and the four former Primera clubs).
// The ids of the synthetic records are test-only; issue #8 chooses the real ones.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Club } from "../../../../src/data-model/types";

export const REAL_CLUBS = JSON.parse(
  readFileSync(join(process.cwd(), "data/clubs.json"), "utf8"),
) as Club[];

function synthetic(id: string, name: string): Club {
  return {
    id,
    name,
    short_name: name,
    aliases: [name],
    colors: { primary: "#123456", secondary: "#abcdef" },
    jersey_pattern: "solid",
    founded: 1900,
    city: "Test",
    source: "https://example.org/synthetic-test-club",
  };
}

/** Names that do not resolve against the real clubs.json today (plan 0011, facts table). */
export const MISSING_NAMES = [
  "Arsenal de Sarandí",
  "Colón de Santa Fe",
  "Independiente Rivadavia",
  "Patronato de Paraná",
  "San Martín de Tucumán",
] as const;

export const SYNTHETIC_CLUBS: Club[] = [
  synthetic("arsenal-de-sarandi", "Arsenal de Sarandí"),
  synthetic("colon-de-santa-fe", "Colón de Santa Fe"),
  synthetic("independiente-rivadavia", "Independiente Rivadavia"),
  synthetic("patronato-de-parana", "Patronato de Paraná"),
  synthetic("san-martin-de-tucuman", "San Martín de Tucumán"),
];

export const FIXTURE_CLUBS: Club[] = [...REAL_CLUBS, ...SYNTHETIC_CLUBS];
