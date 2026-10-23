// CLI for the ingestion adapters (ADR 0015).
// Usage: pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>] [--network] [--cross-check]
//   --out         data directory to read and write (default: data)
//   --from        read the pinned input files from this directory instead of the network
//   --network     read the live pages of an adapter that may (rsssf may not: only data:snapshot requests rsssf.org)
//   --cross-check print the read-only comparison of the adapter with data/ and write nothing
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { runAdapter, type Adapter } from "./core/adapter";
import { IngestError } from "./core/commit";
import { chooseLoader } from "./loader-choice";
import { openfootballAdapter } from "./openfootball";
import { rsssfAdapter } from "./rsssf";

// The registry is heterogeneous: each adapter has its own raw type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: Record<string, Adapter<any>> = {
  openfootball: openfootballAdapter,
  rsssf: rsssfAdapter,
};

const USAGE = `Usage: pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>] [--network] [--cross-check]
Adapters: ${Object.keys(ADAPTERS).join(", ")}`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      out: { type: "string", default: "data" },
      from: { type: "string" },
      network: { type: "boolean", default: false },
      "cross-check": { type: "boolean", default: false },
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
    const { report, summary, crossCheck } = await runAdapter(adapter, {
      dir: resolve(values.out),
      loader: chooseLoader(adapter, {
        from: values.from === undefined ? undefined : resolve(values.from),
        network: values.network === true,
      }),
      now: new Date(),
      dryRun,
      crossCheck: values["cross-check"] === true,
    });
    if (crossCheck !== undefined) {
      for (const line of crossCheck) console.log(line);
      console.log(`data:ingest cross-check: ${crossCheck.length} line(s) (nothing written)`);
      return 0;
    }
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
      console.error(
        `data:ingest failed: ${e instanceof Error ? e.message : String(e)}; data/ was not changed`,
      );
    }
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});
