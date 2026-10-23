import { describe, expect, it } from "vitest";
import { IngestError } from "../../../../../scripts/ingest/core/errors";
import { RSSSF_TITLE_SEASONS } from "../../../../../scripts/ingest/rsssf/config";
import type { ParsedChampions } from "../../../../../scripts/ingest/rsssf/layouts/champions-list";
import { buildTitles } from "../../../../../scripts/ingest/rsssf/titles";
import type { TitleSeason } from "../../../../../scripts/ingest/rsssf/types";
import { normalizeRsssf } from "../../../../../scripts/ingest/rsssf/normalize";

const champions: ParsedChampions = {
  excerpt: "argchamp.champions",
  rows: [
    { line: 3, season: "2018/19", tournament: "Campeonato", champion: "Racing", runnerUp: "Def" },
    { line: 4, season: "2025", tournament: "Torneo Clausura", champion: "Est", runnerUp: "Racing" },
    { line: 5, season: "2025", tournament: "Anual LPF", champion: "Rosario", runnerUp: "Boca" },
  ],
};
const seasons: TitleSeason[] = [
  {
    seasonId: "liga-2018-19",
    competition_id: "liga",
    row: { season: "2018/19", tournament: "Campeonato" },
  },
  {
    seasonId: "liga-2025-clausura",
    competition_id: "liga",
    row: { season: "2025", tournament: "Torneo Clausura" },
  },
];
const ids: Record<string, string> = { Racing: "racing-club", Est: "estudiantes-la-plata" };
const facts = new Map([
  ["liga-2018-19", { end: "2019-05-19", finals: [] as string[] }],
  ["liga-2025-clausura", { end: "2025-12-14", finals: ["2025-12-14"] }],
]);

const run = (overrides: Partial<Parameters<typeof buildTitles>[0]> = {}) => {
  const problems: string[] = [];
  const titles = buildTitles({
    champions,
    titleSeasons: seasons,
    resolve: (name) => ids[name] ?? null,
    seasons: facts,
    tableChampions: new Map(),
    problems,
    ...overrides,
  });
  return { titles, problems };
};

describe("buildTitles (plan 0017, T20)", () => {
  it("writes one title per season with the source of the list", () => {
    const { titles, problems } = run();
    expect(problems).toEqual([]);
    expect(titles).toEqual([
      {
        id: "liga-2018-19-racing-club",
        club_id: "racing-club",
        competition_id: "liga",
        season_id: "liga-2018-19",
        awarded_on: "2019-05-19",
        shared: false,
        source: "https://www.rsssf.org/tablesa/argchamp.html#champions",
        verified: false,
      },
      expect.objectContaining({
        id: "liga-2025-clausura-estudiantes-la-plata",
        awarded_on: "2025-12-14",
      }),
    ]);
  });

  it("dates a title on the final when the season has one, else on its last match", () => {
    const withFinals = new Map(facts);
    withFinals.set("liga-2018-19", { end: "2019-05-19", finals: ["2019-05-12", "2019-05-18"] });
    const { titles } = run({ seasons: withFinals });
    expect(titles[0].awarded_on).toBe("2019-05-18");
    expect(titles[1].awarded_on).toBe("2025-12-14");
  });

  it("never writes the Anual LPF, which the config does not list", () => {
    expect(RSSSF_TITLE_SEASONS.some((t) => t.row.tournament === "Anual LPF")).toBe(false);
    expect(run().titles.some((t) => t.club_id === "rosario-central")).toBe(false);
  });

  it("reports a season with no row in the list, and a season that is not in the data", () => {
    const orphan: TitleSeason = {
      seasonId: "liga-2030",
      competition_id: "liga",
      row: { season: "2030", tournament: "Campeonato" },
    };
    expect(run({ titleSeasons: [orphan] }).problems[0]).toMatch(/no champion row for 2030/);
    const missing = run({ seasons: new Map() });
    expect(missing.problems[0]).toMatch(/liga-2018-19 is not in the data/);
  });

  it("skips a champion that does not resolve, leaving the report to the resolver", () => {
    const { titles, problems } = run({ resolve: () => null });
    expect(titles).toEqual([]);
    expect(problems).toEqual([]);
  });

  it("stops when the list and the final table name different champions", () => {
    const { titles, problems } = run({
      tableChampions: new Map([["liga-2025-clausura", "racing-club"]]),
    });
    expect(problems[0]).toMatch(
      /list says estudiantes-la-plata won liga-2025-clausura.*racing-club/,
    );
    expect(titles).toHaveLength(1);
  });

  it("accepts a list and a table that agree", () => {
    const { problems } = run({
      tableChampions: new Map([["liga-2025-clausura", "estudiantes-la-plata"]]),
    });
    expect(problems).toEqual([]);
  });
});

describe("normalizeRsssf with titles", () => {
  it("carries the titles in the output and reports unknown champions as clubs", () => {
    const clubs = [
      { id: "racing-club", aliases: ["Racing"] },
      { id: "estudiantes-la-plata", aliases: ["Est"] },
    ] as never;
    const existing = {
      "seasons.json": [{ id: "liga-2018-19", end: "2019-05-19" }],
      "matches.json": [],
    };
    const out = normalizeRsssf([], clubs, [], {
      champions,
      titleSeasons: [seasons[0]],
      existing,
    });
    expect(out.titles).toHaveLength(1);

    const unknown = { ...champions, rows: [{ ...champions.rows[0], champion: "Nadie" }] };
    let error: unknown;
    try {
      normalizeRsssf([], clubs, [], { champions: unknown, titleSeasons: [seasons[0]], existing });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(IngestError);
    expect((error as IngestError).problems[0]).toMatch(
      /unknown club "Nadie".*argchamp\.champions:3/,
    );
  });
});
