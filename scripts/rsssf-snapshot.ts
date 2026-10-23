// Refreshes the pinned RSSSF excerpts (plan 0017, ADR 0020). The only script that requests
// rsssf.org. Never run in CI.
// Usage: pnpm data:snapshot rsssf [--check]
//   --check  list the pages that changed since the manifest and write nothing (exit 1 if any)
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { runSnapshot } from "./ingest/rsssf/snapshot";

const USAGE = "Usage: pnpm data:snapshot rsssf [--check]";

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { check: { type: "boolean", default: false } },
  });
  if (positionals[0] !== "rsssf") {
    console.error(USAGE);
    return 1;
  }
  try {
    const check = values.check === true;
    const { changed, written } = await runSnapshot({
      dir: resolve("sources/rsssf"),
      now: new Date(),
      check,
    });
    for (const url of changed) console.log(`${check ? "changed" : "refreshed"}: ${url}`);
    for (const file of written) console.log(`wrote sources/rsssf/${file}`);
    console.log(
      changed.length === 0
        ? "data:snapshot ok (nothing changed)"
        : `data:snapshot ${changed.length} page(s)`,
    );
    return check && changed.length > 0 ? 1 : 0;
  } catch (e) {
    console.error(`data:snapshot failed: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});
