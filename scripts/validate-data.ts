// Phase 0 skeleton. Phase 1 adds the full rules of docs/methodology.md section 3.5
// (duplicates, unknown clubs, future dates, missing sources, control totals...).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data");
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
const errors: string[] = [];

for (const file of files) {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
    if (!Array.isArray(parsed)) errors.push(`${file}: root must be an array`);
  } catch (e) {
    errors.push(`${file}: invalid JSON (${(e as Error).message})`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`data:validate ok (${files.length} file(s) checked)`);
