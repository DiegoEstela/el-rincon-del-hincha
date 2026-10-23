import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IngestError } from "../../../../../scripts/ingest/core/commit";
import {
  OPENFOOTBALL_COMPETITIONS,
  OPENFOOTBALL_FILES,
  OPENFOOTBALL_SEASONS,
  OPENFOOTBALL_SOURCE_PREFIX,
  type OpenfootballSeason,
} from "../../../../../scripts/ingest/openfootball/config";
import { normalizeOpenfootball } from "../../../../../scripts/ingest/openfootball/normalize";
import { parseOpenfootball } from "../../../../../scripts/ingest/openfootball/parse";
import { titleSchema } from "../../../../../src/data-model/schemas";
import { FIXTURE_CLUBS } from "../../../../fixtures/ingest/openfootball/clubs";

const FIXTURES = join(process.cwd(), "tests/fixtures/ingest/openfootball");
const parsedAll = OPENFOOTBALL_FILES.map((f) =>
  parseOpenfootball(f.file, readFileSync(join(FIXTURES, f.file), "utf8")),
);
const config = { competitions: OPENFOOTBALL_COMPETITIONS, seasons: OPENFOOTBALL_SEASONS };

describe("openfootball titles from a final (plan 0017, Diego 2026-10-23)", () => {
  const out = normalizeOpenfootball(parsedAll, FIXTURE_CLUBS, config);

  it("writes the title of the 2020 Copa de la Liga from its final, won on penalties", () => {
    expect(out.titles).toEqual([
      {
        id: "copa-de-la-liga-profesional-2020-boca-juniors",
        club_id: "boca-juniors",
        competition_id: "copa-de-la-liga-profesional",
        season_id: "copa-de-la-liga-profesional-2020",
        awarded_on: "2021-01-17",
        shared: false,
        source: expect.stringMatching(
          new RegExp(
            `^${OPENFOOTBALL_SOURCE_PREFIX}blob/[0-9a-f]{40}/argentina/2020_ar1\\.txt#L\\d+$`,
          ),
        ),
        verified: false,
      },
    ]);
    expect(() => titleSchema.parse(out.titles![0])).not.toThrow();
  });

  it("points the title to the line of the final in the file", () => {
    const final = out.matches.find((m) => m.id === "2021-01-17-boca-juniors-banfield")!;
    expect(out.titles![0].source).toBe(final.source);
  });

  it("writes no title for a season that is not marked", () => {
    expect(out.titles).toHaveLength(1);
    const unmarked = OPENFOOTBALL_SEASONS.map((s) => ({ ...s, titleFromFinal: undefined }));
    const none = normalizeOpenfootball(parsedAll, FIXTURE_CLUBS, { ...config, seasons: unmarked });
    expect(none.titles).toBeUndefined();
  });

  it("stops when a marked season has no final", () => {
    const marked: OpenfootballSeason[] = OPENFOOTBALL_SEASONS.map((s) =>
      s.id === "primera-division-2021" ? { ...s, titleFromFinal: true } : s,
    );
    let error: unknown;
    try {
      normalizeOpenfootball(parsedAll, FIXTURE_CLUBS, { ...config, seasons: marked });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(IngestError);
    expect((error as IngestError).problems[0]).toMatch(/primera-division-2021.*no final/);
  });
});
