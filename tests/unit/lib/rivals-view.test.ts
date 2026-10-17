import { describe, expect, it } from "vitest";
import { FIXED_NOW, makeMatch, validDataset } from "../../fixtures/data-model/dataset";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import type { Match } from "@/data-model/types";
import type { ClubOption } from "@/lib/club-options";
import { buildRivalsView, type RivalsViewInput } from "@/lib/rivals-view";

const crest = (id: string) => ({
  initials: id.slice(-1).toUpperCase(),
  initialsInk: "#ffffff",
  pattern: "solid" as const,
  primary: "#112233",
  secondary: "#ffffff",
});
const option = (id: string, name: string): ClubOption => ({
  id,
  name,
  shortName: name,
  searchKeys: [],
  crest: crest(id),
});

const game = (
  id: string,
  date: string,
  home: string,
  away: string,
  hg: number,
  ag: number,
  extra: Partial<Match> = {},
) => makeMatch(id, "league-x-2020", date, home, away, hg, ag, extra);

function world(matches: Match[]) {
  const ds = validDataset();
  ds["matches.json"] = matches;
  return buildStatsIndex(statsDataFrom(ds));
}

// club-a: wins 3 against club-b, draws club-c, loses 2 to club-d, and wins 1 against club-e.
const MATCHES: Match[] = [
  game("b1", "2020-03-01", "club-a", "club-b", 3, 0),
  game("b2", "2020-03-08", "club-b", "club-a", 0, 1),
  game("b3", "2020-03-15", "club-a", "club-b", 2, 0),
  game("c1", "2020-03-22", "club-a", "club-c", 1, 1),
  game("d1", "2020-03-29", "club-d", "club-a", 2, 0),
  game("d2", "2020-04-05", "club-a", "club-d", 0, 1),
  makeMatch("cup1", "cup-y-2020", "2020-05-01", "club-a", "club-c", 2, 0),
  makeMatch("l21", "league-x-2021", "2021-03-01", "club-b", "club-a", 0, 2),
];
const catalog = new Map(
  [
    option("club-a", "Aldosivi"),
    option("club-b", "Vélez"),
    option("club-c", "Colón"),
    option("club-d", "Unión"),
  ].map((o) => [o.id, o]),
);
const competitionNames = new Map([
  ["league-x", "Liga Ficticia X"],
  ["cup-y", "Copa Ficticia Y"],
]);

const input = (over: Partial<RivalsViewInput> = {}): RivalsViewInput => ({
  index: world(MATCHES),
  clubId: "club-a",
  startDate: "2020-01-01",
  now: FIXED_NOW,
  filter: {},
  sort: "balance",
  catalog,
  competitionNames,
  ...over,
});

describe("buildRivalsView: rows", () => {
  const view = buildRivalsView(input());

  it("has one row per rival with names and crest from the catalog", () => {
    expect(view.rows.map((r) => r.rivalId).sort()).toEqual(["club-b", "club-c", "club-d"]);
    const b = view.rows.find((r) => r.rivalId === "club-b")!;
    expect(b).toMatchObject({ name: "Vélez", shortName: "Vélez", played: 4, won: 4, balance: 4 });
    expect(b.crest).toEqual(crest("club-b"));
  });

  it("falls back to the id and no crest for a rival missing from the catalog", () => {
    const small = new Map([...catalog].filter(([id]) => id !== "club-c"));
    const row = buildRivalsView(input({ catalog: small })).rows.find(
      (r) => r.rivalId === "club-c",
    )!;
    expect(row).toMatchObject({ name: "club-c", shortName: "club-c", crest: null });
  });

  it("gives bar ratios that sum to one", () => {
    for (const r of view.rows) {
      expect(r.bar.won + r.bar.drawn + r.bar.lost).toBeCloseTo(1, 10);
      expect(r.bar.won).toBeCloseTo(r.won / r.played, 10);
    }
  });

  it("marks administrative results and shoot-outs", () => {
    const matches = [
      game("a1", "2020-03-01", "club-a", "club-b", 3, 0, { status: "administrative_result" }),
      game("a2", "2020-03-08", "club-a", "club-b", 1, 1, {
        decision: "penalties",
        home_penalties: 4,
        away_penalties: 3,
        stage: "Final",
      }),
    ];
    const row = buildRivalsView(input({ index: world(matches) })).rows[0];
    expect(row.administrative).toBe(1);
    expect(row.shootouts).toBe(1);
    expect(view.rows.every((r) => r.administrative === 0 && r.shootouts === 0)).toBe(true);
  });

  it("flags classics from the rivalries table", () => {
    expect(view.rows.find((r) => r.rivalId === "club-b")!.isClassic).toBe(true);
    expect(view.rows.find((r) => r.rivalId === "club-d")!.isClassic).toBe(false);
  });
});

describe("buildRivalsView: sort", () => {
  const ids = (sort: RivalsViewInput["sort"], index = world(MATCHES)) =>
    buildRivalsView(input({ sort, index })).rows.map((r) => r.rivalId);

  it("sorts by balance, then played, then id", () => {
    expect(ids("balance")).toEqual(["club-b", "club-c", "club-d"]);
  });

  it("sorts by played, then balance", () => {
    expect(ids("played")).toEqual(["club-b", "club-c", "club-d"]);
    const matches = [
      ...MATCHES,
      game("d3", "2020-06-01", "club-a", "club-d", 1, 1),
      game("d4", "2020-06-08", "club-a", "club-d", 1, 1),
      game("d5", "2020-06-15", "club-a", "club-d", 1, 1),
    ];
    expect(ids("played", world(matches))).toEqual(["club-d", "club-b", "club-c"]);
  });

  it("sorts by name with Spanish collation, ignoring accents", () => {
    expect(ids("name")).toEqual(["club-c", "club-d", "club-b"]); // Colón, Unión, Vélez
  });

  it("breaks name ties by id", () => {
    const same = new Map(catalog);
    same.set("club-c", option("club-c", "Unión"));
    const view = buildRivalsView(input({ sort: "name", catalog: same }));
    expect(view.rows.map((r) => r.rivalId)).toEqual(["club-c", "club-d", "club-b"]);
  });
});

describe("buildRivalsView: summary and sections", () => {
  it("counts the rivals of each group", () => {
    const view = buildRivalsView(input());
    expect(view.summary).toEqual({ favorable: 1, even: 1, unfavorable: 1 });
    expect(view.totals).toEqual({ matches: 8, rivals: 3 });
    expect(view.sections.favorable.map((r) => r.rivalId)).toEqual(["club-b"]);
    expect(view.sections.even.map((r) => r.rivalId)).toEqual(["club-c"]);
    expect(view.sections.unfavorable.map((r) => r.rivalId)).toEqual(["club-d"]);
  });

  it("keeps only the top three, the worst first for the unfavorable group", () => {
    const matches: Match[] = [];
    let n = 0;
    const add = (rival: string, wins: number, losses: number) => {
      for (let i = 0; i < wins; i++)
        matches.push(
          game(`w${++n}`, `2020-03-${String(n).padStart(2, "0")}`, "club-a", rival, 1, 0),
        );
      for (let i = 0; i < losses; i++)
        matches.push(
          game(`l${++n}`, `2020-03-${String(n).padStart(2, "0")}`, "club-a", rival, 0, 1),
        );
    };
    // Four favorable rivals need four ids: reuse the three plus a fourth club added to the catalog.
    add("club-b", 5, 0);
    add("club-c", 4, 0);
    add("club-d", 3, 0);
    matches.push(
      makeMatch("x1", "league-x-2020", "2020-04-01", "club-a", "club-z", 1, 0),
      makeMatch("x2", "league-x-2020", "2020-04-02", "club-a", "club-z", 1, 0),
    );
    const view = buildRivalsView(input({ index: world(matches) }));
    expect(view.summary.favorable).toBe(4);
    expect(view.sections.favorable.map((r) => r.rivalId)).toEqual(["club-b", "club-c", "club-d"]);
  });

  it("has empty sections for a group without rivals", () => {
    const view = buildRivalsView(
      input({ index: world([game("b1", "2020-03-01", "club-a", "club-b", 1, 1)]) }),
    );
    expect(view.sections.favorable).toEqual([]);
    expect(view.sections.unfavorable).toEqual([]);
    expect(view.sections.even).toHaveLength(1);
  });
});

describe("buildRivalsView: filters, options and states", () => {
  it("offers only the years with matches in the period and the types present", () => {
    const view = buildRivalsView(input());
    expect(view.options.years).toEqual([2020, 2021]);
    expect(view.options.types).toEqual(["league", "national_cup"]);
    expect(view.filter).toEqual({ fromYear: 2020, toYear: 2021, type: "all" });
    expect(view.filtersActive).toBe(false);
  });

  it("narrows the period with the year range", () => {
    const view = buildRivalsView(input({ filter: { fromYear: 2021, toYear: 2021 } }));
    expect(view.filtersActive).toBe(true);
    expect(view.rows.map((r) => r.rivalId)).toEqual(["club-b"]);
    expect(view.totals.matches).toBe(1);
  });

  it("passes the tournament type to the engine and lists only those competitions", () => {
    const view = buildRivalsView(input({ filter: { type: "national_cup" } }));
    expect(view.filtersActive).toBe(true);
    expect(view.competitionIds).toEqual(["cup-y"]);
    expect(view.rows.map((r) => r.rivalId)).toEqual(["club-c"]);
    expect(view.included).toBe("Contamos: Copa Ficticia Y.");
  });

  it("ignores an invalid filter instead of failing", () => {
    const view = buildRivalsView(input({ filter: { fromYear: 1800, toYear: "x", type: "bogus" } }));
    expect(view.filter).toEqual({ fromYear: 2020, toYear: 2021, type: "all" });
    expect(view.filtersActive).toBe(false);
  });

  it("says which competitions the numbers include", () => {
    const view = buildRivalsView(input());
    expect(view.competitionIds).toEqual(["cup-y", "league-x"]);
    expect(view.included).toBe("Contamos: Copa Ficticia Y y Liga Ficticia X.");
    expect(view.competitionsLabel).toBe("Copa Ficticia Y y Liga Ficticia X");
  });

  it("flags no matches when the filters leave nothing, and offers no options when there is nothing", () => {
    const empty = buildRivalsView(input({ index: world([]) }));
    expect(empty.noMatches).toBe(true);
    expect(empty.filtersActive).toBe(false);
    expect(empty.options.years).toEqual([]);
    expect(empty.options.types).toEqual([]);
    expect(empty.rows).toEqual([]);
    expect(empty.included).toBe("Todavía no hay partidos cargados para este período.");
  });

  it("flags a start date after the last match as empty without failing", () => {
    const view = buildRivalsView(input({ startDate: "2030-01-01" }));
    expect(view.noMatches).toBe(true);
    expect(view.coverage.show).toBe(false);
  });

  it("shows the coverage notice when the period starts before the complete stretch", () => {
    const early = buildRivalsView(input({ startDate: "2019-01-01" }));
    expect(early.coverage.show).toBe(true);
    expect(early.coverage.lines.join(" ")).toContain("Liga Ficticia X");
    expect(JSON.stringify(early.coverage)).not.toContain("2019");
    expect(buildRivalsView(input()).coverage.show).toBe(false);
  });

  it("writes the start as a month and year, never as a date", () => {
    const view = buildRivalsView(input({ startDate: "1990-05-20" }));
    expect(view.since).toBe("mayo de 1990");
    expect(JSON.stringify(view)).not.toContain("1990-05-20");
  });
});

describe("buildRivalsView: ties", () => {
  // club-a against five rivals: b and e lose 0-1 twice (same balance and played), c lost three times,
  // d lost three and won one, f and g drew once each and h drew twice.
  const matches: Match[] = [];
  let n = 0;
  const add = (rival: string, result: [number, number][]) => {
    for (const [goalsFor, goalsAgainst] of result) {
      const date = new Date(Date.UTC(2020, 3, 1 + n)).toISOString().slice(0, 10);
      matches.push(game(`t${++n}`, date, "club-a", rival, goalsFor, goalsAgainst));
    }
  };
  add("club-b", [
    [0, 1],
    [0, 1],
  ]);
  add("club-c", [
    [0, 1],
    [0, 1],
    [0, 1],
  ]);
  add("club-d", [
    [0, 1],
    [0, 1],
    [0, 1],
    [1, 0],
  ]);
  add("club-e", [
    [0, 1],
    [0, 1],
  ]);
  add("club-f", [[1, 1]]);
  add("club-g", [[2, 2]]);
  add("club-h", [
    [0, 0],
    [1, 1],
  ]);
  const index = () => world(matches);
  const ids = (list: readonly { rivalId: string }[]) => list.map((r) => r.rivalId);

  it("puts the worst record first and breaks ties by matches played, then id", () => {
    const view = buildRivalsView(input({ index: index() }));
    expect(ids(view.sections.unfavorable)).toEqual(["club-c", "club-d", "club-b"]);
  });

  it("orders the even group by matches played, then id", () => {
    const view = buildRivalsView(input({ index: index() }));
    expect(ids(view.sections.even)).toEqual(["club-h", "club-f", "club-g"]);
  });

  it("sorts the list by matches played, then balance, then id", () => {
    const view = buildRivalsView(input({ index: index(), sort: "played" }));
    expect(ids(view.rows)).toEqual([
      "club-d",
      "club-c",
      "club-h",
      "club-b",
      "club-e",
      "club-f",
      "club-g",
    ]);
  });

  it("keeps the first three of a group and drops the rest", () => {
    const view = buildRivalsView(input({ index: index() }));
    expect(view.summary.unfavorable).toBe(4);
    expect(view.sections.unfavorable).toHaveLength(3);
  });
});
