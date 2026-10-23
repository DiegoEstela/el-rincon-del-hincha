// Phase B, B1: a cup section of a league page goes through the adapter with its own layout, keeps
// the matches of the app clubs only and writes the season and the competition it is given.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeSource } from "../../../../../scripts/ingest/core/pinned-fetch";
import { createRsssfAdapter } from "../../../../../scripts/ingest/rsssf";
import type { TournamentConfig } from "../../../../../scripts/ingest/rsssf/config";
import { manifestSchema } from "../../../../../scripts/ingest/rsssf/manifest";
import type { Club, Competition } from "../../../../../src/data-model/types";

const FIXTURE = join(process.cwd(), "tests/fixtures/ingest/rsssf/copa-argentina-2025.txt");
const bytes = readFileSync(FIXTURE);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const PAGE = "https://www.rsssf.org/tablesa/arg2025.html";

const manifest = manifestSchema.parse({
  version: 1,
  pages: [
    {
      url: PAGE,
      retrieved_on: "2026-10-23",
      sha256,
      bytes: bytes.length,
      encoding: "windows-1252",
      authors: ["Osvaldo José Gorgazzi"],
      last_updated: "7 Oct 2026",
      layout: "full-names-2017",
      excerpts: [
        {
          name: "nationalcup",
          start: '<a name="nationalcup">',
          end: '<a name="second">',
          sha256,
          layout: "cup-full-names",
        },
      ],
      ignore: [],
      variants: [],
      tableExceptions: [],
    },
  ],
});

const tournament: TournamentConfig = {
  id: "copa-argentina-2025",
  competition_id: "copa-argentina",
  name: "Copa Argentina 2025",
  page: "arg2025",
  excerpt: "nationalcup",
  window: { from: "2025-01-01", to: "2025-12-31" },
  mode: { kind: "own" },
  tableCoversSeason: false,
  appClubsOnly: true,
};
const competition: Competition = {
  id: "copa-argentina",
  name: "Copa Argentina",
  type: "national_cup",
  scope: "domestic",
  organizer: "AFA",
  afa_recognized: true,
  source: "fixture:synthetic",
};

const club = (id: string, aliases: string[], extra: Partial<Club> = {}) =>
  ({ id, name: id, short_name: id, aliases, source: "fixture:synthetic", ...extra }) as Club;
// Boca is the only app club here: it plays two matches of the section, against two opponents.
const clubs = [
  club("boca-juniors", ["CA Boca Juniors"]),
  club("argentino-monte-maiz", ["CD Argentino"], { selectable: false, country: "AR" }),
  club("atletico-tucuman", ["Club Atlético Tucumán"], { selectable: false, country: "AR" }),
];

const loader = async (file: { name: string; url: string; sha256: string; encoding: string }) =>
  decodeSource({ name: file.name, url: file.url, sha256, encoding: "windows-1252" }, bytes);

const adapter = () =>
  createRsssfAdapter({
    tournaments: [tournament],
    manifest: () => manifest,
    competitions: [competition],
  });

describe("a cup section through the RSSSF adapter", () => {
  it("reads it with the layout of the excerpt, not the one of its league page", async () => {
    const raw = await adapter().load(loader as never);
    expect(raw.tournaments[0].parsed.matches).toHaveLength(63);
  });

  it("keeps only the matches of the app clubs and writes the cup and its season", async () => {
    const a = adapter();
    const raw = await a.load(loader as never);
    const out = a.normalize(raw, { clubs, existing: {} });
    expect(out.competitions).toEqual([competition]);
    expect(out.matches.map((m) => [m.id, m.stage, m.home_goals, m.away_goals])).toEqual([
      ["2025-01-22-boca-juniors-argentino-monte-maiz", "32avos de final", 5, 0],
      ["2025-07-23-boca-juniors-atletico-tucuman", "16avos de final", 1, 2],
    ]);
    expect(out.matches.every((m) => m.season_id === "copa-argentina-2025")).toBe(true);
    // The season is dated by the whole section, up to the final of 2025-11-05.
    expect(out.seasons).toEqual([
      expect.objectContaining({
        id: "copa-argentina-2025",
        start: "2025-01-22",
        end: "2025-11-05",
      }),
    ]);
  });

  it("lists the unknown names it dropped, so a missing alias of an app club is seen", async () => {
    const a = adapter();
    const raw = await a.load(loader as never);
    const dropped = a.normalize(raw, { clubs, existing: {} }).report.files[0].droppedUnknown!;
    expect(dropped.length).toBeGreaterThan(40);
    expect(dropped).toContain("CA Racing");
    expect(dropped).not.toContain("CA Boca Juniors");
  });
});
