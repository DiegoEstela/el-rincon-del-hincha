// Writes data/coverage.json from the seasons and matches we have plus the declared gaps
// (plan 0014, ADR 0017). Usage: tsx scripts/generate-coverage.ts [dir] [--check]
//   dir      data directory (default: data, relative to cwd)
//   --check  write nothing; exit 1 when coverage.json is missing or differs from what is derived
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { IngestError } from "./ingest/core/errors";
import { coverageText, deriveCoverage } from "./lib/coverage-file";

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { check: { type: "boolean", default: false } },
  });
  const dir = resolve(positionals[0] ?? "data");
  if (!existsSync(dir)) {
    console.error(`data:coverage failed: directory not found: ${dir}`);
    return 1;
  }

  const dataset: Record<string, unknown[]> = {};
  for (const file of ["clubs.json", "competitions.json", "seasons.json", "matches.json"]) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    try {
      dataset[file] = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as unknown[];
    } catch (e) {
      console.error(`data:coverage failed: ${file} is not valid JSON (${(e as Error).message})`);
      return 1;
    }
  }

  try {
    const rows = deriveCoverage(dataset);
    if (rows === null) {
      console.error(
        "data:coverage failed: an input file has invalid records; run pnpm data:validate",
      );
      return 1;
    }
    const text = await coverageText(rows);
    const target = join(dir, "coverage.json");
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;

    if (values.check) {
      if (current === text) {
        console.log(`data:coverage ok (coverage.json is up to date, ${rows.length} rows)`);
        return 0;
      }
      console.error("data:coverage failed: coverage.json is out of date; run pnpm data:coverage");
      return 1;
    }
    if (current === text) {
      console.log(`coverage.json unchanged (${rows.length} rows)`);
    } else {
      writeFileSync(target, text);
      console.log(`coverage.json written (${rows.length} rows)`);
    }
    return 0;
  } catch (e) {
    const problems =
      e instanceof IngestError ? e.problems : [e instanceof Error ? e.message : String(e)];
    for (const p of problems) console.error(p);
    console.error("data:coverage failed; coverage.json was not changed");
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});
