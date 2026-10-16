import { describe, expect, it } from "vitest";
import {
  DATASET_FILES,
  KEY_FIELDS,
  clubSchema,
  competitionSchema,
  coverageSchema,
  matchSchema,
  movementSchema,
  recordKey,
  rivalrySchema,
  seasonSchema,
  standingSchema,
  titleSchema,
} from "@/data-model/schemas";

const SRC = "fixture:synthetic";

const club = {
  id: "club-a",
  name: "Club Ficticio A",
  short_name: "Ficticio A",
  aliases: ["CFA"],
  colors: { primary: "#112233", secondary: "#FFFFFF" },
  jersey_pattern: "solid",
  founded: 1900,
  city: "Ciudad Uno",
  source: SRC,
};
const competition = {
  id: "league-x",
  name: "Liga X",
  type: "league",
  scope: "domestic",
  organizer: "Organizador Ficticio",
  afa_recognized: true,
  source: SRC,
};
const season = {
  id: "league-x-2020",
  competition_id: "league-x",
  name: "2020",
  start: "2020-01-01",
  end: "2020-12-31",
  source: SRC,
};
const match = {
  id: "m1",
  season_id: "league-x-2020",
  date: "2020-03-01",
  home_id: "club-a",
  away_id: "club-b",
  home_goals: 1,
  away_goals: 0,
  decision: null,
  home_penalties: null,
  away_penalties: null,
  stage: "Round 1",
  is_final: false,
  status: "played",
  source: SRC,
  verified: false,
};
const title = {
  id: "t1",
  club_id: "club-a",
  competition_id: "league-x",
  season_id: "league-x-2020",
  awarded_on: "2020-12-01",
  shared: false,
  source: SRC,
  verified: true,
};
const movement = {
  id: "mv1",
  club_id: "club-a",
  type: "relegation",
  date: "2020-12-01",
  season_id: "league-x-2020",
  source: SRC,
};
const rivalry = { club_a: "club-a", club_b: "club-b", is_classic: true, source: SRC };
const coverage = {
  club_id: "club-a",
  competition_id: "league-x",
  from: "2020-01-01",
  to: null,
  complete: true,
  source: SRC,
};
const standing = {
  club_id: "club-a",
  season_id: "league-x-2020",
  played: 3,
  won: 1,
  drawn: 1,
  lost: 1,
  source: SRC,
};

const without = (o: Record<string, unknown>, k: string) =>
  Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe("clubSchema", () => {
  it("parses a valid record, with optional tertiary color", () => {
    expect(ok(clubSchema, club)).toBe(true);
    const withTertiary = { ...club, colors: { ...club.colors, tertiary: "#abcdef" } };
    expect(ok(clubSchema, withTertiary)).toBe(true);
  });
  it.each(["solid", "vertical_stripes", "sash", "hoops", "halves", "other"])(
    "accepts jersey pattern %s",
    (p) => expect(ok(clubSchema, { ...club, jersey_pattern: p })).toBe(true),
  );
  it("rejects an unknown jersey pattern", () => {
    expect(ok(clubSchema, { ...club, jersey_pattern: "bastones" })).toBe(false);
  });
  it("rejects non-hex colors", () => {
    expect(ok(clubSchema, { ...club, colors: { primary: "red", secondary: "#FFFFFF" } })).toBe(
      false,
    );
  });
  it("rejects a non-integer founded year", () => {
    expect(ok(clubSchema, { ...club, founded: 1900.5 })).toBe(false);
  });
  it("rejects unknown keys (strict)", () => {
    expect(ok(clubSchema, { ...club, fuente: "x" })).toBe(false);
  });
  it("rejects a blank source", () => {
    expect(ok(clubSchema, { ...club, source: "  " })).toBe(false);
  });
});

describe("competitionSchema", () => {
  it("parses a valid record, notes optional", () => {
    expect(ok(competitionSchema, competition)).toBe(true);
    expect(ok(competitionSchema, { ...competition, notes: "n" })).toBe(true);
  });
  it.each([
    ["type", "tournament"],
    ["scope", "regional"],
  ])("rejects an unknown %s", (k, v) => {
    expect(ok(competitionSchema, { ...competition, [k]: v })).toBe(false);
  });
  it.each(["league", "national_cup", "international", "other"])("accepts type %s", (t) =>
    expect(ok(competitionSchema, { ...competition, type: t })).toBe(true),
  );
});

describe("seasonSchema", () => {
  it("parses a valid record", () => {
    expect(ok(seasonSchema, season)).toBe(true);
  });
  it("rejects impossible dates", () => {
    expect(ok(seasonSchema, { ...season, start: "2026-02-30" })).toBe(false);
    expect(ok(seasonSchema, { ...season, end: "2026-13-01" })).toBe(false);
  });
});

describe("matchSchema", () => {
  it("parses a valid record", () => {
    expect(ok(matchSchema, match)).toBe(true);
  });
  it("accepts null goals (suspended)", () => {
    expect(
      ok(matchSchema, { ...match, status: "suspended", home_goals: null, away_goals: null }),
    ).toBe(true);
  });
  it.each(["penalties", "extra_time", null])("accepts decision %s", (d) =>
    expect(ok(matchSchema, { ...match, decision: d })).toBe(true),
  );
  it("rejects an unknown decision or status", () => {
    expect(ok(matchSchema, { ...match, decision: "golden_goal" })).toBe(false);
    expect(ok(matchSchema, { ...match, status: "postponed" })).toBe(false);
  });
  it("accepts all three statuses", () => {
    for (const status of ["played", "suspended", "administrative_result"]) {
      expect(ok(matchSchema, { ...match, status })).toBe(true);
    }
  });
  it("requires verified", () => {
    expect(ok(matchSchema, without(match, "verified"))).toBe(false);
  });
  it("rejects non-integer goals but allows negatives at shape level", () => {
    expect(ok(matchSchema, { ...match, home_goals: 1.5 })).toBe(false);
    expect(ok(matchSchema, { ...match, home_goals: -1 })).toBe(true);
  });
});

describe("titleSchema", () => {
  it("parses a valid record", () => {
    expect(ok(titleSchema, title)).toBe(true);
  });
  it("requires shared", () => {
    expect(ok(titleSchema, without(title, "shared"))).toBe(false);
  });
});

describe("movementSchema", () => {
  it("parses and validates the type enum", () => {
    expect(ok(movementSchema, movement)).toBe(true);
    expect(ok(movementSchema, { ...movement, type: "promotion" })).toBe(true);
    expect(ok(movementSchema, { ...movement, type: "descenso" })).toBe(false);
  });
});

describe("rivalrySchema", () => {
  it("parses with and without a name", () => {
    expect(ok(rivalrySchema, rivalry)).toBe(true);
    expect(ok(rivalrySchema, { ...rivalry, name: "Clásico Ficticio" })).toBe(true);
  });
});

describe("coverageSchema", () => {
  it("parses an ongoing and a closed range", () => {
    expect(ok(coverageSchema, coverage)).toBe(true);
    expect(ok(coverageSchema, { ...coverage, to: "2020-12-31" })).toBe(true);
  });
  it("rejects a missing to", () => {
    expect(ok(coverageSchema, without(coverage, "to"))).toBe(false);
  });
});

describe("standingSchema", () => {
  it("parses a valid record and rejects negatives", () => {
    expect(ok(standingSchema, standing)).toBe(true);
    expect(ok(standingSchema, { ...standing, won: -1 })).toBe(false);
  });
});

describe("DATASET_FILES / recordKey", () => {
  it("lists exactly the nine files", () => {
    expect([...DATASET_FILES].sort()).toEqual(
      [
        "clubs.json",
        "competitions.json",
        "coverage.json",
        "matches.json",
        "movements.json",
        "rivalries.json",
        "seasons.json",
        "standings.json",
        "titles.json",
      ].sort(),
    );
  });
  it("returns ids or composite keys", () => {
    expect(recordKey("clubs.json", club)).toBe("club-a");
    expect(recordKey("matches.json", match)).toBe("m1");
    expect(recordKey("rivalries.json", rivalry)).toBe("club-a~club-b");
    expect(recordKey("coverage.json", coverage)).toBe("club-a/league-x/2020-01-01");
    expect(recordKey("standings.json", standing)).toBe("club-a/league-x-2020");
  });
});

describe("recordKey on unusable records", () => {
  it("returns null for non-objects and missing key fields", () => {
    expect(recordKey("clubs.json", null)).toBeNull();
    expect(recordKey("clubs.json", "x")).toBeNull();
    expect(recordKey("clubs.json", {})).toBeNull();
    expect(recordKey("clubs.json", { id: "" })).toBeNull();
    expect(recordKey("rivalries.json", { club_a: "a" })).toBeNull();
  });
});

describe("KEY_FIELDS", () => {
  it("has an entry per dataset file and drives recordKey", () => {
    expect(Object.keys(KEY_FIELDS).sort()).toEqual([...DATASET_FILES].sort());
    expect(KEY_FIELDS["coverage.json"].fields).toEqual(["club_id", "competition_id", "from"]);
    expect(KEY_FIELDS["clubs.json"].fields).toEqual(["id"]);
  });
});
