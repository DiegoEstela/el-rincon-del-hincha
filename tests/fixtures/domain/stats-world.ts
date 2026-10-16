// FICTIONAL test data. Clubs, competitions, scores and dates are invented for tests only
// (every source is "fixture:synthetic"); none of it is real football history.
//
// statsWorld() extends the small valid dataset with the situations the statistics engine
// has to handle. It always passes `validate()` (see tests/unit/domain/stats-world.test.ts).
//
// Club A vs club B, in date order (club A's view):
//   2020-03-01 W 2-0 (m1)      2021-03-01 W 2-1 away (m8)   2021-11-01 W 2-0 final leg 1
//   2021-11-08 L 0-1 final leg 2 (A wins the final 2-1 on aggregate)
//   2022-11-01 W 1-0 final leg 1   2022-11-08 D 1-1 final leg 2, A wins 4-3 on penalties
//   2023-04-01 L 0-3          2024-04-01 W 4-0 (biggest played win)
//   2024-06-01 suspended      2024-08-01 W 5-0 administrative (never the biggest win)
// => 9 counted: 6 W, 1 D, 2 L, best win streak 3 (2020-03-01 to 2021-11-01), current W streak 2.
import {
  makeCompetition,
  makeCoverage,
  makeMatch,
  makeSeason,
  makeTitle,
  validDataset,
  type FixtureDataset,
} from "../data-model/dataset";

const year = (competition: string, y: number) =>
  makeSeason(`${competition}-${y}`, competition, `${y}-01-01`, `${y}-12-31`);

function final() {
  return { stage: "Final", is_final: true };
}

export function statsWorld(): FixtureDataset {
  const ds = validDataset();

  ds["competitions.json"].push(
    makeCompetition("intl-z", { type: "international", scope: "international" }),
    makeCompetition("league-old", { afa_recognized: false }),
  );
  ds["seasons.json"].push(
    year("league-x", 2022),
    year("league-x", 2023),
    year("league-x", 2024),
    year("cup-y", 2021),
    year("cup-y", 2022),
    year("intl-z", 2022),
    year("league-old", 2021),
  );

  ds["matches.json"].push(
    makeMatch("w1", "cup-y-2021", "2021-11-01", "club-a", "club-b", 2, 0, final()),
    makeMatch("w2", "cup-y-2021", "2021-11-08", "club-b", "club-a", 1, 0, final()),
    makeMatch("w3", "cup-y-2022", "2022-11-01", "club-a", "club-b", 1, 0, final()),
    makeMatch("w4", "cup-y-2022", "2022-11-08", "club-b", "club-a", 1, 1, {
      ...final(),
      decision: "penalties",
      home_penalties: 3,
      away_penalties: 4,
    }),
    makeMatch("w5", "league-x-2023", "2023-04-01", "club-b", "club-a", 3, 0),
    makeMatch("w6", "league-x-2024", "2024-04-01", "club-a", "club-b", 4, 0),
    makeMatch("w7", "league-x-2024", "2024-06-01", "club-b", "club-a", null, null, {
      status: "suspended",
    }),
    makeMatch("w8", "league-x-2024", "2024-08-01", "club-b", "club-a", 0, 5, {
      status: "administrative_result",
    }),
    makeMatch("w9", "intl-z-2022", "2022-10-01", "club-a", "club-c", 1, 0, {
      stage: "Semifinal",
    }),
    makeMatch("w10", "intl-z-2022", "2022-12-01", "club-b", "club-c", 2, 0, final()),
    makeMatch("w11", "league-x-2022", "2022-03-01", "club-c", "club-d", 1, 0),
    makeMatch("w12", "league-x-2022", "2022-09-01", "club-d", "club-c", 2, 2),
    makeMatch("w13", "league-x-2023", "2023-05-01", "club-c", "club-d", 0, 2),
  );

  ds["titles.json"].push(
    makeTitle("t3", "club-a", "cup-y", "cup-y-2021", "2021-11-08"),
    makeTitle("t4", "club-a", "cup-y", "cup-y-2022", "2022-11-08"),
    // Shared title: both co-champions carry `shared: true`.
    makeTitle("t5", "club-a", "league-x", "league-x-2021", "2021-12-15", { shared: true }),
    makeTitle("t6", "club-b", "league-x", "league-x-2021", "2021-12-15", { shared: true }),
    // Disputed competition, not recognized.
    makeTitle("t7", "club-a", "league-old", "league-old-2021", "2021-12-20"),
    makeTitle("t8", "club-b", "intl-z", "intl-z-2022", "2022-12-01"),
  );

  ds["movements.json"].push({
    id: "mv2",
    club_id: "club-b",
    type: "relegation",
    date: "2023-12-31",
    season_id: "league-x-2023",
    source: "fixture:synthetic",
  });

  ds["rivalries.json"].push(
    { club_a: "club-c", club_b: "club-d", is_classic: true, source: "fixture:synthetic" },
    { club_a: "club-a", club_b: "club-c", is_classic: false, source: "fixture:synthetic" },
  );

  ds["coverage.json"].push(
    // Club B is only complete from 2022 (earlier rows are not complete).
    makeCoverage("club-b", "league-x", "2020-01-01", "2021-12-31", false),
    makeCoverage("club-b", "league-x", "2022-01-01", null),
    // Two adjacent rows for club C that must merge into one stretch.
    makeCoverage("club-c", "league-x", "2020-01-01", "2021-06-30"),
    makeCoverage("club-c", "league-x", "2021-07-01", null),
  );

  return ds;
}
