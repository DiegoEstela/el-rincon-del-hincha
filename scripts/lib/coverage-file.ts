// Shared by `pnpm data:coverage` and the ingestion runner (plan 0014): turns a raw dataset into the
// coverage rows and their file text. Pure apart from Prettier.
import { z } from "zod";
import { COVERAGE_GAPS } from "../../src/data-model/coverage-gaps";
import { generateCoverage, type CoverageGap } from "../../src/data-model/coverage-generate";
import {
  clubSchema,
  competitionSchema,
  matchSchema,
  seasonSchema,
} from "../../src/data-model/schemas";
import type { Coverage } from "../../src/data-model/types";
import { IngestError } from "../ingest/core/errors";
import { serializeRecords } from "../ingest/core/serialize";

const INPUTS = {
  "clubs.json": clubSchema,
  "competitions.json": competitionSchema,
  "seasons.json": seasonSchema,
  "matches.json": matchSchema,
} as const;

/**
 * Coverage rows for a raw dataset, or `null` when one of the four input files does not parse (the
 * validator reports that, and a table derived from broken records would only add noise). Throws an
 * IngestError when the data is valid but incomplete in a way a person must declare (a partial
 * season whose tail is not inside a declared gap).
 */
export function deriveCoverage(
  dataset: Record<string, unknown[] | undefined>,
  gaps: readonly CoverageGap[] = COVERAGE_GAPS,
): Coverage[] | null {
  const parsed: Record<string, unknown> = {};
  for (const [file, schema] of Object.entries(INPUTS)) {
    const result = z.array(schema).safeParse(dataset[file] ?? []);
    if (!result.success) return null;
    parsed[file] = result.data;
  }
  try {
    return generateCoverage(parsed as Parameters<typeof generateCoverage>[0], gaps);
  } catch (e) {
    throw new IngestError([`coverage: ${e instanceof Error ? e.message : String(e)}`]);
  }
}

export function coverageText(rows: readonly Coverage[]): Promise<string> {
  return serializeRecords("coverage.json", rows);
}
