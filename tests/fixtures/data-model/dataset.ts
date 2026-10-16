// FICTIONAL test data. Clubs, competitions, scores and dates below are invented for
// tests only (sources are "fixture:synthetic"); none of it is real football history.
import type {
  Club,
  Competition,
  Coverage,
  Dataset,
  Match,
  Movement,
  Rivalry,
  Season,
  Standing,
  Title,
} from "@/data-model/types";

export const FIXED_NOW = new Date("2026-10-16T15:00:00Z");

export const SYNTHETIC = "fixture:synthetic";

export type FixtureDataset = Dataset;

function club(id: string, letter: string, primary: string, pattern: Club["jersey_pattern"]): Club {
  return {
    id,
    name: `Club Ficticio ${letter}`,
    short_name: `Ficticio ${letter}`,
    aliases: [`CF${letter}`],
    colors: { primary, secondary: "#FFFFFF" },
    jersey_pattern: pattern,
    founded: 1900,
    city: "Ciudad Ficticia",
    source: SYNTHETIC,
  };
}

function match(
  id: string,
  seasonId: string,
  date: string,
  homeId: string,
  awayId: string,
  homeGoals: number | null,
  awayGoals: number | null,
  extra: Partial<Match> = {},
): Match {
  return {
    id,
    season_id: seasonId,
    date,
    home_id: homeId,
    away_id: awayId,
    home_goals: homeGoals,
    away_goals: awayGoals,
    decision: null,
    home_penalties: null,
    away_penalties: null,
    stage: "Regular",
    is_final: false,
    status: "played",
    source: SYNTHETIC,
    verified: false,
    ...extra,
  };
}

/** A fresh, valid synthetic dataset. Safe to mutate in tests. */
export function validDataset(): FixtureDataset {
  return {
    "clubs.json": [
      club("club-a", "A", "#112233", "solid"),
      club("club-b", "B", "#aa0000", "hoops"),
      club("club-c", "C", "#00aa00", "vertical_stripes"),
      club("club-d", "D", "#0000aa", "halves"),
    ],
    "competitions.json": [
      {
        id: "league-x",
        name: "Liga Ficticia X",
        type: "league",
        scope: "domestic",
        organizer: "Organizador Ficticio",
        afa_recognized: true,
        source: SYNTHETIC,
      },
      {
        id: "cup-y",
        name: "Copa Ficticia Y",
        type: "national_cup",
        scope: "domestic",
        organizer: "Organizador Ficticio",
        afa_recognized: true,
        source: SYNTHETIC,
      },
    ],
    "seasons.json": [
      {
        id: "league-x-2020",
        competition_id: "league-x",
        name: "2020",
        start: "2020-01-01",
        end: "2020-12-31",
        source: SYNTHETIC,
      },
      {
        id: "cup-y-2020",
        competition_id: "cup-y",
        name: "2020",
        start: "2020-01-01",
        end: "2020-12-31",
        source: SYNTHETIC,
      },
      {
        id: "league-x-2021",
        competition_id: "league-x",
        name: "2021",
        start: "2021-01-01",
        end: "2021-12-31",
        source: SYNTHETIC,
      },
    ],
    "matches.json": [
      match("m1", "league-x-2020", "2020-03-01", "club-a", "club-b", 2, 0),
      match("m2", "league-x-2020", "2020-03-08", "club-c", "club-a", 1, 1),
      match("m3", "league-x-2020", "2020-03-15", "club-a", "club-d", 0, 1),
      match("m4", "league-x-2020", "2020-03-22", "club-b", "club-c", null, null, {
        status: "suspended",
      }),
      match("m5", "league-x-2020", "2020-03-29", "club-d", "club-a", 0, 3, {
        status: "administrative_result",
      }),
      match("m6", "cup-y-2020", "2020-06-01", "club-a", "club-c", 1, 1, {
        decision: "penalties",
        home_penalties: 4,
        away_penalties: 3,
        stage: "Final",
        is_final: true,
      }),
      match("m7", "cup-y-2020", "2020-05-01", "club-b", "club-d", 2, 1, {
        decision: "extra_time",
        stage: "Semifinal",
      }),
      match("m8", "league-x-2021", "2021-03-01", "club-b", "club-a", 1, 2),
    ],
    "titles.json": [
      {
        id: "t1",
        club_id: "club-a",
        competition_id: "league-x",
        season_id: "league-x-2020",
        awarded_on: "2020-12-01",
        shared: false,
        source: SYNTHETIC,
        verified: false,
      },
      {
        id: "t2",
        club_id: "club-a",
        competition_id: "cup-y",
        season_id: "cup-y-2020",
        awarded_on: "2020-06-01",
        shared: false,
        source: SYNTHETIC,
        verified: false,
      },
    ],
    "movements.json": [
      {
        id: "mv1",
        club_id: "club-d",
        type: "relegation",
        date: "2020-12-31",
        season_id: "league-x-2020",
        source: SYNTHETIC,
      },
    ],
    "rivalries.json": [{ club_a: "club-a", club_b: "club-b", is_classic: true, source: SYNTHETIC }],
    "coverage.json": [
      {
        club_id: "club-a",
        competition_id: "league-x",
        from: "2020-01-01",
        to: null,
        complete: true,
        source: SYNTHETIC,
      },
      {
        club_id: "club-a",
        competition_id: "cup-y",
        from: "2020-01-01",
        to: null,
        complete: true,
        source: SYNTHETIC,
      },
    ],
    "standings.json": [
      {
        club_id: "club-a",
        season_id: "league-x-2020",
        played: 4,
        won: 2,
        drawn: 1,
        lost: 1,
        source: SYNTHETIC,
      },
    ],
  };
}
