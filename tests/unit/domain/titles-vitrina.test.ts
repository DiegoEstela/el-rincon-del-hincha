import { describe, expect, it } from "vitest";
import {
  FIXED_NOW,
  makeCompetition,
  makeSeason,
  makeTitle,
  validDataset,
} from "../../fixtures/data-model/dataset";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import { fanPeriod } from "@/domain/period";
import {
  coChampions,
  pendingTitles,
  titleCoverage,
  titlesBeforePeriod,
  titlesInPeriod,
} from "@/domain/titles";

const TODAY = "2026-10-23";

/** league-x with a champion in 2020 and 2023 (2021 and 2022 have none); cup-y with no champion. */
function dataset() {
  const ds = validDataset();
  ds["competitions.json"].push(makeCompetition("league-old", { afa_recognized: false }));
  ds["seasons.json"].push(
    makeSeason("league-x-2022", "league-x", "2022-01-01", "2022-12-31"),
    makeSeason("league-x-2023", "league-x", "2023-01-01", "2023-12-31"),
    makeSeason("league-x-2024", "league-x", "2024-01-01", "2024-12-31"),
    makeSeason("cup-y-2021", "cup-y", "2021-01-01", "2021-12-31"),
    makeSeason("league-old-2021", "league-old", "2021-01-01", "2021-12-31"),
  );
  ds["titles.json"] = [
    makeTitle("ta", "club-a", "league-x", "league-x-2020", "2020-12-30"),
    makeTitle("tb", "club-b", "league-x", "league-x-2023", "2023-12-20"),
    makeTitle("tu", "club-a", "league-old", "league-old-2021", "2021-12-20"),
  ];
  return ds;
}
const index = (ds = dataset()) => buildStatsIndex(statsDataFrom(ds));
const world = index();

describe("titleCoverage (ADR 0021)", () => {
  const windows = titleCoverage(world, TODAY);

  it("lists the recognized competitions, sorted by id", () => {
    expect(windows.map((w) => w.competitionId)).toEqual(["cup-y", "league-x"]);
  });

  it("runs from the first to the last season with a champion", () => {
    expect(windows.find((w) => w.competitionId === "league-x")).toEqual({
      competitionId: "league-x",
      firstSeasonId: "league-x-2020",
      lastSeasonId: "league-x-2023",
      windowStart: "2020-01-01",
      windowEnd: "2023-12-31",
      missingSeasonIds: ["league-x-2021", "league-x-2022"],
    });
  });

  it("does not count a season after the last champion as missing", () => {
    const league = windows.find((w) => w.competitionId === "league-x")!;
    expect(league.missingSeasonIds).not.toContain("league-x-2024");
  });

  it("gives an empty window to a competition with no champion", () => {
    expect(windows.find((w) => w.competitionId === "cup-y")).toEqual({
      competitionId: "cup-y",
      firstSeasonId: null,
      lastSeasonId: null,
      windowStart: null,
      windowEnd: null,
      missingSeasonIds: [],
    });
  });

  it("never counts a season that has not ended yet as missing", () => {
    const missing = (today: string) =>
      titleCoverage(world, today).find((w) => w.competitionId === "league-x")!.missingSeasonIds;
    expect(missing("2020-06-01")).toEqual([]);
    expect(missing("2021-06-01")).toEqual([]);
    expect(missing("2022-06-01")).toEqual(["league-x-2021"]);
  });

  it("breaks a tie between two seasons that start the same day by id", () => {
    const ds = dataset();
    ds["seasons.json"].push(
      makeSeason("league-x-2025-b", "league-x", "2025-01-01", "2025-06-30"),
      makeSeason("league-x-2025-a", "league-x", "2025-01-01", "2025-06-30"),
    );
    ds["titles.json"].push(makeTitle("tz", "club-c", "league-x", "league-x-2025-b", "2025-06-30"));
    const league = titleCoverage(index(ds), TODAY).find((w) => w.competitionId === "league-x")!;
    expect(league.lastSeasonId).toBe("league-x-2025-b");
    expect(league.missingSeasonIds).toEqual([
      "league-x-2021",
      "league-x-2022",
      "league-x-2024",
      "league-x-2025-a",
    ]);
  });

  it("leaves unrecognized competitions out", () => {
    expect(windows.some((w) => w.competitionId === "league-old")).toBe(false);
  });

  it("sorts seasons by start date even when the data lists them out of order", () => {
    const ds = dataset();
    ds["seasons.json"].reverse();
    const league = titleCoverage(index(ds), TODAY).find((w) => w.competitionId === "league-x")!;
    expect(league.firstSeasonId).toBe("league-x-2020");
    expect(league.lastSeasonId).toBe("league-x-2023");
  });
});

describe("pendingTitles with the title window (ADR 0021)", () => {
  const from2020 = fanPeriod("2020-01-01", FIXED_NOW);

  it("is pending only where champions are loaded inside the period, with the window", () => {
    const pending = pendingTitles(world, "club-c", from2020);
    const league = pending.find((p) => p.competition.id === "league-x")!;
    expect(league).toMatchObject({
      status: "pending",
      windowFirstSeasonId: "league-x-2020",
      windowLastSeasonId: "league-x-2023",
    });
  });

  it("is unknown for a competition with no champion loaded", () => {
    const cup = pendingTitles(world, "club-c", from2020).find((p) => p.competition.id === "cup-y")!;
    expect(cup).toMatchObject({
      status: "unknown",
      windowFirstSeasonId: null,
      windowLastSeasonId: null,
    });
  });

  it("is unknown when the period starts after the window", () => {
    const after = pendingTitles(world, "club-c", fanPeriod("2024-01-01", FIXED_NOW));
    expect(after.find((p) => p.competition.id === "league-x")?.status).toBe("unknown");
  });

  it("keeps the silhouette when the club's only title is before the period", () => {
    const later = fanPeriod("2021-01-01", FIXED_NOW);
    expect(titlesInPeriod(world, "club-a", later)).toEqual([]);
    const league = pendingTitles(world, "club-a", later).find(
      (p) => p.competition.id === "league-x",
    );
    expect(league?.status).toBe("pending");
  });

  it("drops the competition the club won inside the period", () => {
    const won = pendingTitles(world, "club-a", from2020).map((p) => p.competition.id);
    expect(won).not.toContain("league-x");
  });

  it("is empty for a start in the future", () => {
    expect(pendingTitles(world, "club-a", fanPeriod("2030-01-01", FIXED_NOW))).toEqual([]);
  });
});

describe("titlesBeforePeriod", () => {
  it("lists the titles before the start, and the boundary day belongs to the period", () => {
    const onTheDay = fanPeriod("2020-12-30", FIXED_NOW);
    expect(titlesBeforePeriod(world, "club-a", onTheDay)).toEqual([]);
    expect(titlesInPeriod(world, "club-a", onTheDay).map((t) => t.id)).toEqual(["ta"]);
    const nextDay = fanPeriod("2020-12-31", FIXED_NOW);
    expect(titlesBeforePeriod(world, "club-a", nextDay).map((t) => t.id)).toEqual(["ta"]);
    expect(titlesInPeriod(world, "club-a", nextDay)).toEqual([]);
  });

  it("keeps only recognized titles unless asked, with the same shape and order", () => {
    const period = fanPeriod("2022-01-01", FIXED_NOW);
    expect(titlesBeforePeriod(world, "club-a", period).map((t) => t.id)).toEqual(["ta"]);
    const all = titlesBeforePeriod(world, "club-a", period, { includeUnrecognized: true });
    expect(all.map((t) => t.id)).toEqual(["ta", "tu"]);
    expect(all[0]).toMatchObject({ recognized: true, shelf: "domestic", shared: false });
  });

  it("puts every title before an empty period", () => {
    const empty = fanPeriod("2030-01-01", FIXED_NOW);
    expect(titlesBeforePeriod(world, "club-a", empty).map((t) => t.id)).toEqual(["ta"]);
  });
});

describe("coChampions", () => {
  it("names the other clubs with a title of the same season, sorted", () => {
    const ds = dataset();
    ds["titles.json"].push(
      makeTitle("s1", "club-c", "league-x", "league-x-2022", "2022-12-01", { shared: true }),
      makeTitle("s2", "club-b", "league-x", "league-x-2022", "2022-12-01", { shared: true }),
      makeTitle("s3", "club-a", "league-x", "league-x-2022", "2022-12-01", { shared: true }),
    );
    const shared = index(ds);
    const s1 = shared.data.titles.find((t) => t.id === "s1")!;
    expect(coChampions(shared, s1)).toEqual(["club-a", "club-b"]);
  });

  it("is empty for a title nobody shares", () => {
    const ta = world.data.titles.find((t) => t.id === "ta")!;
    expect(coChampions(world, ta)).toEqual([]);
  });
});
