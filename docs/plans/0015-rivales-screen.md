---
issue: 15
status: done
date: 2026-10-17
---

# Plan 0015: "[Mi club] vs. Todos" (`/rivales`)

Related issues: #15 (MVP screens; this plan is its first slice), #43 (input validation before the engine), #18 (budgets and audits), #16 (compare, which will reuse the Zod schemas). Related ADRs: [0007](../adr/0007-visual-identity-lawn-neon.md) (tokens, shell, AA), [0008](../adr/0008-shell-polish-floating-panel-info-menu.md) (shell), [0010](../adr/0010-stats-engine-in-typescript.md) (engine), [0013](../adr/0013-club-theming-and-onboarding-storage.md) (storage, boot script, start date privacy), [0014](../adr/0014-security-headers-policy.md) (CSP), [0017](../adr/0017-derived-coverage-table.md) (coverage), [0018](../adr/0018-stats-screens-compute-in-the-browser.md) (**new, this plan**: where the computation runs).

## Goal

Replace the `/rivales` placeholder with the screen of section 5.3 of the master prompt: the fan's club against every rival it met since the fan's start date. Three summary cards, the list of rivals with P/W/D/L (PJ/PG/PE/PP), balance, a bar and a dominance chip, filters by year range and tournament type, sorting by balance, played or name, three humor sections, cards on mobile and a table on desktop, plus the coverage notice, skeleton, empty and error states. The rivalry detail (`/rivales/[rival]`, section 5.4) is the **second slice**, outlined at the end and planned separately.

## Acceptance criteria (copied from issue #15, the ones this slice covers)

- Given `/rivales`, when it loads, then it shows the three summary cards, the rivals list with PJ/PG/PE/PP, saldo, bar and dominance chip, year and tournament-type filters, sorting by saldo/PJ/name, and the humor sections; cards on mobile, table on desktop.
- Given a start date earlier than full coverage, when any screen shows stats, then a clear partial-coverage notice is shown.
- Given loading, empty or error states, when they occur, then skeletons, empty states and friendly errors are shown.
- Given every screen, when viewed, then it has the version and credits footer, copy in Rioplatense Spanish and the night-stadium design.

From issue #43 (the parts this slice exercises):

- Given a club id not in the known set, when received, then it responds 400.
- Given any validation error, when the response is built, then it does not echo the date.
- Given any request, when logging happens, then a test proves no log call receives the start date.
- Given valid input, when processed, then the stats engine is called as before.

Not in this slice: onboarding (done, plan 0008), `/vitrina`, `/rivales/[rival]` (second slice), compare, share and analytics (Fase 4), count-up animations and polish (Fase 5), Lighthouse and the automated JS budget (#18).

Extra constraints given for this plan: the start date never appears in a URL, a log or an analytics event; the 1.3 MB matches file is never shipped whole; the engine stays pure with 100% branch coverage; the coverage notice is shown whenever `isComplete` is false and **no screen shows a "complete" badge** while Phase 2 of plan 0014 (cups not loaded) is open; every number says which competitions it includes; mobile-first at 390x844 and 412x915, desktop sidebar layout, 44 px targets, WCAG 2.2 AA, reduced motion; inputs validated before the engine.

## What exists today

- **Engine** (`src/domain`): `groupRivals(index, clubId, period, filter)` returns `all` (one `RivalRow` per opponent with `record`, `dominance`, `isClassic`), `favorable`, `even`, `unfavorable` (already sorted balance desc, played desc, rival id) and one `coverage` notice for the club. `MatchFilter` filters by competition ids or types. `fanPeriod(start, now)` builds the period; the methodology says "a year range is a narrower period" but there is no helper for it. `classifyDominance` uses `DOMINANCE_THRESHOLDS` (+2 / -2). `headToHead` has everything section 5.4 needs.
- **Storage:** `src/lib/fan-storage.ts` (`parseFanChoice` validates shape, version, known club and date) and the boot script that sets `html[data-club]` before the first paint.
- **Catalog:** `src/lib/club-catalog.server.ts` exports `CLUB_OPTIONS` (name, short name, crest spec) built at build time; `Crest` renders a generic crest.
- **Data:** `clubs.json` (34), `competitions.json` (2: `primera-division` is `league`, `copa-de-la-liga-profesional` is `national_cup`), `seasons.json` (8), `matches.json` (2,435, all `played`, one `is_final`, some shoot-outs), `coverage.json` (232 rows). No `titles.json`, `movements.json` or `rivalries.json` yet, so `isClassic` is false for every rival today. Nothing in `src/` imports matches yet. No Supabase seed.
- **Real output of the engine** (run on 2026-10-17 with today's data): River Plate from 1990-05-20 has 33 rivals (21 favorable, 11 even, 1 unfavorable), `isComplete: false` (Primera partial 2018-08-10 to 2025-05-04, Copa de la Liga partial 2020-10-30 to 2021-02-11). Belgrano from 2000-01-01: 0 favorable, 27 even, 6 unfavorable, Copa de la Liga `missing`. Racing from 2025-06-01: no rivals at all, Primera `missing`. **River with the period narrowed to 2019 gives `isComplete: true`**, although the Copa Argentina and international cups of 2019 are not loaded: this is exactly why no complete badge may be shown.

## Where the computation runs (the architecture question)

Measured on 2026-10-17 (scripts run outside the repo, nothing committed):

| Measure                                                                                                               | Value                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `data/matches.json`                                                                                                   | 1,324,880 B raw; 1.09 MB minified; 52.7 KB gzip; 35.0 KB brotli            |
| One club's document (club and opponents' `Club` records, competitions, seasons, the club's matches and coverage rows) | max Rosario Central 182 matches: 98 KB raw, **8.2 KB gzip**, 6.0 KB brotli |
| Same, smallest club                                                                                                   | San Martín de Tucumán, 25 matches: 24.5 KB raw, 3.4 KB gzip                |
| Same without `source` and `verified` on matches (not chosen)                                                          | max 4.6 KB gzip                                                            |
| Engine for this screen in the client (`groupRivals`, `fanPeriod`, `buildStatsIndex`, esbuild minified)                | 5.7 KB min, **2.3 KB gzip**; no Zod, no contrast code                      |
| Engine for slice 2 (adds `headToHead`, `validateStartDate`)                                                           | 8.8 KB min, **3.3 KB gzip**                                                |
| Zod in the client: `src/data-model/schemas.ts` / a small `zod/mini` schema                                            | 94 KB gzip / 5.7 KB gzip                                                   |
| Current `/rivales` placeholder, module scripts in the HTML of the local build (polyfill `noModule` chunk excluded)    | 142.8 KB gzip (about 132 KB Next and React, 10.8 KB app shell)             |

Options:

| Option                                                                                                                                                          | Privacy (a)                                                                                                                                                                                        | Payload and JS (b)                                                                                | Static shell, CSP, cost                                                                                                     | Verdict                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **A.** Per-club JSON prerendered by a `GET` route handler with `generateStaticParams`; browser fetches it and runs the engine with the date from `localStorage` | Date never leaves the device. Only the club id is in the URL (already public in the future `onboarding_completado {club}` event).                                                                  | 3.4 to 8.2 KB gzip of data, 2.3 KB gzip of engine, plus the UI (target under 20 KB gzip total)    | Shell stays static; same-origin fetch fits `connect-src 'self'`; CDN files, no function cost                                | **Chosen**                                           |
| **B.** `POST /api/rivals` with club and date in the body, Zod, computed on the server                                                                           | Date leaves the device on every view and filter change, against ADR 0013 decision 7 and `/privacidad`. Bodies are not logged by default, but any future log, trace or error tool can capture them. | Smallest client (no engine, about 2 KB less), but a round trip per filter change                  | Uncacheable (per date), one function invocation per view and filter change, cold starts, needs rate limiting                | Rejected                                             |
| **C.** Server Components reading a cookie with club and date                                                                                                    | Date sent on **every** request to the origin, including pages that do not need it; ADR 0013 already rejected the cookie                                                                            | No engine in the client                                                                           | `cookies()` makes the route dynamic under Cache Components (loses the static shell); every navigation renders on the server | Rejected                                             |
| **D1.** The whole dataset as one static file                                                                                                                    | Same as A                                                                                                                                                                                          | 52.7 KB gzip today, growing about 16x with pre-2018 history; violates "never ship the file whole" | Simple, cached once                                                                                                         | Rejected                                             |
| **D2.** Per-club JSON modules loaded with dynamic `import()`                                                                                                    | Same as A                                                                                                                                                                                          | Same as A                                                                                         | Needs generated files on disk (a prebuild step and either committed artifacts or a build script); JSON becomes JS chunks    | Rejected: more moving parts than a prerendered route |
| **D3.** Server Action with club and date                                                                                                                        | Same as B (it is a `POST` with the date in the body)                                                                                                                                               | Same as B                                                                                         | Same as B                                                                                                                   | Rejected                                             |
| **D4.** Server precomputes per club and start year; client picks one                                                                                            | Year only, not the date                                                                                                                                                                            | Wrong numbers: the period starts on a day, not a year                                             | 34 x ~140 documents                                                                                                         | Rejected (breaks the methodology)                    |

**Recommendation: A** (ADR 0018). It is the only option that meets (a) by construction, keeps every route a static shell, fits the CSP with no change, costs nothing at runtime and keeps the engine the single implementation. Its costs: numbers appear after hydration (skeleton first), and the per-club document must get a compact encoding before pre-2018 history lands (ADR 0018, consequences).

## Approach

### Data contract (server to client)

`src/domain/club-data.ts` (pure, 100% branches):

```ts
export const CLUB_DATA_VERSION = 1;
export type ClubData = Readonly<{
  v: 1;
  clubId: string;
  clubs: readonly Club[]; // the club and every opponent in its matches, sorted by id
  competitions: readonly Competition[]; // all, sorted by id
  seasons: readonly Season[]; // all, sorted by id
  matches: readonly Match[]; // every match of the club, suspended included, by date then id
  coverage: readonly Coverage[]; // rows of the club only
  titles: readonly Title[]; // rows of the club (empty today; for the vitrina slice)
  movements: readonly Movement[]; // rows of the club (empty today)
  rivalries: readonly Rivalry[]; // rows where the club is club_a or club_b (empty today)
}>;
export function sliceClubData(data: StatsData, clubId: string): ClubData; // RangeError if the club is unknown
export function statsDataFromClubData(...docs: readonly ClubData[]): StatsData; // merges, dedupes by id/key
```

- Records keep the exact data-model shape (ADR 0009), including `source` and `verified`, so the engine types hold and a future "ver fuente" link needs no new endpoint. Dropping them would save about 3.6 KB gzip on the largest club; not worth a second record type.
- All seasons and competitions are included on purpose: `relevantCompetitionIds` scans every season of a competition known for the club, and coverage has a row for every club and competition pair (ADR 0017, decision 6).
- **Equivalence is a test, not a belief** (task T3): for every club, several start dates and every filter, `groupRivals` on the slice deep-equals `groupRivals` on the full dataset; the same for `headToHead` on two merged slices.

### Server delivery

- `src/lib/club-data.server.ts` (`import "server-only"`): imports the existing `data/*.json` files at module scope (like `club-catalog.server.ts`), parses them with the Zod schemas, uses `[]` for the files that do not exist yet, and exports `CLUB_IDS` and `clubDataFor(clubId)`. A test asserts that every `DATASET_FILES` entry present in `data/` is imported, so adding `titles.json` later without wiring it fails CI.
- `src/app/api/clubs/[clubId]/route.ts`: `generateStaticParams()` returns the 34 ids; `GET(_request, { params })` validates the id with `clubIdSchema` (Zod enum of `CLUB_IDS`, from `src/lib/engine-input.server.ts`) and returns `Response.json(clubDataFor(id))`, or `400 {"error":"unknown_club"}` without echoing the input. It reads no request data, no clock and no cookie, so it is prerendered at build time (Next 16 docs: route handlers with `generateStaticParams` under Cache Components; `dynamicParams` is not available with Cache Components, so an unknown id runs at request time and gets the 400). No `console` call anywhere. The security headers of ADR 0014 already apply to `/:path*`.
- Caching: prerendered output on the CDN with Next's default headers for static route output; the build check (T9) records the actual `Cache-Control`. The document changes only with a deploy.

### Client flow

1. `src/app/rivales/page.tsx` stays a Server Component and a static shell: metadata, then `<RivalsScreen clubs={CLUB_OPTIONS} />`. The club list goes in the RSC payload (under 2 KB gzip, as on `/`), not in the JS.
2. `RivalsScreen` (client) reads the saved choice with `useSyncExternalStore`: the **server snapshot is a sentinel "unknown"**, so the prerendered HTML and the hydration pass render the pending block; right after hydration it becomes "none" (empty state) or the choice. The pending block holds the skeleton and the empty state, and CSS picks one before hydration: `html[data-club] .pending-empty { display: none }`, `html:not([data-club]) .pending-skeleton { display: none }` (the boot script of ADR 0013 already sets `data-club`). A first-time visitor sees the empty state at once; a returning one sees the skeleton.
3. With a choice: `loadClubData(clubId)` (`src/lib/club-data-client.ts`) fetches `/api/clubs/<clubId>` (GET, no query, no body, `credentials: "same-origin"`), checks `ok` and the JSON, validates with `isClubData(value, clubId)`, and caches the promise per club in a module map (deduped; a failed promise is evicted so "Reintentar" fetches again). The function signature takes only the club id: it cannot receive the date.
4. `buildRivalsView(input)` (`src/lib/rivals-view.ts`, pure) builds the index once per document (memoized by the caller), computes `fanPeriod(startDate, now)`, narrows it by the year range, runs `groupRivals` with the type filter, then shapes the screen model: summary counts, sorted rows with names and crests from the catalog, bar ratios, the three humor sections, the competitions included, the coverage copy and the empty flags. `now` is `new Date()` taken in the client after mount (never during prerender).
5. Filter and sort changes recompute in memory, synchronously (about 180 matches per club today).
6. Any render error inside the segment is caught by `src/app/rivales/error.tsx` (friendly error, retry with `reset()`), which logs nothing.

### Engine additions (small, pure, tests first)

- `groupRivals` also returns `competitionIds`: the sorted ids of the competitions with counted matches in the period and filter (same field and rule as `HeadToHead.competitionIds`). The screen needs it to say which competitions the numbers include.
- `narrowPeriod(period, { fromYear, toYear })` in `src/domain/period.ts`: `start = max(period.start, fromYear-01-01)`, `end = min(period.end, toYear-12-31)`, `isEmpty = start > end` (or the input period was empty). `RangeError` when `fromYear > toYear` or a year is not an integer from 1880 to 9999. Methodology gets the exact rule.

### Input validation (issue #43)

| Input                          | Where it comes from      | Check                                                                                                                                                                  |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Club id (route param)          | URL of the route handler | `clubIdSchema` (Zod enum of dataset ids) in `src/lib/engine-input.server.ts`; 400 with `{"error":"unknown_club"}`, no echo                                             |
| Club id and start date         | `localStorage`           | `parseFanChoice` (existing: shape, version, known club from the catalog, `validateStartDate`). Anything wrong is "no choice", the empty state is shown                 |
| Fetched document               | `/api/clubs/<id>`        | `isClubData(value, clubId)`: `v === 1`, same `clubId`, every collection is an array, every match has string `id`, `date`, `home_id`, `away_id`, `season_id`            |
| Year range and tournament type | UI controls              | `parseRivalsFilter(raw, bounds)` in `src/lib/engine-input.ts`: integer years inside the bounds, `from <= to` (else swapped), type in the offered set, else the default |
| Sort                           | UI control               | one of `balance`, `played`, `name`, else `balance`                                                                                                                     |

- `src/lib/engine-input.server.ts` also exports `startDateSchema(now)` (a `z.string()` refined with `validateStartDate`; the issue message is the error code only) and `clubPairSchema` (club and rival known and different). They are unit tested now and consumed by #16 (the first handler that receives a start date) and by slice 2's static params. This PR uses "Refs #43"; see D7.
- No Zod in the client (94 KB gzip with the data-model schemas; ADR 0018, decision 4). Hand-written guards, 100% branches, as `fan-storage.ts` already does.
- No-echo rule: every parser and schema returns codes. Tests assert that `JSON.stringify` of every error result, and every `console` spy call during the component and e2e flows, contains none of `1990-05-20`, `20/05/1990`, `19900520`, `1990%2D05%2D20`.

### Screen design (mobile first, "Césped y neón")

Order on the page, the same on every viewport:

1. **Header.** Display title in uppercase (`font-display`): "{short name} vs. todos" with the club crest (the accessible name is the text; the crest is decorative). Before the choice is known: "Tu club vs. todos". Sub-line: "Desde {start month and year} · {played} partidos contra {n} rivales". The start month and year is on screen only; it is the fan's own device (see "Privacy" under Impact).
2. **Coverage notice** (`CoverageNotice`, shared component for vitrina and detail later): shown when `!coverage.isComplete && !period.isEmpty`, as a glass card with an info icon, `role="note"`, a heading and one line per listed competition. Below it, **always**, the "what we count" line: "Contamos: Primera División y Copa de la Liga Profesional." plus the static line about cups that are not loaded ("Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas."). When `isComplete` is true nothing else is shown: **no "complete" badge, no check icon, no green state** exists in the component.
3. **Filters bar.** "Desde" and "Hasta" native `<select>`s (years), a radio group "Torneo" (Todos / Liga / Copas nacionales, plus Internacionales and Otros only when the club's document has such competitions), and "Ordenar por" (Saldo / Partidos / Nombre) as a native `<select>`. "Limpiar filtros" button when any filter differs from the default. On mobile it is a horizontally wrapping row of 44 px controls under the notice; on desktop one row. A polite live region announces "Mostrando {n} rivales" after a change.
4. **Three summary cards** ("Historial favorable", "Historial igualado", "Historial desfavorable") with the count of rivals and a one-word cue, in win, even and loss colors plus an icon (not color alone). Each card is a link to its humor section (`#los-tenes-de-hijos`, `#historia-pareja`, `#te-tienen-de-hijo`), at least 44 px tall. Mobile: three equal columns (counts large, labels two lines); desktop: one row.
5. **Humor sections** (D2, D3): three `<section>`s with an `h2` each, showing the top 3 rivals of the group (favorable by balance desc; unfavorable by balance asc, i.e. the worst first; even by played desc), as compact rows (crest, name, balance), a one-line joke and an empty-state line. Desktop: three columns; mobile: stacked.
6. **The full list** (`h2` "Todos los rivales"), sorted by the chosen order:
   - **Mobile (below `lg`)**: `<ul aria-label="Rivales">` of cards. Each card: crest, short name, dominance chip on the right; a row of PJ, PG, PE, PP and "Saldo +6" with labels; the W/D/L bar; an "Incluye resultados administrativos" mark when `record.administrative.count > 0`, and "1 por penales" when there were shoot-outs. Cards are not links in this slice (slice 2 turns them into links to `/rivales/[rival]`).
   - **Desktop (`lg` and up)**: `<table>` with `<caption>` "Tu historial contra cada rival (Primera División y Copa de la Liga Profesional)", columns Rival, PJ, PG, PE, PP, Saldo, Balance (bar), Dominio (chip); `<th scope="col">` with `<abbr title="Partidos jugados">PJ</abbr>` and so on; `aria-sort` on the sorted column; numbers right-aligned in tabular figures; row height 44 px or more.
   - Both are rendered and the hidden one is `display: none` (`lg:hidden` / `hidden lg:block`), the pattern of ADR 0007, so the accessibility tree and Playwright see one at a time.
7. **Dominance chip** (`DominanceChip`): "Dominás" (`--win`, arrow up icon), "Parejo" (`--even`, equals icon), "Te domina" (`--loss`, arrow down icon), text plus icon on a 12% tint of the same color over glass. The pairs (text color on its tint over glass and over the glow) are added to the palette contrast test.
8. **Bar** (`RecordBar`): one horizontal bar with three segments W, D, L in that order, widths proportional to won, drawn and lost, 1 px gaps so adjacent segments are distinguishable, `aria-hidden` (the numbers are next to it). Segments grow from the left on first paint with a CSS transform transition under `motion-safe:` only; no `motion` library on this screen. Zero played never happens (a rival appears only with a counted match) but renders an empty track.
9. **States.**
   - Pending (server HTML and hydration): skeleton or empty state, chosen by CSS as above.
   - Loading: `RivalsSkeleton` with the same layout (header line, three cards, five list rows), `aria-busy="true"` on the region and a visually hidden "Cargando tu historial…"; the pulse uses `motion-safe:animate-pulse`.
   - Empty, no club chosen: a glass card "Todavía no elegiste tu club" with a link button "Elegí tu club" to `/#elegi-tu-club`.
   - Empty, no matches in the period (start after the last loaded match, or filters that leave nothing): "Todavía no hay partidos para contar" / "Con estos filtros no hay partidos", the coverage notice, and "Limpiar filtros" when filters are active.
   - Error (network, HTTP, bad document): "Se nos cortó la transmisión" with "Reintentar" (button, refetches) and a link to `/`. Render errors go to `error.tsx` with the same copy.
10. **Accessibility.** One `h1`, `h2` per block; landmarks unchanged; every control labelled; focus ring (`focus-visible:outline-accent`) on cards, chips are not interactive; 44 x 44 px minimum on every control and link; numbers keep 4.5:1; the bar is decorative; the live region announces only the result count (never the date); keyboard order header, notice, filters, cards, sections, list; reduced motion disables bar growth and skeleton pulse (global rule plus `motion-safe:`).

### Discarded alternatives (besides options B to D4 above)

- **Filters in the URL** (`?desde=1990`): the default lower year is the birth year, so the URL would leak it; and `searchParams` would make the page dynamic. Filters live in state and reset on reload.
- **Sorting by clicking table headers only**: not available on mobile cards; one "Ordenar por" control serves both, and the table sets `aria-sort`.
- **One `<table>` restyled as cards on mobile with `display: block`**: some browsers drop table semantics when the display of table parts changes. Two renderings with `display: none` is the shell's existing pattern.
- **SWR or TanStack Query**: one GET per club, never revalidated in the session; a 30-line loader with a promise map is enough and adds no dependency.
- **`motion` for bars and counters**: the CSS transition is enough; counters that count up are Fase 5 polish.
- **Zod in the browser**: see ADR 0018, decision 4.
- **Showing a "Cobertura completa" badge when `isComplete` is true**: forbidden until plan 0014 Phase 2 registers the cups; the 2019 example above proves it would be false.

## Decisions for Diego (NEEDS DIEGO)

Every task except T15 to T17 copy strings is independent of these answers; each answer changes constants or copy only. Each item can be answered in one line.

- **D1. Architecture (ADR 0018).** Compute in the browser on per-club static data, and do not read the statistics screens from Supabase in the MVP? **Recommended: yes.**
- **D2. Humor section names.** The prompt lists "Te tiene de hijo", "Historia pareja", "Te tienen de hijo", but "te tiene de hijo" means the rival dominates you, so the first and third say the same thing. Use "Los tenés de hijos" (favorable), "Historia pareja" (even), "Te tienen de hijo" (unfavorable)? **Recommended: yes** (the `/rivales` placeholder already says "a quién tenés de hijo … quién te tiene de hijo a vos").
- **D3. Humor sections layout.** A highlight block with the top 3 of each group above the full sortable list, or the list itself split into the three groups? **Recommended: top 3 highlights plus the full list.**
- **D4. Year options.** Only the years with loaded matches of the club inside the fan's period (today 2018 to 2025), or every year since the start year (mostly empty)? **Recommended: loaded years only; the coverage notice explains the rest.**
- **D5. Tournament type options.** Show only the types present in the club's data (today Todos, Liga, Copas nacionales), not empty "Internacionales"? **Recommended: yes; the static "cups not loaded" line says what is missing.**
- **D6. Sort.** Default "Saldo" (balance desc, then played desc, then name); "Partidos" (played desc, then balance desc); "Nombre" (A to Z, Spanish collation)? **Recommended: yes.**
- **D7. Issue #43.** This PR adds the shared schemas and the 400 for unknown club ids, but no handler receives a start date yet. Keep #43 open until #16 uses `startDateSchema`? **Recommended: yes ("Refs #43").**
- **D8. Issue #15 split.** Create sub-issues "Rivales screen" (this plan), "Rivalry detail" and "Vitrina", so each PR closes one? **Recommended: yes.**
- **D9. Copy.** Approve the Spanish strings in "Copy" below (they can be tuned on the live preview). **Recommended: approve.**

## Tasks

Test first in every task: write the failing test, then the code. Each task is one hour or less. Run `pnpm test` before checking a task off; `pnpm test:coverage` must keep 100% branches in `src/domain`, `src/data-model` and `src/lib`.

### Group A: engine and data contract (`src/domain`, pure)

- [x] **T1 `competitionIds` in `groupRivals`.** In `tests/unit/domain/rivals.test.ts`: two competitions with counted matches give both ids sorted; a type filter keeps only the matching ones; a competition with only suspended matches is not included; an empty period gives `[]`. Then add the field to `RivalGroups` and the methodology row "Rival grouping".
- [x] **T2 `narrowPeriod`.** In `tests/unit/domain/period.test.ts`: years inside the period clamp to Jan 1 and Dec 31; a from year before the start keeps the start; a to year of the current year keeps today (Buenos Aires, with `now = 2026-10-17T02:30:00Z` still the 16th); a range entirely before the start or after today gives `isEmpty: true`; an already empty period stays empty; `fromYear > toYear`, non-integer and out-of-range years throw `RangeError` with a message that has no date. Then the function and the methodology line under "Filter".
- [x] **T3 `sliceClubData` and `statsDataFromClubData`.** `tests/unit/domain/club-data.test.ts` on the synthetic `stats-world` fixture: only the club's matches (home and away, suspended included) sorted by date then id; only its coverage, titles, movements and rivalries rows; every competition and season; `clubs` holds the club and each opponent once; unknown club throws `RangeError`; `statsDataFromClubData(a, b)` dedupes matches by id, coverage by `(club_id, competition_id, from)` and clubs by id; the output is deterministic (same input, same JSON). Then `src/domain/club-data.ts`.
- [x] **T4 Slice equivalence on real data.** `tests/integration/club-data-equivalence.test.ts`: for each of the 34 clubs, start dates `1880-01-01`, `1990-05-20`, `2018-08-10`, `2020-11-01`, `2025-05-05`, today, and filters none, `league`, `national_cup`, `international`, plus the narrowed period 2019 to 2019: `groupRivals` on the slice deep-equals the full dataset. `headToHead` on two merged slices equals the full dataset for 10 fixed pairs (including clubs that left Primera: Belgrano, Arsenal). Fixed `now`.
- [x] **T5 Size guard.** Same file or `tests/integration/club-data-size.test.ts`: the gzip of every club document (`zlib.gzipSync(JSON.stringify(...))`) is under 16 KB (today 8.2 KB) and the raw JSON under 200 KB; prints the largest club. A failure means ADR 0018's compact encoding is due.

### Group B: input validation (`src/lib`, issue #43)

- [x] **T6 Client parsers.** `tests/unit/lib/engine-input.test.ts`: `parseRivalsFilter` returns the default for `undefined`, non-integers, years outside the bounds and unknown types; swaps `from > to`; keeps valid values; `parseSort` falls back to `balance`; `parseRivalId` (for slice 2) returns `unknown_club` and `same_club` codes; no result contains the raw input. Then `src/lib/engine-input.ts` (no Zod import; a test reads the file and asserts it).
- [x] **T7 Server schemas.** `tests/unit/lib/engine-input-server.test.ts` (with `vi.mock("server-only")`): `clubIdSchema` accepts the 34 ids and rejects `""`, `BOCA-JUNIORS`, `../boca-juniors`, `boca juniors`, a 10 KB string, numbers and objects; `startDateSchema(now)` accepts a valid date and rejects every `validateStartDate` error with the code as the only issue message; `clubPairSchema` rejects the same club twice; `JSON.stringify(error)` never contains the date fixtures. Then `src/lib/engine-input.server.ts`.

### Group C: server delivery

- [x] **T8 Server data module.** `tests/unit/lib/club-data-server.test.ts`: `CLUB_IDS` has 34 ids in dataset order; `clubDataFor("river-plate")` equals `sliceClubData` of the full dataset; unknown id returns `null`; every `DATASET_FILES` name that exists in `data/` is imported by the module (reads the directory and the source). Then `src/lib/club-data.server.ts`.
- [x] **T9 Route handler.** `tests/unit/app/club-data-route.test.ts` calling `GET` directly with `{ params: Promise.resolve({ clubId }) }`: a known id gives 200, `application/json` and the slice; unknown and malformed ids give 400 with exactly `{"error":"unknown_club"}`; `generateStaticParams` returns 34 params; every `console` method is spied and never called. Then `src/app/api/clubs/[clubId]/route.ts`. Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` first. Run `pnpm build`: the route is listed as prerendered with 34 paths, `/rivales` is still static; record the response size of `/api/clubs/rosario-central` and its `Cache-Control` and security headers (`curl -I` against `pnpm start`) in this plan's verification log.

### Group D: client data and view model (`src/lib`, pure, 100% branches)

- [x] **T10 Loader.** `tests/unit/lib/club-data-client.test.ts` with an injected fake `fetch`: requests exactly `/api/clubs/river-plate` with method GET, no body and no query; two concurrent calls make one request; 400, 500, network error, invalid JSON, `v: 2`, a different `clubId` and a non-array `matches` reject with `"http"`, `"network"` or `"shape"`; after a rejection the next call fetches again; `isClubData` covers each branch. Then `src/lib/club-data-client.ts`.
- [x] **T11 View model: rows and sort.** `tests/unit/lib/rivals-view.test.ts` on a small fixture document: rows carry name, short name and crest from the catalog (an opponent missing from the catalog falls back to its id); sort `balance`, `played` and `name` with ties (name uses `Intl.Collator("es-AR")`: "Colón" before "Defensa", "Unión" before "Vélez", accents ignored; final tie by id); bar ratios `won/played`, `drawn/played`, `lost/played` sum to 1; `administrative` and `shootouts` flags. Then the row part of `src/lib/rivals-view.ts`.
- [x] **T12 View model: summary, sections, filters, empty.** Same test file: summary counts equal the engine groups; sections take the top 3 (favorable by balance desc, unfavorable by balance asc, even by played desc) and are empty arrays when the group is; the year range narrows the period (via `narrowPeriod`) and the type filter reaches the engine; `includedCompetitionIds` comes from `groupRivals.competitionIds`; flags `noChoice`, `noMatches`, `filtersActive`; `yearOptions` lists only years with loaded matches of the club inside the period (D4) and `typeOptions` only the types present (D5). Then the rest of the module.
- [x] **T13 Coverage copy.** `tests/unit/lib/coverage-copy.test.ts`: `formatMonthYear("2018-08-10")` is "agosto de 2018" (own month table, no `Intl`, deterministic); `coverageCopy(notice, names)` returns `show: false` for a complete notice and for an empty period, and never returns any string matching `/complet/i` in that case; partial with `completeTo` gives "Primera División: tenemos todos los partidos de agosto de 2018 a mayo de 2025."; partial with `completeTo: null` gives "…desde {month year}."; missing gives "{name}: todavía no tenemos sus partidos completos en este período."; `includedLine(ids, names)` joins with commas and "y"; zero competitions gives "Todavía no hay partidos cargados para este período."; property: for 50 random start dates, no output contains the start date. Then `src/lib/coverage-copy.ts`.

### Group E: components (Testing Library, jsdom)

- [x] **T14 Chip and bar.** `tests/unit/components/rivals/dominance-chip.test.tsx` and `record-bar.test.tsx`: the three labels and icons, color classes per dominance, chip not focusable; the bar is `aria-hidden`, has three segments with the expected `flex-grow` or width, in W, D, L order, and uses `motion-safe:` transition classes. Extend `tests/unit/lib/palette-contrast.test.ts` with win, even and loss text on their 12% tint over glass and over the glow (4.5:1). Then `src/components/rivals/dominance-chip.tsx` and `record-bar.tsx`.
- [x] **T15 Summary and humor sections.** `rivals-summary.test.tsx`: three links with the counts, singular "1 rival" and plural "{n} rivales", `href` to the three section ids, minimum size classes; `humor-sections.test.tsx`: three `h2`s with the D2 names, up to 3 rows each, the empty line when a group is empty. Then the components.
- [x] **T16 List and table.** `rival-card-list.test.tsx`: a list named "Rivales" with one item per row, PJ/PG/PE/PP and "Saldo +6" (sign shown, "0" without sign), the chip, the administrative and penalties marks; `rivals-table.test.tsx`: caption with the included competitions, `th scope="col"`, `abbr` titles, `aria-sort="descending"` on the sorted column and `none` elsewhere, one row per rival, the list wrapper has `lg:hidden` and the table wrapper `hidden lg:block`. Then the components.
- [x] **T17 Filters.** `rivals-filters.test.tsx` (user-event): labelled "Desde" and "Hasta" selects with the year options; choosing a "Desde" after "Hasta" moves "Hasta" up; the "Torneo" radio group offers only the given types; "Ordenar por" select; "Limpiar filtros" appears only with active filters and restores the defaults; the live region text "Mostrando {n} rivales"; every control has the 44 px size classes. Then `src/components/rivals/rivals-filters.tsx`.
- [x] **T18 Coverage notice component.** `tests/unit/components/coverage/coverage-notice.test.tsx`: renders `role="note"` with the heading and lines when `show`; renders only the "Contamos" and "Todavía no cargamos …" lines when not; the DOM never contains "completa"/"completo" or a check icon in either case. Then `src/components/coverage/coverage-notice.tsx`.
- [x] **T19 State components.** `rivals-states.test.tsx`: skeleton has `aria-busy="true"` and the hidden "Cargando tu historial…", and `motion-safe:animate-pulse`; empty state links "Elegí tu club" to `/#elegi-tu-club`; no-matches state shows "Limpiar filtros" only with active filters; error state calls `onRetry` on "Reintentar". Then `src/components/rivals/rivals-skeleton.tsx`, `rivals-empty.tsx`, `rivals-error.tsx`.
- [x] **T20 `useFanChoice` hook.** `tests/unit/components/use-fan-choice.test.tsx`: server snapshot gives `"unknown"`; after mount gives `null` with no record or blocked storage, and the parsed choice with a valid one; a `writeFanChoice` in the same tab updates it. Then `src/components/fan/use-fan-choice.ts`, and switch `onboarding.tsx` to it (its tests stay green unchanged).
- [x] **T21 `RivalsScreen` container.** `tests/unit/components/rivals/rivals-screen.test.tsx` with the loader mocked and every `console` method spied: no choice shows the empty state; a choice shows the skeleton, then the title "River vs. todos", the notice, cards and list; loader rejection shows the error and "Reintentar" loads again; changing the type filter changes the summary counts; changing the saved club triggers a new load; `container.innerHTML` never contains the start date and no spy was called with it; the loader was called only with the club id. Then `src/components/rivals/rivals-screen.tsx`.
- [x] **T22 Page, pending CSS and error boundary.** `tests/unit/app/rivales-page.test.tsx`: the page renders the pending block with both `pending-skeleton` and `pending-empty`; `globals.css` has the two `html[data-club]` rules (string check, like the `.returning-slot` test); `error.tsx` renders "Se nos cortó la transmisión" and a retry button calling `reset`, and calls no `console` method. Then `src/app/rivales/page.tsx`, `src/app/rivales/error.tsx`, the CSS. Run `pnpm build`: `/rivales` still static; measure the gzip of the module scripts of `.next/server/app/rivales.html` (excluding `noModule`) before and after, and require **at most 20 KB gzip more** than the placeholder (142.8 KB today); search the `/rivales` chunks for `zod` and `contrastRatio` (must be absent). Record the numbers in the verification log.

### Group F: end to end (`tests/e2e/rivales.spec.ts`, iphone, android, desktop)

Seeding as in `onboarding.spec.ts` (`addInitScript` with the storage record). Screenshots go to `test-results/screens/{project}-rivales-*.png`.

- [x] **T23 Empty, loading and error.** No record: the empty state and its link to `/#elegi-tu-club` are visible with no skeleton flash after load (screenshot `-empty`). Record for `river-plate` with the data route held by `page.route` until released: skeleton visible with `aria-busy` (screenshot `-loading`), then content. Data route answering 500: error state (screenshot `-error`); unroute and click "Reintentar": content shows. JS chunks blocked: the server HTML shows the skeleton for a saved club and the empty state without one (pre-hydration CSS).
- [x] **T24 Ready state, filters and layouts.** Record for `river-plate`, `1990-05-20`: `h1` "River vs. todos" (club short name), the coverage notice with "Tu historial puede estar incompleto", the "Contamos:" line, **no text matching `/cobertura completa|historial completo/i` anywhere**; three summary cards whose counts add up to the number of rivals in the list; on iphone and android the list "Rivales" is visible and the table is not, on desktop the opposite (screenshots `-ready`, `-ready-full` full page). Type "Liga": the "Contamos" line has only Primera División and the counts are refreshed; years 2019 to 2019: the notice disappears but the "Todavía no cargamos …" line remains (the `isComplete: true` case); sort "Nombre": the first row is the alphabetically first rival by Spanish collation; "Limpiar filtros" restores. Belgrano from `2000-01-01`: the favorable section shows its empty line (screenshot `-belgrano`). Racing from `2025-06-01`: "Todavía no hay partidos para contar" plus the notice.
- [x] **T25 Privacy, accessibility and footer.** During T24's flow: every request URL, `postData()` and `document.cookie` is free of the four date spellings; the only data request is `GET /api/clubs/river-plate` with no query string; no `console` message contains them; `GET /api/clubs/not-a-club` answers 400 with `{"error":"unknown_club"}`. On iphone and android every filter control, summary card and section link is at least 44 x 44; on desktop, Tab from the skip link reaches the filters, then the summary links, each with a non-`none` outline; with `reducedMotion: "reduce"` the bar transition and skeleton animation durations are under 0.01 s. The existing `footer.spec.ts` and `layout.spec.ts` keep passing on `/rivales` with and without a saved club.

### Group G: close

- [x] **T26 Docs.** `docs/methodology.md`: `competitionIds` in "Rival grouping", the exact year-range rule under "Filter", and a "Rivals screen (UI)" note (sort orders, name collation, never a complete badge, notice whenever `isComplete` is false). ADR 0018 status after Diego's D1. Check that `/privacidad` still matches (it does: club and start date stay on the device; only the club id is requested). This plan: "Decisions recorded", verification log, `status: done`.

## Copy (Spanish, voseo; D9)

| Where                     | Text                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Page title (metadata)     | Rivales                                                                                                   |
| `h1` with club            | {short name} vs. todos                                                                                    |
| `h1` without club         | Tu club vs. todos                                                                                         |
| Sub-line                  | Desde {mes} de {año} · {n} partidos contra {m} rivales                                                    |
| Notice heading            | Tu historial puede estar incompleto                                                                       |
| Notice lead               | Estos números cuentan solo los partidos que tenemos cargados.                                             |
| Notice line, partial      | {competición}: tenemos todos los partidos de {mes} de {año} a {mes} de {año}.                             |
| Notice line, partial open | {competición}: tenemos todos los partidos desde {mes} de {año}.                                           |
| Notice line, missing      | {competición}: todavía no tenemos sus partidos completos en este período.                                 |
| What we count             | Contamos: {competiciones}.                                                                                |
| Cups not loaded           | Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas.                            |
| Filter labels             | Desde · Hasta · Torneo · Ordenar por                                                                      |
| Tournament options        | Todos · Liga · Copas nacionales · Internacionales · Otros                                                 |
| Sort options              | Saldo · Partidos · Nombre                                                                                 |
| Reset                     | Limpiar filtros                                                                                           |
| Live count                | Mostrando 1 rival · Mostrando {n} rivales                                                                 |
| Summary cards             | Historial favorable · Historial igualado · Historial desfavorable                                         |
| Summary count             | 1 rival · {n} rivales                                                                                     |
| Section favorable (D2)    | Los tenés de hijos                                                                                        |
| Section favorable line    | Desde que llegaste, contra estos la historia es tuya.                                                     |
| Section favorable empty   | Todavía no tenés hijos futboleros. Paciencia, que la tuya se sigue jugando.                               |
| Section even              | Historia pareja                                                                                           |
| Section even line         | Acá no se ríe nadie: un partido inclina la balanza.                                                       |
| Section even empty        | Acá no hay medias tintas: o los tenés de hijos o te tienen de hijo.                                       |
| Section unfavorable (D2)  | Te tienen de hijo                                                                                         |
| Section unfavorable line  | Duele, pero hay revancha: el próximo partido puede cambiarlo.                                             |
| Section unfavorable empty | Nadie te tiene de hijo. Mirá vos.                                                                         |
| List heading              | Todos los rivales                                                                                         |
| Table caption             | Tu historial contra cada rival ({competiciones})                                                          |
| Column headers            | Rival · PJ (Partidos jugados) · PG (Ganados) · PE (Empatados) · PP (Perdidos) · Saldo · Balance · Dominio |
| Chips                     | Dominás · Parejo · Te domina                                                                              |
| Card stat labels          | PJ · PG · PE · PP · Saldo                                                                                 |
| Marks                     | Incluye resultados administrativos · {n} por penales                                                      |
| Loading (screen reader)   | Cargando tu historial…                                                                                    |
| Empty, no club, title     | Todavía no elegiste tu club                                                                               |
| Empty, no club, text      | Elegí tu club y desde cuándo sos hincha, y te mostramos a quién tenés de hijo.                            |
| Empty, no club, button    | Elegí tu club                                                                                             |
| No matches, title         | Todavía no hay partidos para contar                                                                       |
| No matches, filtered      | Con estos filtros no hay partidos. Probá con otro rango o torneo.                                         |
| Error title               | Se nos cortó la transmisión                                                                               |
| Error text                | No pudimos cargar tu historial. Revisá tu conexión y probá de nuevo.                                      |
| Error buttons             | Reintentar · Volver al inicio                                                                             |

## Tests to write (summary)

- **Unit, domain (100% branches):** `rivals` (`competitionIds`), `period` (`narrowPeriod`), `club-data` (slice, merge).
- **Unit, lib (100% branches):** `engine-input`, `engine-input-server`, `club-data-server`, `club-data-client`, `rivals-view`, `coverage-copy`, extended `palette-contrast`.
- **Unit, app:** the route handler (`GET`, `generateStaticParams`, no logs), the page and `error.tsx`.
- **Component (jsdom):** chip, bar, summary, humor sections, card list, table, filters, coverage notice, states, `useFanChoice`, `RivalsScreen`.
- **Integration (real data):** slice equivalence for `groupRivals` and `headToHead`; per-club size guard.
- **E2E (390x844, 412x915, 1280x800):** `rivales.spec.ts` (T23 to T25) with screenshots; existing specs unchanged and green.
- **Edge cases:** no saved choice; storage blocked or throwing; saved club removed from the dataset; saved date invalid (boot script sets `data-club`, parse gives none: skeleton then empty state); start after the last loaded match (no rivals, notice `missing`); a club that left and came back (Belgrano: Copa de la Liga `missing`, a safe false warning); year range giving `isComplete: true` (no badge, cups line stays); filters leaving no matches; `from > to`; rival names with accents and apostrophes (Newell's, Colón, Vélez, Unión); balance 0 shown without sign; only one rival (singular copy); administrative results and shoot-outs marks; data request 400, 500, offline, invalid JSON, wrong version, wrong club; concurrent loads; route hidden by `<Activity>` and shown again; club changed on `/` while `/rivales` is mounted; Buenos Aires midnight for "today".

## Impact

- **Data:** none changed. `data/` is read at build time by a server-only module; no Supabase read, seed or migration. The slice keeps every record's `source`.
- **Design:** new components in `src/components/rivals/` and a shared `src/components/coverage/coverage-notice.tsx` (reused by vitrina and the detail). New text pairs (win, even, loss on their tints) join the palette contrast test. No new tokens, no new fonts, no `motion` on this screen.
- **Security and privacy:** the start date is read from `localStorage` and used only in memory; the only request is `GET /api/clubs/<clubId>` with no query and no body; filters are not in the URL; nothing is logged (spied in unit and component tests, watched in e2e). The sub-line shows the start month and year on the fan's own screen only, like the date field of the onboarding; it is never in a URL, a request, the page title or the document metadata. The route handler validates the id with Zod and never echoes it; the response is a static file, so there is no user-controlled server work besides the 400. CSP unchanged (`connect-src 'self'` covers the fetch).
- **Performance:** per club 3.4 to 8.2 KB gzip of data, cached by the CDN and in memory per session; engine 2.3 KB gzip; total client code for the screen capped at 20 KB gzip over the placeholder (T22). Computation under 1 ms per filter change. LCP is the static `h1` and skeleton, then the content after one small fetch. The numbers are not in the server HTML.
- **Coverage config:** no change (new files fall under the existing 100% thresholds for `src/domain` and `src/lib`).

## Risks and mitigation

- **The route handler is not prerendered** (for example because of an accidental request API). Mitigation: T9 checks `pnpm build` output; the handler only reads `params`.
- **Slice drift** (an engine function starts reading data the slice omits). Mitigation: the equivalence test T4 runs on every club and filter; new engine functions used by screens must be added to it.
- **Document growth with pre-2018 data** (estimated 130 KB gzip per club with today's shape). Mitigation: T5 size guard; ADR 0018 requires a compact encoding or a split before that data lands.
- **JS budget.** The framework already uses about 132 KB gzip of the 170 KB. Mitigation: T22 measures the delta and caps it at 20 KB; no new dependency; icons tree-shaken from `lucide-react`. The automated budget is #18.
- **Pre-hydration mismatch** (a saved record with a valid slug but an invalid date shows the skeleton, then the empty state). Accepted: rare, and nothing wrong is shown.
- **A false "all good" reading** when `isComplete` is true for a narrow range. Mitigation: no complete badge exists in the component (T18), the cups line is always shown, e2e T24 covers the 2019 case.
- **Copy or naming answers (D2 to D6, D9) change late.** Only constants and strings change; tests use the copy module.
- **Hidden tab behavior** (`<Activity>` keeps `/rivales` mounted). Mitigation: the loader cache is per club, the fan choice is a store subscription; T21 covers a club change.

## How to verify it is finished

- Every acceptance criterion maps to a passing test: summary, list, bar, chip, filters, sort, sections, cards and table (T11 to T17, T21, T24); partial-coverage notice (T13, T18, T24); skeleton, empty and error states (T19, T21, T23); footer, Spanish copy and design (T25, existing footer spec, D9); #43 parts: unknown club 400 (T7, T9, T25), no echo (T6, T7, T9), no log receives the date (T9, T21, T22, T25), engine called as before (T4).
- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/domain`, `src/data-model`, `src/lib`), `pnpm data:validate`, `pnpm build` (`/rivales` static, `/api/clubs/[clubId]` prerendered for 34 ids, client delta at most 20 KB gzip) and `pnpm e2e` on the three projects are green.
- Screenshots of the three projects (`-empty`, `-loading`, `-error`, `-ready`, `-ready-full`, `-belgrano`) attached to the PR.
- ADR 0018 accepted with D1, the answers to D2 to D9 recorded here, the methodology updated.

## Second slice (outline only): rivalry detail `/rivales/[rival]`

To be planned in its own plan once this slice is merged (D8).

- **Route:** `src/app/rivales/[rival]/page.tsx`, static shell per rival: `generateStaticParams` returns the 34 club ids (at least one param is required under Cache Components); the page validates `rival` against the catalog and calls `notFound()` otherwise. The rival id in the URL is not private. The cards and table rows of this slice become links to it.
- **Data:** the client loads two documents, the fan's club and the rival (`loadClubData` twice, both cached), merges them with `statsDataFromClubData`, and runs `headToHead(index, clubId, rivalId, narrowedPeriod, filter)`. The merge is needed because the head-to-head coverage notice merges both clubs' rows; T4 already proves it equals the full dataset.
- **Validation (#43):** `parseRivalId(rival, clubId, knownIds)` before the engine: an unknown rival is a 404 page; the rival equal to the fan's club shows a friendly state ("Ese es tu club. Elegí un rival.") and the engine is not called (it would throw `RangeError`).
- **Content (section 5.4):** record in the period with the chip and bar; last match (date, competition, score, shoot-out note); current streak and best win streak; biggest win and biggest loss (played matches only); finals between both (`finals`, with the winner and the note that legs outside the period can be shown); "Lo que está en juego" from `atStake` ("Con {n} triunfos más pasás a dominar este historial", "Estás a {n} victoria(s) de las {milestone} contra este rival desde que arrancaste"); the coverage notice from `headToHead.coverage` and the "Contamos" line from `competitionIds`; the same states as this slice.
- **Open questions for that plan:** whether the year and type filters exist on the detail; the copy of the stakes and streak messages; whether a classic (`rivalry.name`) gets a special header once `rivalries.json` exists.

## Decisions recorded

Diego answered on 2026-10-17, all with the recommended options:

- **D1:** compute in the browser on per-club documents; the stats screens do not read Supabase in the MVP (ADR 0018, accepted).
- **D2:** the humor sections are "Los tenés de hijos", "Historia pareja" and "Te tienen de hijo".
- **D3 to D9:** top three of each group above the full list; years only where there are loaded matches; tournament types only the ones present; sort by Saldo by default; #43 stays open until #16 uses `startDateSchema`; #15 split into #65 (this screen), #66 (rivalry detail) and #67 (vitrina); the Spanish copy of the plan approved.

Deviations from the plan, all small:

- **T20:** `useFanChoice` was added and is used by `/rivales`; `onboarding.tsx` was left on its own reading of the storage to keep this PR focused (its tests are untouched).
- **Chip tint:** 5% instead of the 12% the plan assumed. At 12% the text of "Parejo" fell to 4.20:1 and "Te domina" to 4.06:1 over the glass on the glow; at 5% the three chips reach at least 4.5:1 on every surface (palette contrast test).
- **Copy test of T18:** the missing-coverage line says "completos" ("todavía no tenemos sus partidos completos"), so the guard checks for "historial completo" and "cobertura completa", not for the word "completo".
- **`competitionsLabel`** was added to the view model for the table caption.
- **Rival names** use the short name in the list and sort (the one on screen).

## Verification log

Measured on 2026-10-17 with `pnpm build`:

| Measure                                                                                       | Value                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Route list                                                                                    | `/rivales` static; `/api/clubs/[clubId]` prerendered (SSG) for the 34 clubs |
| Largest club document (Rosario Central)                                                       | 98,463 B raw, 8,258 B gzip                                                  |
| Module scripts of `/rivales` (gzip, `noModule` chunk excluded)                                | 150.6 KB (the placeholder had 142.8 KB, so +7.8 KB; budget 170 KB)          |
| Zod or contrast code in the `/rivales` chunks                                                 | none                                                                        |
| Slice equivalence (34 clubs, 6 start dates, 4 filters, narrowed range, 10 head-to-head pairs) | 45 tests, all equal to the full dataset                                     |
| Dominance chip contrast (5% tint, glass and glow)                                             | at least 4.5:1 for win, even and loss                                       |

The `Cache-Control` of the prerendered documents is added by the host (Vercel); the local build only records the cache tags. It must be checked on the preview (`curl -I`) before merging.
