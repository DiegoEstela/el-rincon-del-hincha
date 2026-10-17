// Clubs used by the openfootball ingestion tests: the real `data/clubs.json`. Since plan 0012 every
// team name of the eight pinned files resolves, so no synthetic club is needed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Club } from "../../../../src/data-model/types";

export const REAL_CLUBS = JSON.parse(
  readFileSync(join(process.cwd(), "data/clubs.json"), "utf8"),
) as Club[];

export const FIXTURE_CLUBS: Club[] = REAL_CLUBS;

/**
 * The real clubs without Colón de Santa Fe, so tests can still exercise the "unknown club stops
 * the run" path (ADR 0015, decision 6). Colón plays in six of the eight files.
 */
export const CLUBS_WITHOUT_COLON: Club[] = REAL_CLUBS.filter((c) => c.id !== "colon");
export const COLON_SPELLING = "Colón de Santa Fe";
