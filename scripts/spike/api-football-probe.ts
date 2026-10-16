// Spike for ADR 0003: measures what the API-Football free plan really allows.
// Reads API_FOOTBALL_KEY from the environment (loaded by the pnpm script) and NEVER prints it.
// Writes a secret-free summary to docs/spike/api-football-probe.json.
// Makes 16 calls, spaced to respect 10 requests/minute. Worst case 7 count against the daily quota
// (only 7 returned data; the quota headers were inconsistent, so the exact cost was not measured).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const BASE = "https://v3.football.api-sports.io";
const TIMEOUT_MS = 15_000;
const apiKeyFromEnv = process.env.API_FOOTBALL_KEY;
if (!apiKeyFromEnv) {
  console.error(
    "API_FOOTBALL_KEY is not set. Put it in .env.local and run `pnpm spike:api-football`.",
  );
  process.exit(1);
}
const apiKey: string = apiKeyFromEnv;

const Errors = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);
const Envelope = z.object({
  errors: Errors.optional(),
  results: z.number().optional(),
  response: z.unknown().optional(),
});
const StatusResponse = z.object({
  subscription: z.object({ plan: z.string(), active: z.boolean(), end: z.string() }),
  requests: z.object({ current: z.number(), limit_day: z.number() }),
});
const LeaguesResponse = z.array(
  z.object({
    seasons: z.array(z.object({ year: z.number(), coverage: z.unknown() })),
  }),
);

type Probe = {
  label: string;
  path: string;
  status: number;
  results: number | null;
  errors: unknown;
  quota: { limit: string | null; remaining: string | null };
  perMinute: { limit: string | null; remaining: string | null };
  extra?: unknown;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(
  label: string,
  path: string,
  extract?: (response: unknown) => unknown,
): Promise<Probe> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // Do not waste quota: stop on rate limiting or server errors.
  if (res.status === 429 || res.status >= 500) {
    throw new Error(`${label}: unexpected HTTP ${res.status}, aborting`);
  }
  const envelope = Envelope.parse(await res.json());
  const hasErrors = Array.isArray(envelope.errors)
    ? envelope.errors.length > 0
    : Object.keys(envelope.errors ?? {}).length > 0;
  const probe: Probe = {
    label,
    path,
    status: res.status,
    results: envelope.results ?? null,
    errors: hasErrors ? envelope.errors : null,
    quota: {
      limit: res.headers.get("x-ratelimit-requests-limit"),
      remaining: res.headers.get("x-ratelimit-requests-remaining"),
    },
    perMinute: {
      limit: res.headers.get("x-ratelimit-limit"),
      remaining: res.headers.get("x-ratelimit-remaining"),
    },
    extra: extract ? extract(envelope.response) : undefined,
  };
  console.log(
    `${label.padEnd(34)} http ${probe.status}  results ${probe.results ?? "-"}  quota left ${probe.quota.remaining ?? "?"}/${probe.quota.limit ?? "?"}${probe.errors ? "  ERRORS " + JSON.stringify(probe.errors) : ""}`,
  );
  await sleep(7000); // stay under 10 requests per minute
  return probe;
}

const CUPS_2024 = [
  { id: 130, name: "Copa Argentina" },
  { id: 13, name: "Copa Libertadores" },
  { id: 11, name: "Copa Sudamericana" },
];
const LEAGUE_SEASONS = [2010, 2014, 2016, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

async function main() {
  const probes: Probe[] = [];

  probes.push(
    await call("account status", "/status", (response) => {
      const { subscription, requests } = StatusResponse.parse(response);
      return { subscription, requests };
    }),
  );

  probes.push(
    await call("league 128 coverage by season", "/leagues?id=128", (response) => {
      const [league] = LeaguesResponse.parse(response);
      return league?.seasons.map(({ year, coverage }) => ({ year, coverage }));
    }),
  );

  // Which seasons of the local league can the free plan actually read?
  for (const season of LEAGUE_SEASONS) {
    probes.push(
      await call(`fixtures 128 season ${season}`, `/fixtures?league=128&season=${season}`),
    );
  }

  // Do the cups and international competitions open on the free plan?
  for (const cup of CUPS_2024) {
    probes.push(
      await call(`fixtures ${cup.id} ${cup.name} 2024`, `/fixtures?league=${cup.id}&season=2024`),
    );
  }

  const dir = join(process.cwd(), "docs", "spike");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "api-football-probe.json"),
    JSON.stringify({ measuredAt: new Date().toISOString(), probes }, null, 2) + "\n",
  );
  console.log("\nSaved docs/spike/api-football-probe.json (no secrets inside).");
}

main().catch((e) => {
  console.error("Probe failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
