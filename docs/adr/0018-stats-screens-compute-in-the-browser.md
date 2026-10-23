# 0018 — Stats screens compute in the browser on per-club static data

Status: **Accepted** (2026-10-17). Written with plan 0015 (issue #15). Diego approved decision 1 (plan 0015, item D1) on 2026-10-17, accepting that the stats screens do not read Supabase in the MVP (master prompt section 3.1 point 5 and ADR 0006 say the app reads from Supabase).

## Context

The rivals screen (`/rivales`, issue #15, section 5.3) and the rivalry detail (`/rivales/[rival]`, section 5.4) show statistics of one fan: their club since their start date. The statistics engine is pure TypeScript in `src/domain` (ADR 0010) and needs the fan's club, the start date and the club's matches, coverage rows, seasons and competitions. Constraints:

- **Privacy.** The start date is usually a birth date. ADR 0013 (decision 7) and `/privacidad` promise that it is stored only on the device and never appears in a URL, a log, a cookie, a request or an analytics event. Only the friend comparison (#16) sends it, on purpose, to Supabase.
- **Static shells.** `cacheComponents: true`: every route is a prerendered static shell (ADR 0013, 0014). Reading `cookies()` or `searchParams` on the server makes the route dynamic.
- **CSP.** `connect-src 'self'` and `script-src 'self' 'unsafe-inline'` (ADR 0014). Same-origin fetches are allowed; nothing else.
- **JS budget.** 170 KB gzip of initial JS per route (prompt section 4.3, enforced by #18). Measured on the local production build of 2026-10-17 (`.next/server/app/rivales.html`, the placeholder page): 142.8 KB gzip of module scripts (the 39.6 KB `noModule` polyfill chunk excluded), of which about 132 KB is the Next.js and React runtime and 10.8 KB the app shell. The headroom is about 27 KB.
- **Data size.** `data/matches.json` is 1,324,880 bytes (2,435 matches); minified it is 1.09 MB, 52.7 KB gzip, 35.0 KB brotli. It must not be shipped to the client whole, and it will grow by an order of magnitude when pre-2018 history (ADR 0011) lands.
- **Supabase** has no seed yet (issue #10) and pauses after a week without traffic on the free plan (ADR 0006).

Options evaluated (details and numbers in plan 0015, "Where the computation runs"):

- **A. Per-club static data plus the engine in the browser.** A `GET` route handler with `generateStaticParams` prerenders one JSON document per club at build time from `data/`; the browser fetches its club's document and runs the engine with the start date read from `localStorage`.
- **B. `POST` route handler with the club and the date in the body,** validated with Zod and computed on the server.
- **C. Server Components reading a cookie** with the club and the date.
- **D. Others:** the whole dataset as one static file; JSON chunks imported with dynamic `import()`; a Server Action; precomputing per club and start year.

## Decision

1. **Option A.** Statistics screens compute in the browser. For each club, `GET /api/clubs/[clubId]` returns a versioned `ClubData` document (`v: 1`): the club and every opponent it has met (full `Club` records), all competitions and seasons, every match of the club (suspended ones included, full records with `source`), and the club's coverage, rivalries, titles and movements rows. The handler reads `data/` through a server-only module (parsed with the Zod schemas of `src/data-model`), uses no request data, and is prerendered for every club id at build time. Supabase is not on the read path of the statistics screens in the MVP; it stays the store of comparisons (#16).
2. **The slice is defined in the domain and proven equivalent.** `sliceClubData(data, clubId)` and `statsDataFromClubData(clubData)` live in `src/domain/club-data.ts` (100% branch coverage). An integration test runs `groupRivals` (and `headToHead` over two merged slices) on the slice and on the full dataset, for every club, several start dates and every filter, and asserts deep equality. A slice that loses a record the engine needs fails CI.
3. **Only the club id travels.** The request URL is `/api/clubs/<clubId>` with no query string and no body. The start date, the year range (whose default lower bound is the start year) and every other filter stay in React state in the browser. Filters are not mirrored in the URL.
4. **Validation at each boundary (issue #43).**
   - Server: the route handler validates `clubId` with a Zod schema built from the dataset's club ids and answers `400 {"error":"unknown_club"}` without echoing the input. The shared Zod schemas for route handlers and Server Actions live in `src/lib/engine-input.server.ts` (club id, start date, club and rival pair), ready for #16.
   - Client: no Zod in the browser (the full schemas of `src/data-model` measure 94 KB gzip; `zod/mini` alone is about 5.7 KB). The client uses small hand-written, tested guards: `parseFanChoice` (existing) for the stored club and date, `isClubData` for the fetched document (version, club id, array shapes), and pure parsers for filters and the rival id. Every error result is a code and never contains the input.
5. **The engine stays the only implementation** (ADR 0010). The client imports `src/domain` directly; measured with esbuild on 2026-10-17, `groupRivals` plus `fanPeriod` and `buildStatsIndex` is 5.7 KB minified, **2.3 KB gzip**; adding `headToHead` and `validateStartDate` gives **3.3 KB gzip**. No Zod and no contrast code reach the client.

## Consequences

- The start date never leaves the device, so the privacy promise holds by construction: there is no server code path that could log it. E2E tests watch every request URL, body and cookie.
- Zero function cost and no Supabase dependency for the statistics screens: the documents are static files on the CDN. The only runtime invocation is an unknown club id (a 400). Filter changes recompute in memory (a club has about 180 matches today; well under a millisecond) with no network round trip.
- Per-club documents measured on 2026-10-17 with the full records: largest Rosario Central, 182 matches, 98 KB raw, **8.2 KB gzip** (6.0 KB brotli); smallest San Martín de Tucumán, 25 matches, 3.4 KB gzip. All 34 together are 240 KB gzip. A size test guards growth.
- The rivalry detail fetches two documents (the fan's club and the rival) and merges them, because the head-to-head coverage notice merges the rows of both clubs.
- Data changes reach the screens on the next deploy, as with every other build-time read (the club catalog, ADR 0013). This matches the data flow: every data change is a PR that deploys.
- When pre-2018 history lands (ADR 0011, season precision, possibly from 1931), a club can have about 3,000 matches: an estimated 130 KB gzip with today's record shape. Before that happens, the document must get a compact encoding (for example one `source` per season file instead of per match, or tuples) or be split by era, through an amendment of this ADR. The size test makes the growth visible in CI.
- The statistics are computed after hydration, so the numbers are never in the server HTML: the shell shows a skeleton (returning visitor) or the empty state (no saved club), selected before hydration by the `html[data-club]` attribute that the boot script of ADR 0013 already sets. Search engines see the shell only, which is fine for personal data.
- Supabase reads stay planned only where the server must know the data (comparisons, #16; share images, Fase 4). ADR 0006's tables are unchanged. If server-side statistics are ever needed (for example an OG image with numbers), the same engine runs on the server over the same slice.
- The 170 KB budget leaves about 27 KB for the rivals screen over the current shell; plan 0015 caps its client code at 20 KB gzip.

## Note: what the screens may show about the start date (2026-10-17)

The rivals screen shows the month and year the counted period starts in ("Desde mayo de 1990"). That text derives from the start date, which can be a birth date. It stays on the device and is only rendered, never sent anywhere; the privacy audit of plan 0015 accepted it. Future screens must not add logging, analytics or any request around it, and the view model must keep returning a month and year, never the date.

> Amended by [ADR 0021](0021-titles-shared-table-and-title-coverage.md): `titles` is a shared table in every club document, like competitions and seasons.
