// CLI for the ingestion adapters (ADR 0015).
// Usage: pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>]
//   --out   data directory to read and write (default: data)
//   --from  read the pinned input files from this directory instead of the network
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { directoryLoader, networkLoader, runAdapter, type Adapter } from "./core/adapter";
import { IngestError } from "./core/commit";
import { openfootballAdapter } from "./openfootball";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: Record<string, Adapter<any>> = { openfootball: openfootballAdapter };

const USAGE = `Usage: pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>]
Adapters: ${Object.keys(ADAPTERS).join(", ")}`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      out: { type: "string", default: "data" },
      from: { type: "string" },
    },
  });

  const name = positionals[0];
  if (!name) {
    console.error(USAGE);
    return 1;
  }
  const adapter = ADAPTERS[name];
  if (!adapter) {
    console.error(`data:ingest: unknown adapter "${name}"\n${USAGE}`);
    return 1;
  }

  const dryRun = values["dry-run"] === true;
  try {
    const { report, summary } = await runAdapter(adapter, {
      dir: resolve(values.out),
      loader: values.from ? directoryLoader(resolve(values.from)) : networkLoader,
      now: new Date(),
      dryRun,
    });
    for (const f of report.files) {
      const note = f.partial
        ? ` PARTIAL (source ends ${f.lastSourceDate}, season ends ${f.seasonEnd})`
        : "";
      console.log(`${f.file}: ${f.parsed} matches, ${f.first} to ${f.last}${note}`);
    }
    for (const [file, s] of Object.entries(summary)) {
      console.log(`${file}: +${s.added} -${s.removed} =${s.unchanged}`);
    }
    console.log(dryRun ? "data:ingest dry run ok (nothing written)" : "data:ingest ok");
    return 0;
  } catch (e) {
    if (e instanceof IngestError) {
      for (const p of e.problems) console.error(p);
      console.error(`data:ingest failed: ${e.problems.length} problem(s); data/ was not changed`);
    } else {
      console.error(`data:ingest failed: ${(e as Error).message}; data/ was not changed`);
    }
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});
