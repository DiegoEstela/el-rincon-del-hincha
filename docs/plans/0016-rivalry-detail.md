---
issue: 66
status: pending
date: 2026-10-17
---

# Plan 0016: rivalry detail (`/rivales/[rival]`)

Related issues: #66 (this plan), #15 (MVP screens, parent), #65 (the Rivales screen, plan 0015, done), #43 (input validation before the engine), #18 (budgets), #67 (vitrina, out of scope). Related ADRs: [0003](../adr/0003-data-sources.md) (coverage), [0007](../adr/0007-visual-identity-lawn-neon.md) (tokens, shell, AA), [0010](../adr/0010-stats-engine-in-typescript.md) (engine), [0011](../adr/0011-match-date-precision.md) (match dates), [0013](../adr/0013-club-theming-and-onboarding-storage.md) (storage, start date privacy), [0014](../adr/0014-security-headers-policy.md) (CSP), [0018](../adr/0018-stats-screens-compute-in-the-browser.md) (compute in the browser; two documents for a head-to-head), [0019](../adr/0019-static-routes-for-public-ids.md) (**new, this plan**: static dynamic segments for public ids).

This is the second slice of plan 0015 ("Second slice (outline only)"). It reuses everything that slice built and only adds what section 5.4 of the master prompt needs.

## Goal

Build `/rivales/[rival]`: the history of the fan's club against one rival over the fan's period. The record with the bar and dominance chip, the last match, the current streak and the best win streak, the biggest win and the biggest loss, the finals between both clubs, and "Lo que está en juego" ("Con 2 triunfos más pasás a dominar este historial", "Estás a 1 victoria de las 30 contra este rival desde que naciste"). It also has the coverage notice, the skeleton, the empty and error states, a friendly state when the rival is the fan's own club, and a friendly 404 for an unknown rival id. The cards, table rows and humor-section rows of `/rivales` become links to it.

## Acceptance criteria (copied from issue #66)

- Given a saved club and a rival, when the page opens, then the record, last match, streak, biggest win and loss and the finals between both clubs are shown.
- Given the record, when it is close to a threshold, then the "what is at stake" line says how many wins change the dominance or reach a round number.
- Given the same club as rival, when opened, then a friendly message is shown and the engine is not called.
- Given partial coverage, then the same rules as the Rivales screen apply (notice, no complete badge, privacy of the start date).

Out of scope (from the issue): the vitrina. Also out of scope here: compare (#16), share images and analytics (Fase 4), count-up animations (Fase 5), a special header for classics (no `rivalries.json` yet; see "Risks"), Lighthouse and the automated JS budget (#18).

Hard constraints given for this plan (same as plan 0015):

- The fan start date never appears in a URL, request, log, cookie, error or analytics event. The rival id in the URL is fine: it is a public club id.
- Compute in the browser on the two per-club documents (ADR 0018).
- 170 KB gzip of JS per route; the route stays static (`generateStaticParams` for the 34 clubs).
- The engine stays pure with 100% branch coverage in `src/domain`, `src/data-model` and `src/lib`.
- No "complete" badge anywhere while plan 0014 Phase 2 (cups not loaded) is open; the coverage notice shows whenever `isComplete` is false; every number says which competitions it includes.
- Copy in Rioplatense Spanish with voseo and healthy football humor; no betting, no violence.
- Mobile first (390x844, 412x915) plus the desktop sidebar layout; 44 px targets; WCAG 2.2 AA; reduced motion; skeleton, empty and error states; the footer with version and credits.

## What exists today (and is reused)

- **Engine.** `headToHead(index, clubId, rivalId, period, filter)` (`src/domain/head-to-head.ts`) already returns everything section 5.4 needs: `record`, `dominance`, `lastMatch`, `currentStreak`, `bestWinStreak`, `biggestWin`, `biggestLoss` (played matches only), `finals` (`FinalSeries[]` with `legs` and `winner`), `competitionIds`, `rivalry`, `atStake` (`whatIsAtStake`: `winsToImprove`/`improvesTo`, `lossesToWorsen`/`worsensTo`, `nextWinMilestone`) and `coverage` (the rows of **both** clubs merged). It throws `RangeError` when both ids are equal. `computeStreaks` gives the current run of identical results and the best win run.
- **Data contract.** `sliceClubData` and `statsDataFromClubData(...docs)` (`src/domain/club-data.ts`). `tests/integration/club-data-equivalence.test.ts` already proves `headToHead` on two merged slices equals the full dataset for 10 pairs and 6 start dates, with no filter.
- **Delivery.** `GET /api/clubs/[clubId]` prerendered for the 34 clubs; `loadClubData(clubId)` (`src/lib/club-data-client.ts`) with a per-club promise cache, so the fan's own document is usually already in memory when the fan arrives from `/rivales`.
- **Validation.** `parseRivalId(raw, { clubId, clubIds })` (`src/lib/engine-input.ts`) returns `unknown_club` or `same_club`; `clubIdSchema` and `clubPairSchema` (`src/lib/engine-input.server.ts`).
- **UI.** `useFanChoice` (server snapshot `"unknown"`), the pending CSS (`html[data-club] .pending-empty`, `html:not([data-club]) .pending-skeleton`), `CoverageNotice` (no complete state exists), `coverageCopy`, `includedLine`, `formatMonthYear` (own month table), `DominanceChip`, `RecordBar`, `RivalsSkeleton`, `RivalsEmpty`, `RivalsError`, `src/app/rivales/error.tsx` (it also wraps the nested segment), `formatBalance`.
- **Nav.** `isActiveRoute` already marks "Rivales" active on `/rivales/*`.

### Real data (computed on 2026-10-17 from `data/matches.json`, start `1990-05-20`)

| Pair                                       | Played | W-D-L | Balance | What the screen must show                                                                                                                                                                                 |
| ------------------------------------------ | ------ | ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| River v Boca                               | 8      | 5-2-1 | +4      | Dominás; last 2025-04-27 River 2-1 Boca (Primera); current run 3 wins; best win run 3; biggest win 2018-09-23 Boca 0-2 River; biggest loss 2022-09-11 Boca 1-0 River; no finals; 3 losses to fall to even |
| Boca v Banfield                            | 8      | 4-2-2 | +2      | The only final of the dataset: 2021-01-17, Copa Diego Armando Maradona 2020, 1-1 and Boca won 5-3 on penalties (counted as a draw in W-D-L, as a won final)                                               |
| Belgrano v Talleres (start `2000-01-01`)   | 4      | 0-3-1 | -1      | Parejo; never won; 3 wins to dominate, 1 loss to be dominated; last three are draws after a loss                                                                                                          |
| River v San Martín de Tucumán              | 1      | 1-0-0 | +1      | Singular copy everywhere ("1 partido", "1 triunfo")                                                                                                                                                       |
| Aldosivi v Deportivo Riestra (and 20 more) | 0      | -     | -       | Never met in the loaded data: the "todavía no se cruzaron" state                                                                                                                                          |

All matches today are `played` with day precision; there is one final (`is_final`) in the dataset.

## Approach

### Route and static shell (ADR 0019)

- `src/app/rivales/[rival]/page.tsx`, a Server Component:
  - `generateStaticParams()` returns `CLUB_IDS.map((rival) => ({ rival }))` (34 params; under Cache Components at least one is required, and `dynamicParams` is not available).
  - The page awaits `params`, validates `rival` with `clubIdSchema` (server, Zod, issue #43) and calls `notFound()` when it fails. The not-found UI never echoes the id.
  - It renders `<RivalryScreen clubs={CLUB_OPTIONS} rival={option} />`: the rival is public and known at build time, so its crest and name are in the static HTML (good LCP, real content for the shell). The fan's club is not known on the server, so everything that depends on it happens in the browser.
  - `export const ensureStatic = "navigation"` (Next 16.4, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md`): the build fails if anyone adds `cookies()`, `headers()`, `searchParams` or uncached data to this route, and an unknown param waits for the complete render instead of streaming a 200 App Shell, so `notFound()` can answer a real 404. **Task T1 verifies this behavior on a production build before anything else is built on it**; if the 404 status cannot be obtained, the fallback is a soft 404 (200 with `noindex` and the same friendly UI), recorded in ADR 0019.
  - `generateMetadata({ params })` returns `title: "{rival name} · Rivales"` (template adds " · Rincón del Hincha"), a generic description, and `robots: { index: false, follow: true }` (D7). It never includes the fan's club (unknown on the server) or anything derived from the start date.
- `src/app/rivales/[rival]/not-found.tsx`: friendly 404 with a link to `/rivales` (and the footer from the root layout).
- `src/app/rivales/error.tsx` already wraps this segment; it is reused unchanged.

Why not the alternatives: see "Discarded alternatives".

### Client flow

1. `RivalryScreen` (client) reads the choice with `useFanChoice`. `"unknown"` renders the pending block (skeleton plus empty state, chosen by the existing global CSS rules). `null` renders the empty state ("Todavía no elegiste tu club").
2. With a choice, **before any load or engine call**, `parseRivalId(rival.id, { clubId, clubIds })`:
   - `same_club` renders the friendly "es tu club" state. The loader and the engine are not called (unit test with spies).
   - `unknown_club` cannot happen (the server already returned 404) but renders the same not-found card, so the branch is total.
3. `useClubDocuments([clubId, rivalId])` (new hook, `src/components/fan/use-club-documents.ts`) loads both documents with `loadClubData` (both cached; the fan's own is usually already in memory). States: loading, error (either document fails; "Reintentar" retries only the failed ones because the loader evicts failed promises), ready with both documents. The result is reset only when the pair of ids changes, not when the route is hidden by `<Activity>` (see "Back navigation").
4. `buildRivalryView(input)` (`src/lib/rivalry-view.ts`, pure) builds the index from `statsDataFromClubData(clubDoc, rivalDoc)` (memoized per pair by the caller), computes `fanPeriod(startDate, now)` and calls `headToHead(index, clubId, rivalId, period)` once, then shapes the screen model with the copy helpers of `src/lib/rivalry-copy.ts`. `now` is taken in the client after mount.
5. Nothing is requested besides `GET /api/clubs/<clubId>` and `GET /api/clubs/<rivalId>` (no query, no body). No `console` call.

### How the partial coverage of both clubs is merged

The browser merges the two documents with `statsDataFromClubData(clubDoc, rivalDoc)` (dedupes matches by id, coverage by `(club_id, competition_id, from)`). `headToHead` then builds the notice from the coverage rows of **both** clubs (`coverageNotice(index, [clubId, rivalId], …)`): complete coverage of either club contains every meeting, so a competition is complete for the pair if one stretch of either club covers the period, and it is listed if either club has rows or matches in it (methodology, "Coverage notice"). That is why the rival's document is loaded even though every meeting is also in the fan's own document. The equivalence test (T3) proves that the merged slices give the same `HeadToHead` as the full dataset for every ordered pair.

The screen then applies the plan 0015 rules unchanged: `CoverageNotice` shows the note whenever `isComplete` is false (and the period is not empty), the "Contamos: …" line always lists `headToHead.competitionIds`, the "Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas." line always shows, and no complete badge exists. For a pair that never met, `competitionIds` is empty, so the included line uses a pair-specific variant ("Todavía no se cruzaron en los torneos que tenemos cargados.") instead of "Todavía no hay partidos cargados para este período." (which would be false: the fan's club does have matches).

### Engine additions (small, pure, tests first)

- **Unbeaten and winless runs (D3).** `computeStreaks` also returns `unbeaten` (the run without a loss ending at the latest match; `null` when the latest is a loss) and `winless` (the run without a win ending at the latest match; `null` when the latest is a win), each `{ length, from, to }`. `HeadToHead` exposes them as `currentUnbeaten` and `currentWinless`. The prompt's example "Venís de 3 sin perder" needs this; the current streak alone (identical results) cannot say it. Methodology gets the rule.
- No other engine change: `whatIsAtStake` already gives the numbers; the "near" threshold and the sentences are UI rules (methodology "Notes for the UI").

### View model and copy (`src/lib`, pure, 100% branches)

`buildRivalryView(input) -> RivalryView`:

```ts
type RivalryViewInput = Readonly<{
  index: StatsIndex;
  clubId: string;
  rivalId: string;
  startDate: string;
  startMode: "birth" | "other";
  now: Date;
  catalog: ReadonlyMap<string, ClubOption>;
  competitionNames: ReadonlyMap<string, string>;
  seasonNames: ReadonlyMap<string, string>;
}>;
```

It returns: `title` ("River vs. Boca"), `since` (month and year only), `matchesLine`, `record` (numbers, bar shares, balance text, dominance, goals, administrative and shoot-out marks), `stakes: string[]`, `lastMatch: MatchCardView | null`, `streak: { headline: string | null; best: string }`, `biggestWin`/`biggestLoss: MatchCardView | null` plus their empty lines, `finals: FinalView[]` plus the empty line, `included`, `coverage: CoverageCopy`, `neverMet: boolean`. A `MatchCardView` has `date` ("27 de abril de 2025"), `competition` ("Primera División · Liga Profesional 2025"), `home`/`away` (short name, goals, `isFan`), `result` ("Ganaste" / "Empataste" / "Perdiste"), `note` (penalties or administrative, or `null`).

**The view never returns the start date**: only `since` (month and year, as on `/rivales`, ADR 0018 note). Match dates are public facts and are shown in full. A property test feeds 50 random start dates that are not match dates and checks that no string in the view contains any spelling of them.

`src/lib/rivalry-copy.ts` holds every Spanish sentence of this screen (see "Copy"), with `formatMatchDate` built on the month table of `coverage-copy.ts` (exported, no `Intl`).

### "Lo que está en juego" rules (D2)

With `STAKE_NEAR = 3` (constant in `rivalry-copy.ts`, documented in the methodology), for a pair with at least one counted match:

1. **Dominance line, always one.** If `winsToImprove` is not null: "pasás a dominar" (to `dominates`) or "emparejás" (to `even`). If it is null (the fan dominates): the "colchón" line with `lossesToWorsen`.
2. **Warning line** only when the dominance is `even` and `lossesToWorsen <= STAKE_NEAR`: "te pasan a dominar".
3. **Milestone line** only when `nextWinMilestone.winsNeeded <= STAKE_NEAR` and the fan has won at least once.
4. **First win line** when `won === 0`: replaces the milestone ("Todavía no le ganaste …").
5. The ending of lines 3 and 4 depends on `startMode`: "desde que naciste" (`birth`) or "desde que sos hincha" (`other`). It says nothing else about the date.

No line for a pair that never met (the section is replaced by the never-met card). Examples from the real data: River v Boca gives "Tenés colchón: harían falta 3 derrotas más para que esto vuelva a estar parejo."; Belgrano v Talleres gives "Con 3 triunfos más pasás a dominar este historial.", "Ojo: con 1 derrota más te pasan a dominar." and "Todavía no le ganaste desde que sos hincha. El primero se va a gritar el doble."

### Streak rules (D3)

- **Headline:** the longest of the current identical run, the unbeaten run and the winless run; ties prefer the identical run, then unbeaten. A run of length 1 of identical results reads "Ganaste el último" / "Empataste el último" / "Perdiste el último". Belgrano v Talleres (L D D D) gives "Venís de 4 partidos sin ganarle."; River v Boca gives "Venís de 3 triunfos seguidos.".
- **Best win streak:** "Tu mejor racha: {n} triunfos seguidos, de {mes} de {año} a {mes} de {año}." (from and to are match dates), "Tu mejor racha: 1 triunfo. Todavía no le ganaste dos seguidos.", or, with no win, "Todavía no le ganaste en tu período."
- Runs are counted inside the fan period only (a run that started before the start date is cut there); the methodology says so.

### Screen design (mobile first, "Césped y neón")

Order on the page, the same on every viewport (D8):

1. **Back link** "Rivales" with an arrow-left icon (`next/link` to `/rivales`, 44 px tall, accessible name "Volver a Rivales").
2. **Header.** Two crests facing each other (fan's club, a small "vs." in `font-display`, the rival), `h1` "{club short} vs. {rival short}" (before the choice is known: "Tu club vs. {rival short}"). Sub-line: "Desde {mes} de {año} · {n} partido(s)". Crests are decorative (`aria-hidden`); the text is the name.
3. **Coverage notice** (`CoverageNotice`, unchanged) with the "Contamos" and the cups lines.
4. **El historial** (`h2`, glass card): four big numbers PJ, PG, PE, PP with labels, "Saldo +4", the `DominanceChip`, the `RecordBar`, "Goles: 10 a 5" (River v Boca), and the marks "Incluye resultados administrativos" and "{n} por penales" when they apply.
5. **Lo que está en juego** (`h2`, card with the accent border): one to three lines (rules above), each with an icon (target, alert, flag) that is decorative.
6. **El último partido** (`h2`): a `MatchCard` with the date, the competition and season, the score as "{home} {g} - {g} {away}" with the fan's side in bold, a result pill ("Ganaste" in `--win`, "Empataste" in `--even`, "Perdiste" in `--loss`, text plus icon) and the penalties or administrative note.
7. **Rachas** (`h2`): the headline and the best win streak.
8. **Goleadas** (`h2`): two `MatchCard`s, "La mejor" and "La que más dolió" (`h3`), each with its empty line.
9. **Finales entre ustedes** (`h2`): one item per series: season name, the winner line ("Ganaste la final" / "Perdiste la final" / "Final sin ganador en nuestros datos"), each leg as a compact score row with its date, the penalties note, and "(antes de tu período)" on legs dated before the period start (methodology: a series belongs to the period by its last leg). When empty: the empty line (D9). Below, a muted line: "Contamos solo las finales de los torneos que tenemos cargados."

Layout: on phones a single column; from `lg` (desktop with the sidebar) a two-column grid: left column record and stakes, right column last match and streaks; goleadas as two columns; finals full width. Everything uses existing tokens and the glass cards; no new tokens or fonts.

**States.**

- Pending (server HTML and hydration): `pending-skeleton` (the detail skeleton) and `pending-empty` (empty state), chosen by the existing CSS. The rival's crest and the `h1` "Tu club vs. {rival}" are in the static HTML in both.
- Loading: `RivalrySkeleton` with the same layout (header, notice, record, stakes, two cards), `aria-busy="true"`, hidden "Cargando el mano a mano…", `motion-safe:animate-pulse`.
- No club saved: `RivalsEmpty` (reused).
- Same club: a glass card (`h1` "Ese es tu club") with "No podés jugar contra vos mismo… bueno, en los entrenamientos sí. Elegí un rival." and a link button "Ver tus rivales" to `/rivales`. No load, no engine.
- Never met in the period: the header, the notice and a card "Todavía no se cruzaron" with "En tu período no hay partidos cargados entre {club} y {rival}." and the link back.
- Error (either document): `RivalsError` (reused copy and "Reintentar").
- Unknown id: `not-found.tsx`, "Ese rival no está en nuestro fixture" with "Fijate que el link esté bien, o elegí uno de tu lista." and "Ver tus rivales".

**Accessibility.** One `h1`; an `h2` per block, `h3` inside goleadas; scores read in a natural order (a visually hidden sentence "River 2, Boca 1" next to the visual score, which is `aria-hidden`); the result pills and chips use text plus icon (never color alone); targets 44 x 44 px; focus ring on links; numbers 4.5:1 (the pill colors join the palette contrast test like the chips did, 5% tint); reduced motion turns off the bar growth and the skeleton pulse (existing rules).

### Links from `/rivales` (D6)

- **Mobile card:** the short name becomes a `next/link` to `/rivales/<id>` with the "stretched link" pattern: the card is `relative`, the link has an `after:absolute after:inset-0` pseudo-element, so the whole card is the target while the DOM keeps one link per card. Accessible name: "{short name}, ver el mano a mano" (visible name first, WCAG 2.5.3 label in name; the suffix is visually hidden). A chevron icon at the right shows the affordance. Focus ring on the card through `has-[:focus-visible]:outline` (or the pseudo-element). The chip and the bar stay non-interactive.
- **Desktop table:** the link is in the "Rival" cell only (crest and name), padded to the full cell height of 48 px. No click handler on `<tr>` (not keyboard accessible, and a stretched link inside a table row is unreliable across browsers).
- **Humor sections:** each of the top three rows is a link too (same pattern as the card).
- Default `next/link` prefetch: the detail is a static shell, so prefetching visible links costs small static payloads from the CDN.

### Back navigation and the filters

- The back link is a plain `<Link href="/rivales">`. With Cache Components, Next keeps up to 3 recent routes hidden with React `<Activity>` and restores their state on any navigation back (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`), so the filters and the sort of `/rivales` survive "list, detail, back".
- **Bug to fix first (found while planning):** `RivalsScreen`'s effect cleanup calls `setLoad(null)` (the review fix of plan 0015). When `<Activity>` hides the route the cleanup runs, the screen falls back to the skeleton, `RivalsContent` unmounts, and the filters are lost on return. The fix (T11): reset the result only when the club id changes, not on cleanup, inside the new `useClubDocuments` hook, which `RivalsScreen` also adopts. A component test renders the screen inside `<Activity mode="hidden">` and back to `"visible"` and asserts the filters and the content stay, and the plan 0015 stale-error test stays green.
- After more than 3 other routes the oldest is evicted and the filters reset; that matches plan 0015 ("filters live in state and reset on reload") and is accepted.
- The detail itself has **no filters** (D1): it always shows the whole fan period and every loaded competition, and says so ("Contamos: …"). A filter there would make "Lo que está en juego" and "desde que naciste" ambiguous.

### SEO and metadata

- Title "{rival name} · Rivales · Rincón del Hincha"; generic description "Tu historial contra {rival name} desde que sos hincha: último partido, rachas, goleadas y finales."; `robots: noindex, follow` (D7): the 34 shells have no personal content and would be thin duplicates. The title never has the fan's club and the document title is not changed on the client.
- The not-found page gets Next's own `noindex` meta.
- No Open Graph image for this route (share is Fase 4).

### Input validation (issue #43)

| Input                        | Where             | Check                                                                                              |
| ---------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `rival` route param          | server, page      | `clubIdSchema.safeParse`; failure is `notFound()`; the id is never echoed                          |
| Rival against the fan's club | client            | `parseRivalId` before any load: `same_club` gives the friendly state, engine and loader not called |
| Fan club and start date      | `localStorage`    | `parseFanChoice` (existing), through `useFanChoice`                                                |
| The two documents            | `/api/clubs/<id>` | `isClubData(value, id)` (existing), per document                                                   |

Refs #43 (it stays open until #16 uses `startDateSchema`, decision D7 of plan 0015).

### Discarded alternatives

- **Rival in a query (`/rivales/detalle?rival=boca-juniors`):** `searchParams` makes the route dynamic on the server, and the URL is less shareable. Rejected.
- **A client-only page validating `useParams()`** (no server check): unknown ids would get a 200 with a client message, crawlable as soft 404s, and the rival name would not be in the static HTML. Rejected.
- **Validating the rival only with a proxy (middleware):** a proxy runs on every request and the shell's config deliberately has none ("plain header rules, no proxy"). Rejected.
- **Prerendering per pair (34 x 33 = 1,122 pages with the numbers):** the numbers depend on the start date, so they cannot be prerendered; the shell per rival is enough.
- **Computing the head-to-head from the fan's document alone:** every meeting is in it, but the coverage notice would miss the rival's rows and could show a false "missing" when the rival's coverage is complete. ADR 0018 already chose two documents.
- **Year and tournament filters on the detail:** see D1.
- **An in-memory store (or `sessionStorage`) for the `/rivales` filters:** Activity already preserves them; a store adds code and a second source of truth. Revisit if the 3-route eviction bothers users.
- **Whole card as one `<a>` wrapping everything:** the accessible name would be the whole card text ("Boca PJ 8 PG 5 …"). The stretched link keeps a short name.
- **Hiding "Lo que está en juego" unless something is near:** the acceptance criterion only requires the near cases; the always-present dominance line gives the section a reason to exist on every pair.

## Decisions for Diego (NEEDS DIEGO)

Every task except the copy strings is independent of these answers; each answer changes constants or copy only. One line each.

- **D1. Filters on the detail.** No year or tournament filters on the detail: always the whole fan period and every loaded competition (the `/rivales` filters stay on `/rivales`)? **Recommended: yes.**
- **D2. "Lo que está en juego" rules.** Always one dominance line; the "te pasan a dominar" warning and the milestone line only when 3 or fewer results away (`STAKE_NEAR = 3`); a "todavía no le ganaste" line when there are no wins? **Recommended: yes.**
- **D3. Streak headline.** Add the unbeaten and winless runs to the engine and show the longest of identical, unbeaten and winless ("Venís de 4 sin perder")? **Recommended: yes.**
- **D4. "Desde que naciste".** Say "desde que naciste" when the fan chose the birth date and "desde que sos hincha" otherwise? **Recommended: yes.**
- **D5. Unknown rival and same club.** Unknown id: real 404 with a friendly page; same club: friendly "Ese es tu club" state in the browser (the server cannot know the fan's club)? **Recommended: yes.**
- **D6. Links.** Whole card clickable through the name link (stretched link), the name cell on the desktop table, and the humor-section rows? **Recommended: yes.**
- **D7. Indexing.** `noindex, follow` on the 34 detail shells? **Recommended: yes.**
- **D8. Order.** Header, notice, record, what is at stake, last match, streaks, goleadas, finals? **Recommended: yes.**
- **D9. Finals with none.** Keep the "Finales entre ustedes" section with a humor empty line instead of hiding it? **Recommended: keep it.**
- **D10. Copy.** Approve the Spanish strings in "Copy" below (tunable on the preview)? **Recommended: approve.**

## Tasks

Test first in every task: write the failing test, then the code. One hour or less each. `pnpm test` before checking a task off; `pnpm test:coverage` keeps 100% branches in `src/domain`, `src/data-model` and `src/lib`.

### Group A: route spike and engine

- [ ] **T1 Static segment spike.** Read `dynamic-routes.md` ("With Cache Components"), `generate-static-params.md`, `ensureStatic.md`, `not-found.md` (file convention and function) and `incremental-static-regeneration-cache-components.md` in `node_modules/next/dist/docs/01-app`. Write `tests/unit/app/rivalry-page.test.tsx` cases for `generateStaticParams` (34 params) and for an unknown id calling `notFound` (mocked `next/navigation`). Add a minimal page (static text plus the rival name), `not-found.tsx` and `ensureStatic = "navigation"`. Run `pnpm build` and `pnpm start`: the route list shows `/rivales/[rival]` prerendered for 34 paths; `curl -sI /rivales/boca-juniors` is 200; `curl -sI /rivales/not-a-club` and `/rivales/..%2Fapi` are 404 with `noindex` in the body; a second request to an unknown id is still 404 and creates no file under `.next/server/app/rivales/`. Record the results in the verification log and in ADR 0019; if the status is 200, switch ADR 0019 to the soft 404 fallback and tell Diego.
- [ ] **T2 Unbeaten and winless runs (D3).** In `tests/unit/domain/streaks.test.ts`: `W D W` gives unbeaten 3 and winless `null`; `L D D` gives winless 3 and unbeaten 2; `W L` gives unbeaten `null`, winless 1; a shoot-out (draw) extends both; empty input gives `null` for both; `from` and `to` are the match dates. In `head-to-head.test.ts`: `currentUnbeaten` and `currentWinless` are passed through. Then `computeStreaks`, `HeadToHead` and the methodology "Streaks" bullet.
- [ ] **T3 Equivalence on real data, extended.** In `tests/integration/club-data-equivalence.test.ts`: `headToHead` on two merged slices deep-equals the full dataset for **every ordered pair** of the 34 clubs (1,122) with start `1990-05-20`; and for the 10 fixed pairs with every start, every filter of `FILTERS` and the 2019-only narrowed period. Also `buildRivalryView` on merged slices equals the view built on the full dataset for River v Boca, Boca v Banfield and Belgrano v Talleres (after T9). Fixed `now`. Keep the test under 10 s (record the time).
- [ ] **T4 Golden values on real data.** `tests/integration/rivalry-golden.test.ts` on the full dataset with `now = 2026-10-17T12:00:00Z`: River v Boca from `1990-05-20` (8 played, 5-2-1, goals 10 to 5, +4, `dominates`, last `2025-04-27-river-plate-boca-juniors`, current W 3 from `2023-05-07`, best win 3, biggest win `2018-09-23-boca-juniors-river-plate`, biggest loss `2022-09-11-boca-juniors-river-plate`, no finals, `lossesToWorsen` 3, milestone 10 needs 5); Boca v Banfield (one final, `winner: "club"`, shoot-out counted as a draw); Belgrano v Talleres from `2000-01-01` (0-3-1, `winsToImprove` 3, `lossesToWorsen` 1, winless 4); River v San Martín de Tucumán (1-0-0); Aldosivi v Deportivo Riestra (0 played, empty everything, notice not complete). The data auditor recomputes these independently.

### Group B: copy and view model (`src/lib`, pure, 100% branches)

- [ ] **T5 Dates and scores.** `tests/unit/lib/rivalry-copy.test.ts`: `formatMatchDate("2025-04-27")` is "27 de abril de 2025" and `"2021-01-01"` is "1 de enero de 2021" (no leading zero, no `Intl`); `scoreText` for home and away; `resultLabel` for W, D, L; `penaltiesNote` ("Ganaste 5 a 3 por penales" / "Perdiste 3 a 4 por penales"); `administrativeNote`. Export the month table from `coverage-copy.ts` (its tests stay green). Then the functions.
- [ ] **T6 Stake lines (D2, D4).** Same file: every row of the stake table in "Copy" with singular and plural (n = 1 and n = 2), `dominates` with the cushion, `even` with and without the warning (2 and 3 and 4 losses away), `dominated` to even, milestone shown at 1, 2, 3 wins needed and hidden at 4, hidden with 0 wins, the first-win line for `birth` and `other`, the boundary at exactly `STAKE_NEAR`, no lines for 0 played, at most 3 lines. No output contains digits that are not the counts (a regex check against the date fixtures).
- [ ] **T7 Streak lines (D3).** Same file: headline for W, D, L runs of 1 and of 3; unbeaten longer than the identical run ("Venís de 4 sin perder"); winless longer ("Venís de 4 partidos sin ganarle"); ties prefer identical, then unbeaten; no matches gives `null`; best win streak with 1, with 3 (months from match dates), and none.
- [ ] **T8 Finals and match cards.** Same file: `finalLine` for `club`, `rival` and `null` winners, a one-leg final with penalties, a two-leg final (aggregate), a leg before the period start marked "(antes de tu período)"; `competitionLabel(competition, season)` joins with " · " and avoids repeating when the season name equals the competition name; the empty lines of goleadas and finals.
- [ ] **T9 View model, part 1.** `tests/unit/lib/rivalry-view.test.ts` on the synthetic `stats-world` fixture (two merged slices): `title`, `since` (month and year), `matchesLine` singular and plural, record numbers, bar shares sum to 1, balance text, marks, `included` with the pair variant when the pair never met, `coverage` from `headToHead.coverage`, `neverMet`, empty period (future start) shows no notice and no stakes. Then the first half of `src/lib/rivalry-view.ts`.
- [ ] **T10 View model, part 2, and privacy.** Same file: `lastMatch`, `streak`, `biggestWin`/`biggestLoss` (an administrative win never qualifies), `finals`, `stakes` wired to T6 to T8; a catalog miss falls back to the id; property test: for 50 random start dates that are not match dates, `JSON.stringify(view)` contains none of the four spellings of the date. Then the rest of the module.

### Group C: components (Testing Library, jsdom)

- [ ] **T11 `useClubDocuments` and the Activity fix.** `tests/unit/components/use-club-documents.test.tsx`: one id and two ids; both cached (one request each); either failing gives `error`; retry reloads only the failed one; changing the ids resets the result; unmount or hidden does not reset it. `rivals-screen.test.tsx`: new case rendering inside `<Activity mode="hidden">` then `"visible"` keeps the type filter and the content (no skeleton flash); the existing stale-error test stays green unchanged. Then the hook and `RivalsScreen` on it.
- [ ] **T12 Links on `/rivales` (D6).** `list-and-table.test.tsx` and `summary-and-sections.test.tsx`: each card has one link named "{short name}, ver el mano a mano" to `/rivales/<id>`, with the stretched-link classes and a focus style; the table's Rival cell has the link and the row has no click handler; the humor rows are links; chips are still not focusable. Then the components.
- [ ] **T13 Header, back link and record panel.** `rivalry-header.test.tsx`: back link to `/rivales` named "Volver a Rivales", 44 px classes; two decorative crests; `h1` text; sub-line. `record-panel.test.tsx`: the four numbers with labels, balance with sign, chip, bar, goals, marks. Then `src/components/rivalry/rivalry-header.tsx` and `record-panel.tsx`.
- [ ] **T14 Stakes and streaks panels.** `stakes-panel.test.tsx`: `h2` "Lo que está en juego", one item per line, decorative icons, hidden when there are no lines; `streaks-panel.test.tsx`: headline and best streak, nothing when `null`. Then the components.
- [ ] **T15 Match card and goleadas.** `match-card.test.tsx`: date, competition label, the visual score `aria-hidden` and the sr-only sentence, the fan's side bold, result pill text and icon per outcome, notes; goleadas with both empty lines. Extend `palette-contrast.test.ts` with the pill text on its 5% tint over glass and over the glow (4.5:1). Then `match-card.tsx` and `goleadas-panel.tsx`.
- [ ] **T16 Finals panel.** `finals-panel.test.tsx`: one item per series with season, winner line, legs with dates, "(antes de tu período)" mark, the empty line, the "Contamos solo las finales…" line; the DOM never contains "completa"/"completo" claims. Then `finals-panel.tsx`.
- [ ] **T17 States.** `rivalry-states.test.tsx`: skeleton (`aria-busy`, "Cargando el mano a mano…", `motion-safe:animate-pulse`, same blocks as the layout); same-club card with the link to `/rivales`; never-met card with both names; not-found card without the id. Then `src/components/rivalry/rivalry-states.tsx`.
- [ ] **T18 `RivalryScreen` container.** `tests/unit/components/rivalry/rivalry-screen.test.tsx` with the loader mocked, `headToHead` and `buildRivalryView` spied, every `console` method spied: `"unknown"` renders both pending blocks with the rival name; no choice gives the empty state; **same club gives "Ese es tu club" and the loader and the engine are never called**; a choice shows the skeleton, then the full content in the D8 order (assert the `h2` sequence); a failing rival document shows the error and "Reintentar" loads it; the loader was called only with the two club ids; `container.innerHTML` and every spy call are free of the start date; changing the saved club reloads. Then `src/components/rivalry/rivalry-screen.tsx`.
- [ ] **T19 Page, metadata and budget.** `tests/unit/app/rivalry-page.test.tsx` (extends T1): the page prerenders both pending blocks with the rival's crest and "Tu club vs. {rival}" and no `\d{4}-\d{2}-\d{2}`; `generateMetadata` gives the title, the description and `robots.index === false`, and no fan data; `ensureStatic` is `"navigation"`; `not-found.tsx` renders the friendly copy, a link to `/rivales` and logs nothing. Then the final page. Run `pnpm build`: `/rivales/[rival]` prerendered for 34 paths, `/rivales` still static; module scripts of `.next/server/app/rivales/boca-juniors.html` (gzip, `noModule` excluded) at most **20 KB over the 142.8 KB shell baseline** and under 170 KB; no `zod` or `contrastRatio` in its chunks; `/rivales` still within its plan 0015 numbers (150.6 KB plus at most 1 KB for the links). Record everything in the verification log.

### Group D: end to end (`tests/e2e/rivalry.spec.ts`, iphone, android, desktop)

Seeding as in `rivales.spec.ts`. Screenshots go to `test-results/screens/{project}-rivalry-*.png`.

- [ ] **T20 From the list and back.** River from `1990-05-20` on `/rivales`: choose "Liga", then open Boca (card on phones, table cell on desktop): URL is `/rivales/boca-juniors`, `h1` "River vs. Boca"; "Volver a Rivales" returns with "Liga" still checked and the "Contamos: Primera División." line (the Activity fix); browser back does the same. Keyboard on desktop: Tab reaches the Boca link with a visible outline and Enter opens it.
- [ ] **T21 Ready content.** River v Boca: the notice "Tu historial puede estar incompleto", "Contamos:" and the cups line, **no `/cobertura completa|historial completo/i`**; record 8 / 5 / 2 / 1, "Saldo +4", "Dominás"; "Lo que está en juego" with the cushion line; last match "27 de abril de 2025", "River 2 - 1 Boca", "Ganaste"; "Venís de 3 triunfos seguidos."; goleadas with "23 de septiembre de 2018"; the finals empty line; the `h2` order of D8 (screenshots `-ready`, `-ready-full`). Boca v Banfield: the final of "Copa Diego Armando Maradona 2020" with "Ganaste la final" and "Ganaste 5 a 3 por penales" (screenshot `-final`). Belgrano from `2000-01-01` v Talleres: the three stake lines and "Venís de 4 partidos sin ganarle." (screenshot `-belgrano`). Aldosivi v Deportivo Riestra: "Todavía no se cruzaron" plus the notice (screenshot `-never-met`). On phones there is one column and no horizontal scroll at 390 and 412 px; on desktop the two-column grid with the sidebar.
- [ ] **T22 States.** No saved club: empty state without skeleton flash. Saved club River on `/rivales/river-plate`: "Ese es tu club" and **no request to `/api/clubs/`** (screenshot `-same-club`). `/rivales/not-a-club`: response status 404 (or the ADR 0019 fallback), the friendly not-found page, the footer, and the id not in the page text (screenshot `-not-found`). Rival document held by `page.route`: skeleton with `aria-busy` (screenshot `-loading`); rival document 500: the error, then "Reintentar" recovers (screenshot `-error`). Scripts blocked: the server HTML shows the rival name and the right pending block for a saved and an unsaved device.
- [ ] **T23 Privacy, accessibility and footer.** During T20 and T21: every request URL, body and `document.cookie` free of the four spellings of `1990-05-20`; the only data requests are `GET /api/clubs/river-plate` and `GET /api/clubs/boca-juniors`, without query; no console message has them; the page title is "Boca Juniors · Rivales · Rincón del Hincha" and the `robots` meta has `noindex`. On phones every link and button of the detail and every rival card link is at least 44 x 44; reduced motion makes the bar and skeleton durations under 0.01 s; the footer has the credits and the version. `footer.spec.ts`, `layout.spec.ts` and `rivales.spec.ts` stay green.

### Group E: close

- [ ] **T24 Docs.** `docs/methodology.md`: the unbeaten and winless rule under "Streaks", and a "Rivalry detail (UI)" note (whole fan period, no filters, the `STAKE_NEAR` rules, the streak headline rule, "desde que naciste" by start mode, never a complete badge, the never-met included line, finals legs outside the period). ADR 0019 status after D5 and T1. Check `/privacidad` still matches (two club ids are requested, both public). This plan: "Decisions recorded", verification log, `status: done`.

## Copy (Spanish, voseo; D10)

| Where                           | Text                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title (metadata)           | {rival name} · Rivales                                                                                                                                                                                         |
| Description (metadata)          | Tu historial contra {rival name} desde que sos hincha: último partido, rachas, goleadas y finales.                                                                                                             |
| Back link                       | Rivales (accessible name "Volver a Rivales")                                                                                                                                                                   |
| Card link accessible name       | {short name}, ver el mano a mano                                                                                                                                                                               |
| `h1` with club                  | {club short} vs. {rival short}                                                                                                                                                                                 |
| `h1` before the club is known   | Tu club vs. {rival short}                                                                                                                                                                                      |
| Sub-line                        | Desde {mes} de {año} · 1 partido / {n} partidos                                                                                                                                                                |
| Record heading                  | El historial                                                                                                                                                                                                   |
| Record labels                   | PJ · PG · PE · PP · Saldo · Goles: {a} a {b}                                                                                                                                                                   |
| Stakes heading                  | Lo que está en juego                                                                                                                                                                                           |
| Stake, to dominate              | Con 1 triunfo más pasás a dominar este historial. / Con {n} triunfos más pasás a dominar este historial.                                                                                                       |
| Stake, to even (from dominated) | Con 1 triunfo más emparejás este historial. / Con {n} triunfos más emparejás este historial.                                                                                                                   |
| Stake, cushion (dominating)     | Tenés colchón: haría falta 1 derrota más para que esto vuelva a estar parejo. / Tenés colchón: harían falta {n} derrotas más para que esto vuelva a estar parejo.                                              |
| Stake, warning (even, near)     | Ojo: con 1 derrota más te pasan a dominar. / Ojo: con {n} derrotas más te pasan a dominar.                                                                                                                     |
| Stake, milestone (near)         | Estás a 1 victoria de las {m} contra {rival short} desde que naciste. / Estás a {n} victorias de las {m} contra {rival short} desde que naciste. ("desde que sos hincha" when the start is not the birth date) |
| Stake, first win                | Todavía no le ganaste desde que naciste. El primero se va a gritar el doble. ("desde que sos hincha")                                                                                                          |
| Last match heading              | El último partido                                                                                                                                                                                              |
| Result pills                    | Ganaste · Empataste · Perdiste                                                                                                                                                                                 |
| Penalties note                  | Ganaste {a} a {b} por penales. / Perdiste {a} a {b} por penales.                                                                                                                                               |
| Administrative note             | Resultado administrativo                                                                                                                                                                                       |
| Score (screen readers)          | {home} {g}, {away} {g}                                                                                                                                                                                         |
| Streaks heading                 | Rachas                                                                                                                                                                                                         |
| Headline, identical run of 1    | Ganaste el último. · Empataste el último. · Perdiste el último.                                                                                                                                                |
| Headline, identical run         | Venís de {n} triunfos seguidos. · Venís de {n} empates seguidos. · Venís de {n} derrotas seguidas.                                                                                                             |
| Headline, unbeaten              | Venís de {n} sin perder.                                                                                                                                                                                       |
| Headline, winless               | Venís de {n} partidos sin ganarle.                                                                                                                                                                             |
| Best win streak                 | Tu mejor racha: {n} triunfos seguidos, de {mes} de {año} a {mes} de {año}. / Tu mejor racha: 1 triunfo. Todavía no le ganaste dos seguidos. / Todavía no le ganaste en tu período.                             |
| Goleadas heading                | Goleadas                                                                                                                                                                                                       |
| Biggest win title / empty       | La mejor / Todavía no le ganaste en tu período. Ya va a llegar.                                                                                                                                                |
| Biggest loss title / empty      | La que más dolió / Nunca te ganaron en tu período. Que siga así.                                                                                                                                               |
| Finals heading                  | Finales entre ustedes                                                                                                                                                                                          |
| Final winner lines              | Ganaste la final · Perdiste la final · Final sin ganador en nuestros datos                                                                                                                                     |
| Leg before the period           | (antes de tu período)                                                                                                                                                                                          |
| Finals empty                    | No se cruzaron en ninguna final en tu período. Por ahora, todo se define en el torneo.                                                                                                                         |
| Finals scope line               | Contamos solo las finales de los torneos que tenemos cargados.                                                                                                                                                 |
| Never met, included line        | Todavía no se cruzaron en los torneos que tenemos cargados.                                                                                                                                                    |
| Never met, title / text         | Todavía no se cruzaron / En tu período no hay partidos cargados entre {club} y {rival}.                                                                                                                        |
| Same club, title                | Ese es tu club                                                                                                                                                                                                 |
| Same club, text                 | No podés jugar contra vos mismo… bueno, en los entrenamientos sí. Elegí un rival.                                                                                                                              |
| Same club and not found, button | Ver tus rivales                                                                                                                                                                                                |
| Not found, title / text         | Ese rival no está en nuestro fixture / Fijate que el link esté bien, o elegí uno de tu lista.                                                                                                                  |
| Loading (screen reader)         | Cargando el mano a mano…                                                                                                                                                                                       |
| Notice, empty, error            | The plan 0015 strings, unchanged                                                                                                                                                                               |

Dates on this screen are match dates ("27 de abril de 2025") or months of match dates. The only text derived from the start date is "Desde {mes} de {año}", as on `/rivales` (ADR 0018 note).

## Tests to write (summary)

- **Unit, domain (100% branches):** `streaks` (unbeaten, winless), `head-to-head` (pass-through).
- **Unit, lib (100% branches):** `rivalry-copy` (dates, scores, stakes, streaks, finals), `rivalry-view` (including the privacy property test), `coverage-copy` (exported months), extended `palette-contrast`.
- **Unit, app:** the page (`generateStaticParams`, `generateMetadata`, `notFound`, `ensureStatic`, pending blocks), `not-found.tsx`.
- **Component (jsdom):** `useClubDocuments`, the Activity case of `RivalsScreen`, links in the card list, table and humor sections, header, record, stakes, streaks, match card, goleadas, finals, states, `RivalryScreen`.
- **Integration (real data):** `headToHead` equivalence for all 1,122 ordered pairs and for 10 pairs with every start, filter and the narrowed period; `buildRivalryView` equivalence for 3 pairs; golden values for 5 pairs.
- **E2E (390x844, 412x915, 1280x800):** `rivalry.spec.ts` (T20 to T23) with screenshots `-ready`, `-ready-full`, `-final`, `-belgrano`, `-never-met`, `-same-club`, `-not-found`, `-loading`, `-error`; existing specs green.
- **Edge cases:** rival equal to the fan's club (no load, no engine); unknown id, uppercase id, encoded `../` and a 10 KB id (404, no echo); no saved choice; storage blocked; saved date invalid; future start (empty period: no notice, no stakes, never-met card); a pair that never met; a single match (singular copy everywhere); no wins (first win line, empty best streak and biggest win); no losses (biggest loss empty line); only draws; a shoot-out (draw in the record, winner in the final, penalties note); an administrative result (marked, never a goleada); a two-leg final with a leg before the period; a final without winner (tied aggregate, no shoot-out); a club that left Primera (Belgrano: Copa de la Liga `missing` for the pair); the rival's document failing while the fan's is cached; changing the saved club on `/` while the detail is mounted; the route hidden and shown by `<Activity>`; Buenos Aires midnight for "today"; accented names (Colón, Unión, Newell's).

## Impact

- **Data:** none changed. No new endpoint: the existing per-club documents are reused. No Supabase.
- **Design:** new components under `src/components/rivalry/`; the result pills join the palette contrast test (5% tint, like the chips); the rivals list gains links and a chevron. No new tokens, fonts or `motion`.
- **Security and privacy:** the rival id is the only route data and is validated on the server against the dataset; the not-found page does not echo it. The browser requests two public club documents, without query or body. The start date stays in memory; the view returns only a month and year from it, tested by a property test; `startMode` only changes a phrase on screen. Metadata is built from the public rival only. Nothing is logged (spies in unit tests, console watched in e2e). CSP unchanged.
- **Performance:** at most one extra document per detail (3.4 to 8.2 KB gzip, cached by the CDN and in memory); the engine part is about 1 KB gzip more than `/rivales` (ADR 0018 measured 3.3 KB for slice 2); the route's client code is capped at 20 KB gzip over the shell (T19). Unknown ids cost one server render each (like the 400 of the club route).
- **Coverage config:** no change.

## Risks and mitigation

- **Next behavior for unknown params under Cache Components** (200 App Shell instead of 404, or caching of rendered 404s). Mitigation: T1 verifies on a production build before the rest is built; ADR 0019 has the soft 404 fallback.
- **`ensureStatic = "navigation"` is new in 16.4** and could change. Mitigation: it only adds build validation; removing it keeps the route static (T19 checks the build output either way).
- **Filters lost on back navigation** (the Activity cleanup bug). Mitigation: T11 fixes it with a test, T20 covers it end to end.
- **Copy that shames the fan** (stakes and streak lines on bad records). Mitigation: humor reviewed by the UI auditor; D2 and D10 for Diego; every negative line has a hopeful tail.
- **Slice drift** (the detail uses fields of `HeadToHead` not covered by equivalence). Mitigation: T3 deep-equals the whole `HeadToHead` and the view for real pairs.
- **Season-precision matches (ADR 0011) later.** `formatMatchDate` assumes a day date; when `date_precision: "season"` lands, the match card must show the season instead. Mitigation: a note in the methodology and a typed `MatchCardView.date` that the future change will widen; today every match is day precision.
- **Classics.** `rivalry` is always `null` (no `rivalries.json`), so no "Superclásico" header; left for the issue that loads rivalries.
- **JS budget.** The detail imports more engine code than `/rivales`. Mitigation: T19 measures and caps it; no new dependency.

## How to verify it is finished

- Each acceptance criterion maps to passing tests: record, last match, streak, biggest win and loss and finals (T4, T9, T10, T13 to T16, T18, T21); what is at stake (T6, T14, T21); same club with no engine call (T18, T22); partial coverage rules and privacy (T9, T10, T18, T21, T23).
- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/domain`, `src/data-model`, `src/lib`), `pnpm data:validate`, `pnpm build` (`/rivales/[rival]` prerendered for 34 paths, `/rivales` still static, the detail within budget) and `pnpm e2e` on the three projects are green.
- `curl -sI` on the preview: a known rival is 200 with the security headers; an unknown one is 404 (or the recorded fallback).
- The screenshots of the three projects attached to the PR.
- ADR 0019 accepted with D5 and the T1 results; D1 to D10 recorded here; the methodology updated.

## Decisions recorded

(Filled in after Diego answers.)

## Verification log

(Filled in during T1, T3 and T19.)
