// Thin CLI around the pure validator in src/data-model (plan 0003). Only I/O lives here.
// Usage: tsx scripts/validate-data.ts [dir]   (default: data, relative to cwd)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../src/data-model/validate";
import type { ValidationIssue } from "../src/data-model/types";

const dataDir = join(process.cwd(), process.argv[2] ?? "data");
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

const raw: Record<string, unknown> = {};
const parseIssues: ValidationIssue[] = [];

for (const file of files) {
  // JSON.parse rejects a leading BOM, which some editors on Windows add.
  const text = readFileSync(join(dataDir, file), "utf8").replace(/^﻿/, "");
  try {
    raw[file] = JSON.parse(text);
  } catch (e) {
    parseIssues.push({
      rule: "invalid-json",
      file,
      recordId: null,
      message: (e as Error).message,
    });
  }
}

const issues = [...parseIssues, ...validate(raw, { now: new Date() })];

if (issues.length > 0) {
  for (const i of issues) {
    console.error(
      `[${i.rule}] ${i.file}${i.recordId === null ? "" : `#${i.recordId}`}: ${i.message}`,
    );
  }
  console.error(`data:validate failed: ${issues.length} issue(s)`);
  process.exit(1);
}
console.log(`data:validate ok (${files.length} file(s) checked)`);
