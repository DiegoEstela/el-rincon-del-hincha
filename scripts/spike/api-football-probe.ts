// Spike for ADR 0003: measures what the API-Football free plan really allows.
// Reads API_FOOTBALL_KEY from the environment (loaded by the pnpm script) and NEVER prints it.
// Writes a secret-free summary to docs/spike/api-football-probe.json.
// Cost: about 22 requests of the daily quota (sequential, spaced to respect 10 requests/minute).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const BASE = "https://v3.football.api-sports.io";
const key = process.env.API_FOOTBALL_KEY;
if (!key) {
  console.error(
    "API_FOOTBALL_KEY is not set. Put it in .env.local and run `pnpm spike:api-football`.",
  );
  process.exit(1);
}

const Envelope = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  results: z.number().optional(),
  response: z.unknown().optional(),
});

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
  extract?: (body: unknown) => unknown,
): Promise<Probe> {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": key as string } });
  const body: unknown = await res.json().catch(() => ({}));
  const parsed = Envelope.safeParse(body);
  const env = parsed.success ? parsed.data : {};
  const errors = Array.isArray(env.errors) && env.errors.length === 0 ? null : (env.errors ?? null);
  const probe: Probe = {
    label,
    path,
    status: res.status,
    results: env.results ?? null,
    errors: errors && Object.keys(errors as object).length === 0 ? null : errors,
    quota: {
      limit: res.headers.get("x-ratelimit-requests-limit"),
      remaining: res.headers.get("x-ratelimit-requests-remaining"),
    },
    perMinute: {
      limit: res.headers.get("x-ratelimit-limit"),
      remaining: res.headers.get("x-ratelimit-remaining"),
    },
    extra: extract ? extract(body) : undefined,
  };
  console.log(
    `${label.padEnd(34)} http ${probe.status}  results ${probe.results ?? "-"}  quota left ${probe.quota.remaining ?? "?"}/${probe.quota.limit ?? "?"}${probe.errors ? "  ERRORS " + JSON.stringify(probe.errors) : ""}`,
  );
  await sleep(7000); // stay under 10 requests per minute
  return probe;
}

const LEAGUES = [
  { id: 128, name: "Liga Profesional Argentina" },
  { id: 130, name: "Copa Argentina" },
  { id: 13, name: "Copa Libertadores" },
  { id: 11, name: "Copa Sudamericana" },
];

async function main() {
  const probes: Probe[] = [];

  probes.push(
    await call("account status", "/status", (b) => {
      const r = (b as { response?: { subscription?: unknown; requests?: unknown } }).response;
      return { subscription: r?.subscription, requests: r?.requests };
    }),
  );

  probes.push(
    await call("league 128 coverage by season", "/leagues?id=128", (b) => {
      const league = (b as { response?: { seasons?: { year: number; coverage?: unknown }[] }[] })
        .response?.[0];
      return league?.seasons?.map((s) => ({ year: s.year, coverage: s.coverage }));
    }),
  );

  // Which seasons of the local league can the free plan actually read?
  for (const season of [2010, 2014, 2016, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
    probes.push(
      await call(`fixtures 128 season ${season}`, `/fixtures?league=128&season=${season}`),
    );
  }

  // Do the cups and international competitions exist and open on the free plan?
  for (const league of LEAGUES.slice(1)) {
    probes.push(
      await call(
        `fixtures ${league.id} ${league.name} 2024`,
        `/fixtures?league=${league.id}&season=2024`,
      ),
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
  console.error("Probe failed:", (e as Error).message);
  process.exit(1);
});
