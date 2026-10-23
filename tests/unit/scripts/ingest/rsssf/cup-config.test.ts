// Phase B2: the reviewed configuration of the domestic cups agrees with the manifest, the
// competitions and itself, before any data is written.
import { describe, expect, it } from "vitest";
import {
  RSSSF_COMPETITIONS,
  RSSSF_CUP_TOURNAMENTS,
} from "../../../../../scripts/ingest/rsssf/config";
import { loadManifest } from "../../../../../scripts/ingest/rsssf/manifest";

const manifest = loadManifest("sources/rsssf");
const excerptOf = (page: string, name: string) =>
  manifest.pages
    .find((p) => p.url.endsWith(`/${page}.html`))
    ?.excerpts.find((e) => e.name === name);

describe("RSSSF_CUP_TOURNAMENTS", () => {
  it("has eleven editions: three Copa Argentina, three Trofeo, two Supercopa, three Supercopa Internacional", () => {
    const count = (id: string) =>
      RSSSF_CUP_TOURNAMENTS.filter((t) => t.competition_id === id).length;
    expect(RSSSF_CUP_TOURNAMENTS).toHaveLength(11);
    expect([
      count("copa-argentina"),
      count("trofeo-de-campeones"),
      count("supercopa-argentina"),
      count("supercopa-internacional"),
    ]).toEqual([3, 3, 2, 3]);
  });

  it("has unique season ids that start with their competition", () => {
    const ids = RSSSF_CUP_TOURNAMENTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of RSSSF_CUP_TOURNAMENTS)
      expect(t.id.startsWith(t.competition_id), t.id).toBe(true);
  });

  it("reads each edition from an excerpt of the manifest that uses the cup layout", () => {
    const used = new Set<string>();
    for (const t of RSSSF_CUP_TOURNAMENTS) {
      const excerpt = excerptOf(t.page, t.excerpt);
      expect(excerpt, t.id).toBeDefined();
      expect(excerpt!.layout, t.id).toBe("cup-full-names");
      used.add(`${t.page}.${t.excerpt}`);
    }
    expect(used.size).toBe(RSSSF_CUP_TOURNAMENTS.length);
  });

  it("writes only the matches of the app clubs and a title from each final", () => {
    for (const t of RSSSF_CUP_TOURNAMENTS) {
      expect(t.appClubsOnly, t.id).toBe(true);
      expect(t.titleFromFinal, t.id).toBe(true);
      expect(t.tableCoversSeason, t.id).toBe(false);
      expect(t.mode.kind, t.id).toBe("own");
    }
  });

  it("gives the year the edition was played in, which is not always the year of the page", () => {
    const year = (id: string) =>
      RSSSF_CUP_TOURNAMENTS.find((t) => t.id === id)!.window.from.slice(0, 4);
    expect(year("copa-argentina-2023")).toBe("2023");
    expect(year("supercopa-argentina-2023")).toBe("2024");
    expect(year("supercopa-internacional-2023")).toBe("2025");
    expect(year("supercopa-internacional-2025")).toBe("2026");
  });

  it("names competitions that exist, are recognized by the AFA and cite a permanent revision", () => {
    const known = new Map(RSSSF_COMPETITIONS.map((c) => [c.id, c]));
    for (const t of RSSSF_CUP_TOURNAMENTS) expect(known.has(t.competition_id), t.id).toBe(true);
    for (const id of [
      "copa-argentina",
      "supercopa-argentina",
      "supercopa-internacional",
      "trofeo-de-campeones",
    ]) {
      const c = known.get(id)!;
      expect(c.afa_recognized, id).toBe(true);
      expect(new URL(c.source).searchParams.get("oldid"), id).toMatch(/^\d+$/);
    }
  });
});
