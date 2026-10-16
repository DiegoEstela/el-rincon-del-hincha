// Local check of data/clubs.json aliases against the gitignored Kaggle CSV (plan 0007, T9).
// Usage: tsx scripts/check-club-aliases.ts [csv] [--strict]   (default csv: tools/liga_2023.csv)
// Reads team names only, prints names and counts only, never writes files. Not run in CI.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clubSchema } from "../src/data-model/schemas";
import { analyzeClubNames, formatReport } from "./lib/club-aliases-check";
import { KAGGLE_CLUB_NAMES, KAGGLE_LOOKALIKE_NAMES } from "../tests/fixtures/clubs/source-names";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const csvPath = join(process.cwd(), args.find((a) => !a.startsWith("--")) ?? "tools/liga_2023.csv");

const clubs = clubSchema
  .array()
  .parse(JSON.parse(readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8")));
// Only the clubs present in data/clubs.json are required to resolve.
const present = new Set(clubs.map((c) => c.id));
const expected = Object.fromEntries(
  Object.entries(KAGGLE_CLUB_NAMES).filter(([, id]) => present.has(id)),
);

const report = analyzeClubNames(readFileSync(csvPath, "utf8"), clubs, KAGGLE_LOOKALIKE_NAMES, {
  strict,
  expected,
});
console.log(formatReport(report));
process.exit(report.exitCode);
