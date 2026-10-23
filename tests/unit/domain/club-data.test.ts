import { describe, expect, it } from "vitest";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { statsDataFrom } from "@/domain/data";
import { CLUB_DATA_VERSION, sliceClubData, statsDataFromClubData } from "@/domain/club-data";

const data = statsDataFrom(statsWorld());

describe("sliceClubData", () => {
  const slice = sliceClubData(data, "club-a");

  it("identifies itself with the version and the club", () => {
    expect(slice.v).toBe(CLUB_DATA_VERSION);
    expect(slice.clubId).toBe("club-a");
  });

  it("keeps every match of the club, home and away, suspended included, by date then id", () => {
    const expected = data.matches
      .filter((m) => m.home_id === "club-a" || m.away_id === "club-a")
      .map((m) => m.id);
    expect(slice.matches.map((m) => m.id).sort()).toEqual([...expected].sort());
    expect(slice.matches.some((m) => m.status === "suspended")).toBe(
      data.matches.some(
        (m) => m.status === "suspended" && (m.home_id === "club-a" || m.away_id === "club-a"),
      ),
    );
    const keys = slice.matches.map((m) => `${m.date}|${m.id}`);
    expect(keys).toEqual([...keys].sort());
    expect(slice.matches.length).toBeLessThan(data.matches.length);
  });

  it("keeps only the rows of the club in coverage, movements and rivalries", () => {
    expect(slice.coverage.every((c) => c.club_id === "club-a")).toBe(true);
    expect(slice.movements.every((m) => m.club_id === "club-a")).toBe(true);
    expect(slice.rivalries.every((r) => r.club_a === "club-a" || r.club_b === "club-a")).toBe(true);
    expect(slice.rivalries.length).toBeGreaterThan(0);
  });

  it("keeps every title, sorted by id, like competitions and seasons (ADR 0021)", () => {
    expect(data.titles.length).toBeGreaterThan(0);
    expect(slice.titles.map((t) => t.id)).toEqual(data.titles.map((t) => t.id).sort());
    expect(new Set(slice.titles.map((t) => t.club_id)).size).toBeGreaterThan(1);
    expect(sliceClubData(data, "club-c").titles).toEqual(slice.titles);
  });

  it("keeps every competition and season, sorted by id", () => {
    expect(slice.competitions.map((c) => c.id)).toEqual(data.competitions.map((c) => c.id).sort());
    expect(slice.seasons.map((s) => s.id)).toEqual(data.seasons.map((s) => s.id).sort());
  });

  it("lists the club and each opponent once, sorted by id", () => {
    const opponents = new Set(
      slice.matches.flatMap((m) => [m.home_id, m.away_id]).filter((id) => id !== "club-a"),
    );
    expect(slice.clubs.map((c) => c.id)).toEqual(["club-a", ...opponents].sort());
  });

  it("throws a RangeError for an unknown club, without echoing it", () => {
    expect(() => sliceClubData(data, "nope")).toThrow(RangeError);
    expect(() => sliceClubData(data, "nope")).not.toThrow(/nope/);
  });

  it("is deterministic: the same input gives the same JSON", () => {
    expect(JSON.stringify(sliceClubData(data, "club-a"))).toBe(JSON.stringify(slice));
  });
});

describe("statsDataFromClubData", () => {
  const a = sliceClubData(data, "club-a");
  const b = sliceClubData(data, "club-b");
  const merged = statsDataFromClubData(a, b);

  it("merges two slices without duplicates", () => {
    const ids = merged.matches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const wanted = data.matches.filter(
      (m) => ["club-a", "club-b"].includes(m.home_id) || ["club-a", "club-b"].includes(m.away_id),
    );
    expect(ids.sort()).toEqual(wanted.map((m) => m.id).sort());
    expect(new Set(merged.clubs.map((c) => c.id)).size).toBe(merged.clubs.length);
    const keys = merged.coverage.map((c) => `${c.club_id}/${c.competition_id}/${c.from}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(merged.competitions.map((c) => c.id)).size).toBe(merged.competitions.length);
    expect(new Set(merged.seasons.map((s) => s.id)).size).toBe(merged.seasons.length);
  });

  it("dedupes rivalries and titles that appear in both slices", () => {
    const rivalries = merged.rivalries.map((r) => `${r.club_a}~${r.club_b}`);
    expect(new Set(rivalries).size).toBe(rivalries.length);
    const titles = merged.titles.map((t) => t.id);
    expect(new Set(titles).size).toBe(titles.length);
    const movements = merged.movements.map((m) => m.id);
    expect(new Set(movements).size).toBe(movements.length);
  });

  it("gives one slice back unchanged and an empty set for no slice", () => {
    expect(statsDataFromClubData(a).matches).toEqual(a.matches);
    expect(statsDataFromClubData().matches).toEqual([]);
  });

  it("is deterministic whatever the order of the slices", () => {
    expect(JSON.stringify(statsDataFromClubData(b, a))).toBe(JSON.stringify(merged));
  });
});
