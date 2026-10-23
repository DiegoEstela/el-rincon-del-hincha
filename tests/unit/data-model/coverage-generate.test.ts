import { describe, expect, it } from "vitest";
import { generateCoverage, type CoverageGap } from "@/data-model/coverage-generate";
import { validate } from "@/data-model/validate";
import { FIXED_NOW } from "../../fixtures/data-model/dataset";

const S = "fixture:synthetic";
const club = (id: string) => ({
  id,
  name: id,
  short_name: id,
  aliases: [id],
  colors: { primary: "#112233", secondary: "#ffffff" },
  jersey_pattern: "solid" as const,
  founded: 1900,
  city: "X",
  source: S,
});
const competition = (id: string) => ({
  id,
  name: id,
  type: "league" as const,
  scope: "domestic" as const,
  organizer: "AFA",
  afa_recognized: true,
  source: S,
});
const season = (id: string, competitionId: string, start: string, end: string) => ({
  id,
  competition_id: competitionId,
  name: id,
  start,
  end,
  source: S,
});
let counter = 0;
const match = (seasonId: string, date: string, home: string, away: string, status = "played") => ({
  id: `m${++counter}`,
  season_id: seasonId,
  date,
  home_id: home,
  away_id: away,
  home_goals: 1,
  away_goals: 0,
  decision: null,
  home_penalties: null,
  away_penalties: null,
  stage: "Fecha 1",
  is_final: false,
  status: status as "played",
  source: S,
  verified: false,
});

/** Three seasons of one league; every season ends on the date of its last match. */
function world() {
  counter = 0;
  return {
    "clubs.json": [club("a"), club("b"), club("c")],
    "competitions.json": [competition("liga")],
    "seasons.json": [
      season("liga-2020", "liga", "2020-03-01", "2020-12-01"),
      season("liga-2021", "liga", "2021-03-01", "2021-12-01"),
      season("liga-2022", "liga", "2022-03-01", "2022-12-01"),
    ],
    "matches.json": [
      match("liga-2020", "2020-03-01", "a", "b"),
      match("liga-2020", "2020-12-01", "b", "a"),
      match("liga-2021", "2021-03-01", "a", "b"),
      match("liga-2021", "2021-12-01", "b", "a"),
      match("liga-2022", "2022-03-01", "a", "b"),
      match("liga-2022", "2022-12-01", "b", "a"),
    ],
  };
}
const rows = (ds: ReturnType<typeof world>, gaps: CoverageGap[] = []) => generateCoverage(ds, gaps);
const gap = (from: string, to: string | null, competition = "liga"): CoverageGap => ({
  competition_id: competition,
  from,
  to,
  reason: "not loaded",
  source: "https://example.org/gap",
});
const view = (ds: ReturnType<typeof world>, gaps: CoverageGap[] = []) =>
  rows(ds, gaps).map((r) => `${r.club_id}/${r.competition_id} ${r.from}..${r.to} ${r.complete}`);

describe("generateCoverage: opponents (ADR 0022)", () => {
  it("gives no coverage row to an opponent, but the matches against it still count", () => {
    const ds = world();
    ds["clubs.json"].push({
      id: "opp",
      name: "opp",
      short_name: "opp",
      aliases: ["opp"],
      selectable: false,
      country: "UY",
      source: S,
    } as never);
    ds["matches.json"].push(match("liga-2022", "2022-06-01", "opp", "a"));
    const lines = view(ds);
    expect(lines.some((l) => l.startsWith("opp/"))).toBe(false);
    expect(lines.filter((l) => l.startsWith("a/"))).toEqual(["a/liga 2020-03-01..2022-12-01 true"]);
  });
});

describe("generateCoverage: stretches", () => {
  it("gives one complete stretch to a club that played every season", () => {
    expect(view(world()).filter((l) => l.startsWith("a/"))).toEqual([
      "a/liga 2020-03-01..2022-12-01 true",
    ]);
  });

  it("starts at the first season the club played (ADR 0003 start rule)", () => {
    const ds = world();
    // Club c only plays 2022.
    ds["matches.json"].push(match("liga-2022", "2022-06-01", "c", "a"));
    expect(view(ds).filter((l) => l.startsWith("c/"))).toEqual([
      "c/liga 2022-03-01..2022-12-01 true",
    ]);
  });

  it("splits a stretch where the club skipped a season", () => {
    const ds = world();
    ds["matches.json"] = ds["matches.json"].filter(
      (m) => !(m.season_id === "liga-2021" && (m.home_id === "b" || m.away_id === "b")),
    );
    ds["matches.json"].push(match("liga-2021", "2021-12-01", "a", "c"));
    expect(view(ds).filter((l) => l.startsWith("b/"))).toEqual([
      "b/liga 2020-03-01..2020-12-01 true",
      "b/liga 2022-03-01..2022-12-01 true",
    ]);
  });

  it("breaks the stretch at a season without matches, for every club", () => {
    const ds = world();
    ds["matches.json"] = ds["matches.json"].filter((m) => m.season_id !== "liga-2021");
    expect(view(ds).filter((l) => l.startsWith("a/"))).toEqual([
      "a/liga 2020-03-01..2020-12-01 true",
      "a/liga 2022-03-01..2022-12-01 true",
    ]);
  });

  it("orders seasons by start date, not by id", () => {
    const ds = world();
    ds["seasons.json"] = [
      season("z-first", "liga", "2020-03-01", "2020-12-01"),
      season("a-second", "liga", "2021-03-01", "2021-12-01"),
    ];
    ds["matches.json"] = [
      match("z-first", "2020-03-01", "a", "b"),
      match("z-first", "2020-12-01", "b", "a"),
      match("a-second", "2021-03-01", "a", "b"),
      match("a-second", "2021-12-01", "b", "a"),
    ];
    expect(view(ds).filter((l) => l.startsWith("a/"))).toEqual([
      "a/liga 2020-03-01..2021-12-01 true",
    ]);
  });

  it("orders two seasons that start the same day by id, so the output never depends on the input", () => {
    const ds = world();
    ds["seasons.json"] = [
      season("b-tournament", "liga", "2020-03-01", "2020-12-01"),
      season("a-tournament", "liga", "2020-03-01", "2020-12-01"),
    ];
    ds["matches.json"] = [
      match("a-tournament", "2020-03-01", "a", "b"),
      match("a-tournament", "2020-12-01", "b", "a"),
      match("b-tournament", "2020-03-01", "a", "b"),
      match("b-tournament", "2020-12-01", "b", "a"),
    ];
    const reversed = { ...ds, "seasons.json": [...ds["seasons.json"]].reverse() };
    expect(generateCoverage(reversed, [])).toEqual(generateCoverage(ds, []));
    expect(generateCoverage(ds, [])[0].source).toBe("derived:a-tournament..b-tournament");
  });

  it("counts suspended matches as loaded matches", () => {
    const ds = world();
    ds["matches.json"].push(match("liga-2021", "2021-05-01", "c", "a", "suspended"));
    expect(view(ds).filter((l) => l.startsWith("c/"))).toEqual([
      "c/liga 2021-03-01..2021-12-01 true",
    ]);
  });

  it("names the seasons a stretch spans in its source", () => {
    const [a] = rows(world()).filter((r) => r.club_id === "a");
    expect(a.source).toBe("derived:liga-2020..liga-2022");
  });
});

describe("generateCoverage: partial seasons and declared gaps", () => {
  const partial = () => {
    const ds = world();
    ds["seasons.json"][2].end = "2023-06-30"; // the file stops on 2022-12-01
    return ds;
  };

  it("ends a stretch at the last loaded day of a partial season, inside a declared gap", () => {
    expect(view(partial(), [gap("2022-12-02", null)]).filter((l) => l.startsWith("a/"))).toEqual([
      "a/liga 2020-03-01..2022-12-01 true",
      "a/liga 2022-12-02..null false",
    ]);
  });

  it("throws when the missing tail of a partial season is not declared", () => {
    expect(() => rows(partial(), [])).toThrow(/liga-2022.*partial.*gap/i);
    expect(() => rows(partial(), [gap("2023-01-01", null)])).toThrow(/liga-2022/);
    expect(() => rows(partial(), [gap("2022-12-02", "2023-01-31")])).toThrow(/liga-2022/);
  });

  it("cuts a stretch in two with a gap in the middle", () => {
    expect(
      view(world(), [gap("2021-01-01", "2021-12-31")]).filter((l) => l.startsWith("a/")),
    ).toEqual([
      "a/liga 2020-03-01..2020-12-31 true",
      "a/liga 2021-01-01..2021-12-31 false",
      "a/liga 2022-01-01..2022-12-01 true",
    ]);
  });

  it("trims the head or the tail of a stretch", () => {
    expect(
      view(world(), [gap("2019-01-01", "2020-05-31")]).filter((l) => l.startsWith("a/")),
    ).toContain("a/liga 2020-06-01..2022-12-01 true");
    expect(
      view(world(), [gap("2022-06-01", "2023-01-01")]).filter((l) => l.startsWith("a/")),
    ).toContain("a/liga 2020-03-01..2022-05-31 true");
  });

  it("removes a stretch that a gap covers entirely", () => {
    const lines = view(world(), [gap("2020-01-01", "2022-12-31")]).filter((l) =>
      l.startsWith("a/"),
    );
    expect(lines).toEqual(["a/liga 2020-01-01..2022-12-31 false"]);
  });

  it("writes one incomplete row per club for each gap, with the gap source", () => {
    const out = rows(world(), [gap("2023-01-01", null)]).filter((r) => !r.complete);
    expect(out.map((r) => r.club_id).sort()).toEqual(["a", "b", "c"]);
    for (const r of out) {
      expect(r.source).toBe("https://example.org/gap");
      expect(r.to).toBeNull();
    }
  });

  it("throws for a gap of an unknown competition", () => {
    expect(() => rows(world(), [gap("2023-01-01", null, "nope")])).toThrow(
      /unknown competition "nope"/,
    );
  });

  it("throws for a gap that ends before it starts", () => {
    expect(() => rows(world(), [gap("2023-06-01", "2023-01-01")])).toThrow(
      /gap of "liga" ends \(2023-01-01\) before it starts \(2023-06-01\)/,
    );
  });

  it("throws for two gaps of one competition that share a day, whatever their order", () => {
    const first = gap("2023-01-01", "2023-06-30");
    const second = gap("2023-06-30", "2023-12-31");
    expect(() => rows(world(), [first, second])).toThrow(/overlap/i);
    expect(() => rows(world(), [second, first])).toThrow(/overlap/i);
    expect(() => rows(world(), [gap("2023-01-01", null), gap("2024-01-01", null)])).toThrow(
      /overlap/i,
    );
  });

  it("accepts adjacent gaps and gaps of different competitions", () => {
    const ds = world();
    ds["competitions.json"].push(competition("copa"));
    ds["seasons.json"].push(season("copa-2020", "copa", "2020-03-01", "2020-12-01"));
    ds["matches.json"].push(
      match("copa-2020", "2020-03-01", "a", "b"),
      match("copa-2020", "2020-12-01", "b", "a"),
    );
    expect(() =>
      rows(ds, [
        gap("2023-01-01", "2023-06-30"),
        gap("2023-07-01", "2023-12-31"),
        gap("2023-01-01", null, "copa"),
      ]),
    ).not.toThrow();
  });
});

describe("generateCoverage: assembly", () => {
  it("falls back to an incomplete row for a pair with nothing", () => {
    const ds = world();
    ds["clubs.json"].push(club("d"));
    const d = rows(ds).filter((r) => r.club_id === "d");
    expect(d).toEqual([
      {
        club_id: "d",
        competition_id: "liga",
        from: "2020-03-01",
        to: null,
        complete: false,
        source: "derived:no-season-played",
      },
    ]);
  });

  it("throws when a competition has no loaded season and no gap", () => {
    const ds = world();
    ds["competitions.json"].push(competition("copa"));
    expect(() => rows(ds)).toThrow(/competition "copa".*no loaded season/i);
  });

  it("accepts a competition with no loaded season when a gap declares it", () => {
    const ds = world();
    ds["competitions.json"].push(competition("copa"));
    const out = rows(ds, [gap("2018-01-01", null, "copa")]);
    expect(out.filter((r) => r.competition_id === "copa")).toHaveLength(3);
  });

  it("sorts by club, competition and from, with keys in schema order", () => {
    const out = rows(world(), [gap("2023-01-01", null)]);
    const keys = out.map((r) => `${r.club_id}/${r.competition_id}/${r.from}`);
    expect(keys).toEqual([...keys].sort());
    expect(Object.keys(out[0])).toEqual([
      "club_id",
      "competition_id",
      "from",
      "to",
      "complete",
      "source",
    ]);
  });

  it("is deterministic, whatever the order of the input", () => {
    const ds = world();
    const shuffled = {
      ...ds,
      "matches.json": [...ds["matches.json"]].reverse(),
      "seasons.json": [...ds["seasons.json"]].reverse(),
    };
    expect(generateCoverage(shuffled, [])).toEqual(generateCoverage(ds, []));
    expect(generateCoverage(ds, [])).toEqual(generateCoverage(ds, []));
  });

  it("produces rows that pass the validator", () => {
    const ds = world();
    const full = {
      ...ds,
      "titles.json": [],
      "movements.json": [],
      "rivalries.json": [],
      "standings.json": [],
      "coverage.json": generateCoverage(ds, [gap("2023-01-01", null)]),
    };
    expect(validate(full, { now: FIXED_NOW })).toEqual([]);
  });
});
