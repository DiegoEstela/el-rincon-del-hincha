import { describe, expect, it } from "vitest";
import { validDataset } from "../../fixtures/data-model/dataset";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import type { ClubOption } from "@/lib/club-options";
import { clubShortNamer } from "@/lib/match-card-view";

const ds = validDataset();
ds["clubs.json"].push({
  id: "opponent-z",
  name: "Opponent Z",
  short_name: "Opp Z",
  aliases: [],
  selectable: false,
  country: "UY",
  source: "fixture:synthetic",
});
const index = buildStatsIndex(statsDataFrom(ds));
const option = {
  id: "club-a",
  name: "Club Ficticio A",
  shortName: "Ficticio A",
  searchKeys: [],
  crest: {
    initials: "A",
    initialsInk: "#ffffff",
    pattern: "solid" as const,
    primary: "#112233",
    secondary: "#ffffff",
  },
} satisfies ClubOption;

describe("clubShortNamer (ADR 0022)", () => {
  const shortName = clubShortNamer(new Map([[option.id, option]]), index);
  it("uses the catalog for a selectable club", () => {
    expect(shortName("club-a")).toBe("Ficticio A");
  });
  it("uses the record of an opponent, which is not in the catalog", () => {
    expect(shortName("opponent-z")).toBe("Opp Z");
  });
  it("falls back to the id for an unknown club", () => {
    expect(shortName("nobody")).toBe("nobody");
  });
});
