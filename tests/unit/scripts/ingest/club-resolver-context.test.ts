import { describe, expect, it } from "vitest";
import { createClubResolver } from "../../../../scripts/ingest/core/club-resolver";

const clubs = [
  { id: "racing", aliases: ["Racing", "Racing Club", "Racing Club (Avellaneda)"] },
  { id: "boca", aliases: ["Boca Juniors", "CA Boca Juniors"] },
];
const at = (context: string | undefined, line = 1, season = "s1") => ({
  file: "page.txt",
  line,
  season,
  context,
});

describe("scoped spelling check and variants (plan 0017, T7)", () => {
  it("fails when two spellings of one club appear in the same season and context", () => {
    const r = createClubResolver(clubs);
    r.resolve("Racing", at("matches"));
    r.resolve("Racing Club", at("matches", 2));
    expect(r.problems()).toEqual([
      'season s1: "Racing" and "Racing Club" both resolve to the club "racing"',
    ]);
  });

  it("passes when the two spellings are in different contexts", () => {
    const r = createClubResolver(clubs);
    r.resolve("Racing", at("matches"));
    r.resolve("Racing Club (Avellaneda)", at("table"));
    expect(r.problems()).toEqual([]);
  });

  it("passes a pair listed in variants, in either order", () => {
    const r = createClubResolver(clubs, { variants: [["Racing Club", "Racing"]] });
    r.resolve("Racing", at("matches"));
    r.resolve("Racing Club", at("matches", 2));
    expect(r.problems()).toEqual([]);
  });

  it("still fails an unlisted third spelling", () => {
    const r = createClubResolver(clubs, { variants: [["Racing", "Racing Club"]] });
    r.resolve("Racing", at("matches"));
    r.resolve("Racing Club", at("matches", 2));
    r.resolve("Racing Club (Avellaneda)", at("matches", 3));
    expect(r.problems()).toHaveLength(1);
    expect(r.problems()[0]).toMatch(/Racing Club \(Avellaneda\)/);
  });

  it("keeps the behavior without a context: one bucket per season", () => {
    const r = createClubResolver(clubs);
    r.resolve("Boca Juniors", at(undefined));
    r.resolve("CA Boca Juniors", at(undefined, 2));
    expect(r.problems()).toEqual([
      'season s1: "Boca Juniors" and "CA Boca Juniors" both resolve to the club "boca"',
    ]);
  });

  it("does not mix seasons", () => {
    const r = createClubResolver(clubs);
    r.resolve("Racing", at("matches", 1, "s1"));
    r.resolve("Racing Club", at("matches", 2, "s2"));
    expect(r.problems()).toEqual([]);
  });

  it("names the context in the message when there is one in a table", () => {
    const r = createClubResolver(clubs);
    r.resolve("Racing", at("table"));
    r.resolve("Racing Club", at("table", 2));
    expect(r.problems()[0]).toContain("season s1");
  });
});
