---
issue: 67
status: in-review
date: 2026-10-23
---

# Plan 0018: the vitrina (`/vitrina`, the trophy shelf)

Related issues: #67 (this plan), #15 (MVP screens, parent), #70 (RSSSF ingestion, plan 0017: the first-division titles), #12 (coverage table, plan 0014 Phase 2: cups not loaded), #16 (compare, out of scope), #18 (budgets), #43 (input validation). Related ADRs: [0003](../adr/0003-data-sources.md) (sources, titles), [0005](../adr/0005-no-official-crests.md) (no official marks; generic trophies too), [0007](../adr/0007-visual-identity-lawn-neon.md) (tokens: `--gold` for trophies only, shell, AA), [0010](../adr/0010-stats-engine-in-typescript.md) (engine), [0013](../adr/0013-club-theming-and-onboarding-storage.md) (storage, start date privacy), [0017](../adr/0017-derived-coverage-table.md) (derived coverage), [0018](../adr/0018-stats-screens-compute-in-the-browser.md) (compute in the browser on per-club documents), [0019](../adr/0019-static-routes-for-public-ids.md) (static routes), **[0021](../adr/0021-titles-shared-table-and-title-coverage.md)** (new, Proposed: titles as a shared table and the derived title coverage).

## Goal

Replace the `/vitrina` placeholder with the fan's trophy shelf (master prompt section 5.2): glass shelves with three sections (Internacionales, Locales, Otros), the titles won inside the fan period lit in gold with their year, glass silhouettes for the competitions still missing, the two counters, a checklist, and a detail per trophy (date, final or last match day, rival, score, source). It is the first screen after onboarding (the CTA lands here), so it must be useful and honest with the titles we have: first-division league titles from RSSSF (plan 0017, D5) and whatever else is loaded, never an invented total and never a "complete" claim.

## Acceptance criteria (copied from issue #67)

- Given titles in `data/`, when the screen opens, then trophies won in the period are lit with their year, grouped as Internacionales, Locales and Otros, and the missing ones are silhouettes.
- Given the counters, then "Trofeos ganados desde que naciste" and "Trofeos que te faltan" are shown.
- Given a trophy, when tapped, then its detail (date, final, rival, score) opens.
- Given disputed titles, then the criterion and source are shown.

Out of scope (from the issue): loading the titles dataset (plan 0017 and its follow-ups). Also out of scope here: the rivals' shelves (compare, #16), share images and the `vitrina_vista` analytics event (Fase 4), count-up and light-up animations and the title celebration (Fase 5), cup titles (no permitted source loaded yet), Lighthouse and the automated JS budget (#18).

Hard constraints (Diego, and the same as plans 0015 and 0016):

- The vitrina is fed by RSSSF **and everything else we have** (plan 0017, D10 as changed by Diego); it shows what is loaded with its coverage and **never claims a complete history**: no "complete" badge while plan 0014 Phase 2 is open; cups are not loaded and the screen says so.
- The fan start date never appears in a URL, request, log, cookie, error or analytics event. Compute in the browser on the fan's per-club document (ADR 0018).
- 170 KB gzip of JS per route; `/vitrina` stays a static shell.
- The engine stays pure with 100% branch coverage in `src/domain`, `src/data-model` and `src/lib`.
- Copy in Rioplatense Spanish with voseo and healthy football humor; no betting, no violence.
- Mobile first (390x844, 412x915) plus the desktop sidebar layout; 44 px targets; WCAG 2.2 AA; reduced motion; skeleton, empty and error states; the footer with version and credits.

## What exists today (and is reused)

- **Engine** (`src/domain/titles.ts`): `trophyShelf` (`international`, `domestic`, `other` from `competition.type` and `scope`), `isRecognized` (`afa_recognized`), `decidingMatch` (cups: the club's last counted final leg of the season; leagues: the club's last counted match of the season on or before `awarded_on`; `null` when match data is missing), `titlesInPeriod(index, clubId, period, { includeUnrecognized })` (sorted by `awarded_on`, then id; carries `shared`, `source`, `shelf`, `decidingMatch`), `pendingTitles(index, clubId, period)` (recognized competitions with a season overlapping the period and no title inside it). Tested in `tests/unit/domain/titles.test.ts` on the `stats-world` fixture, which already has a shared title (`t5`, `t6`) and an unrecognized one (`t7`).
- **Data model:** `titleSchema` (`id`, `club_id`, `competition_id`, `season_id`, `awarded_on`, `shared`, `source`, `verified`); the validator rules `title-without-support` and `unshared-co-champions`. There is no "disputed" field: the criterion is the competition's `afa_recognized`.
- **Data contract:** `ClubData.titles` exists but today holds only the club's own rows, and `src/lib/club-data.server.ts` hard-codes `titles: []` because `data/titles.json` does not exist yet.
- **Ingestion:** `scripts/ingest/rsssf/titles.ts` (`buildTitles`: one title per configured first-division season from `argchamp.html`, checked against the final table's champion mark, `awarded_on` = the final's date or the last match of the season; the 2025 "Anual LPF" is never a title) and title ownership by prefix in the merge. Not wired to a run yet (plan 0017 T20, T35).
- **Data today:** competitions `primera-division` (league, domestic) and `copa-de-la-liga-profesional` (national cup, domestic), both `afa_recognized`; seasons from the Superliga 2018-19 to the Torneo Clausura 2025 plus the Copa Diego Armando Maradona 2020 (its final is the only `is_final` match). No title record.
- **UI:** `useFanChoice`, `useClubDocuments`, `loadClubData` (cached), the pending CSS (`html[data-club] .pending-empty`, `html:not([data-club]) .pending-skeleton`), `CoverageNotice` (always prints the "cups not loaded" line; no complete state), `coverageCopy`, `formatMonthYear`, `joinNames`, `includedLine`, `formatMatchDate`, `penaltiesNote`, `competitionLabel`, `resultLabel` (`src/lib/rivalry-copy.ts`), `MatchCard`, the info menu's focus trap (`src/lib/focus-trap.ts`), `Crest`, the glass and `font-display` styles, `--gold`.
- **Nav and tests:** "Vitrina" is already in `NAV_ITEMS`; `layout.spec.ts`, `footer.spec.ts`, `security-headers.spec.ts` and `onboarding.spec.ts` visit `/vitrina` and must stay green.

## Approach

### Data contract (ADR 0021)

- `sliceClubData` keeps **every** title (a shared table, like competitions and seasons), so the browser can name a co-champion and know which seasons have a champion loaded. `v` stays 1; `isClubData` gains a light guard on title records (the five string keys and the `shared` boolean), like the one on matches.
- `src/lib/club-data.server.ts` parses `data/titles.json` with `titleSchema` instead of `titles: []`. **Dependency:** the file must exist. Plan 0017 creates it (T35); if this plan is ready first, the builder stops and asks Diego (D10).
- Size: about 2 KB gzip more per document with titles from 1985-86; the size test records it (T2).

### Engine additions (pure, tests first, 100% branches)

1. **`titleCoverage(index, today)`**: per recognized competition, `{ competitionId, firstSeasonId, lastSeasonId, windowStart, windowEnd, missingSeasonIds }` from the seasons that have at least one title (any club). `missingSeasonIds` are the decided seasons (`end` before today) between the first and the last titled season with no champion. A competition with loaded seasons and no title has `firstSeasonId: null` (empty window). Sorted by competition id.
2. **`pendingTitles` amended (ADR 0021 decision 3)**: a competition is pending only if its title window overlaps the fan period and the club has no title of it inside the period ∩ window. Each item gains `windowFirstSeasonId` and `windowLastSeasonId`. Competitions with an empty window, or a window outside the period, are returned apart as `unknown` (a second array, or a `status: "pending" | "unknown"` field; the builder picks the one with the simpler tests). The "season overlaps the period" rule stays inside the window.
3. **`titlesBeforePeriod(index, clubId, period, options)`**: the club's titles with `awarded_on` before `period.start`, same shape and order as `titlesInPeriod` (shared mapper). Empty period: every title is before.
4. **`coChampions(index, title)`**: the other club ids with a title of the same season (sorted), for the "compartido con" line.

Methodology gets the rules (T24). No change to the match coverage, the validator or the data files.

### What the shelf shows per trophy (D1)

- **Lit trophy (title inside the period):** a generic gold SVG trophy per competition type (league, national cup, international, other; own drawings, ADR 0005 spirit), the **year of `awarded_on`** in big `font-display`, and the season name in small text ("Superliga 2018-19", "Torneo Apertura 2025"). A small "Compartido" mark when `shared`. Each trophy is a `<button>` (min 44 x 44) whose accessible name is "{season name}, campeón el {fecha}. Ver detalle".
- **Silhouette (pending competition):** the same shape as a glass outline (no gold), the competition name and "Te falta", with the window as a caption ("No lo ganaste entre la Superliga 2018-19 y el Torneo Clausura 2025"). Not a button (it has no detail); it is a list item.
- **Detail (sheet on phones, side panel on desktop):** season and competition; "Campeón el {fecha}" (full date of `awarded_on`, a public fact); the deciding match as a `MatchCard` under "La final" (when `is_final`) or "La última fecha" (otherwise), with the rival, the score, the result and the penalties or administrative note; "No tenemos cargado el partido que lo definió." when `decidingMatch` is `null`; "Compartido con {club}." for shared titles; "Fuente: {host}" as an external link (`rel="noreferrer"`); the criterion line "Contamos solo títulos reconocidos por la AFA. Un título compartido cuenta entero para cada campeón."; "No verificado con una segunda fuente" when `verified` is false is **not** shown (every record is `verified: false` today; it would be noise; D7).

### Grouping (D2)

The three shelves of the issue, always in the order **Internacionales, Locales, Otros**. Inside a shelf: lit trophies in chronological order (`awarded_on`, then id), then the silhouettes (by competition name). One trophy per title (River with three league titles shows three trophies), not one per competition with a counter. No timeline view in the MVP (discarded alternative). A shelf with no loaded competition shows an "en obra" line instead of silhouettes ("Todavía no cargamos Libertadores, Sudamericana ni las otras copas internacionales."): **a cup that is not loaded is never a silhouette**, because "te falta" would be false for a club that won it.

### Titles before the fan period (D3)

The fan's history starts at their start date, so only titles inside the period are lit and counted. Titles before it go to a collapsed `<details>` block under the shelves, "Antes de que llegaras ({n})", muted (no gold), not counted, each row with the season name and year and the same detail button. Hidden when there are none. The split reveals nothing that is not already on screen ("Desde {mes} de {año}") and never reaches a request.

### Counters and checklist

- **"Trofeos ganados desde que naciste"** (`startMode: "birth"`) or **"Trofeos ganados desde que sos hincha"** (`"other"`, same rule as plan 0016 D4): the count of lit trophies. **"Trofeos que te faltan"**: the count of pending competitions. Both with the caption "En los torneos y temporadas que tenemos cargados." Plain numbers (no count-up; Fase 5).
- **Checklist** ("Tu checklist", `h2`): one row per loaded recognized competition: "Ganado (N)" with a check icon, "Te falta" with an empty box, or "Sin datos todavía" with a question icon (unknown). Text plus icon, never color alone.

### Coverage notice (D6)

The vitrina reuses `CoverageNotice` with a title-specific copy built by `titleCoverageCopy(titleCoverage, period, names)` in `src/lib/vitrina-copy.ts`. The note **always shows** for a non-empty period (there is no title source that reaches today and the cups are not loaded):

- heading "Tu vitrina puede estar incompleta"; lead "Mostramos solo los títulos que tenemos cargados.";
- per competition relevant to the period: "{Competencia}: tenemos los campeones de {primera temporada} a {última temporada}." / "{Competencia}: nos falta el campeón de {temporada}." / "{Competencia}: todavía no tenemos sus campeones.";
- the included line "Contamos títulos de: Primera División." (competitions with a non-empty window), or "Todavía no cargamos títulos." when none;
- the existing "Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas." line (printed by the component);
- the criterion line (also in each detail).

No text anywhere says "completa", "completo" or "toda la historia" (component and e2e checks).

### No titles loaded, zero titles, empty period (D4, D5)

- **No title in the dataset at all** (`titleCoverage` has no window; today's state): no counters, no silhouettes; a card "Todavía no cargamos los títulos" with "Cuando lleguen, tu vitrina se arma sola. Mientras tanto, mirá cómo te fue contra cada rival." and a link to `/rivales`. The notice still shows.
- **Titles loaded, none for the club in the period:** the counters (0 and N), the silhouettes, and a humor line on the shelves: "Todavía no levantaste ninguna copa desde que naciste. La vitrina está limpita y con lugar de sobra." ("desde que sos hincha" by start mode).
- **Empty period** (a start after today; the form prevents it but the engine allows it): "Tu historia todavía no empezó", no notice, no counters.

### States (D5)

- Pending (server HTML and hydration): the `h1` "Mi vitrina" in the static HTML; `pending-skeleton` (the shelf skeleton) and `pending-empty` (empty state), chosen by the existing CSS.
- Loading: `VitrinaSkeleton` (header, two counters, three shelves), `aria-busy="true"`, hidden "Cargando tu vitrina…", `motion-safe:animate-pulse`.
- No club saved: "Todavía no elegiste tu club" with "Elegí tu club y desde cuándo sos hincha para armar tu vitrina." and the button to `/#elegi-tu-club` (a vitrina variant of `RivalsEmpty`, or `RivalsEmpty` with a copy prop).
- Error: "No pudimos abrir tu vitrina" with "Reintentar" (reloads only the document; the loader forgets failed promises).
- The three data states above.

### Screen design (mobile first, "Césped y neón")

Order (D8): `h1` "Mi vitrina" (display, uppercase by CSS) with the club crest and "{Club} · desde {mes} de {año}"; the two counters side by side; the coverage notice; the three shelves (`h2` each); the checklist; "Antes de que llegaras". Phones: one column, shelves as wrapping grids (three trophies per row at 390 px, no horizontal scroll). Desktop (`lg`, with the sidebar): shelves in the left two thirds; counters, checklist and notice in a right column. Shelves are glass panels with a thin gold-tinted "light" line at the top (decorative, 8% alpha cap of ADR 0007). Lit trophies use `--gold`; silhouettes a `--line-strong` outline at 3:1 against the glass (non-text contrast, WCAG 1.4.11). No new tokens or fonts; no `motion` library.

**Detail panel:** a modal panel following the info menu pattern (`focus-trap.ts`): bottom sheet on phones, right side panel on desktop; focus moves to its heading, Tab is trapped, Escape and the "Cerrar" button close it, and focus returns to the trophy button. `aria-modal="true"`, labelled by the season heading. The URL does not change (no route per title; D9).

**Accessibility:** one `h1`; an `h2` per shelf, the counters, the checklist and the before block; trophies are buttons with descriptive names, the SVGs `aria-hidden`; silhouettes are list items with text; reduced motion turns off the skeleton pulse; targets 44 x 44; numbers and gold text 4.5:1 on glass and on the glow (extend `palette-contrast.test.ts`).

### View model and copy (`src/lib`, pure, 100% branches)

`buildVitrinaView(input) -> VitrinaView` in `src/lib/vitrina-view.ts`, with input `{ index, clubId, startDate, startMode, now, catalog, competitionNames, seasonNames }`. It returns: `since` (month and year only), `hasAnyTitles`, `counters` (`won`, `missing`, labels), `shelves` (three, each `{ key, title, trophies: TrophyView[], silhouettes: SilhouetteView[], underConstruction: string | null }`), `checklist`, `before: TrophyView[]`, `notice: CoverageCopy`, `included`, `emptyLine`. A `TrophyView` has `id`, `year`, `seasonName`, `competitionName`, `kind` (league, cup, international, other, for the SVG), `shared`, `buttonLabel` and `detail` (`awardedOn` formatted, `matchHeading`, `match: MatchCardView | null`, `sharedWith: string | null`, `sourceHost`, `sourceUrl`, `criterion`, `recognized`). All Spanish strings live in `src/lib/vitrina-copy.ts`.

**The view never returns the start date**: only `since`. A property test feeds 50 random start dates that are not title or match dates and checks that `JSON.stringify(view)` contains none of the four spellings of the date.

### Input validation (issue #43)

| Input                  | Where              | Check                                                        |
| ---------------------- | ------------------ | ------------------------------------------------------------ |
| Fan club and date      | `localStorage`     | `parseFanChoice` (existing), through `useFanChoice`          |
| The club document      | `/api/clubs/<id>`  | `isClubData` (existing) plus the new title record guard      |
| `data/titles.json`     | server, build time | `titleSchema.array().parse` in `club-data.server.ts`         |
| Title `source` as link | client             | only `https:` URLs become links; anything else is plain text |

### Discarded alternatives

- **Counting titles against the match coverage** (lit only where matches are complete): titles do not depend on matches (methodology); it would hide real titles before 2018-19.
- **Silhouettes for every competition we know exists** (Libertadores, Copa Argentina) without loaded champions: "te falta" would be false for clubs that won them. Rejected by ADR 0021 decision 3.
- **A title coverage file in `data/`** (like `coverage.json`): it can be derived from seasons and titles with no review step; a file adds a generator and a drift check for nothing.
- **Only the club's own titles in the document plus a `champions` summary**: a second shape to keep in sync; the whole table is about 2 KB gzip.
- **A route per trophy (`/vitrina/[title]`)**: the detail is small, has no share use yet, and a static route per title id adds prerendering and 404 work (ADR 0019) for no gain. Revisit with sharing (Fase 4).
- **A timeline view** instead of shelves: the issue asks for the three shelves; a timeline can come later as a toggle.
- **Native `<dialog>`**: fine in browsers, but jsdom's `showModal` support is partial and the info menu already has a tested focus trap; one pattern in the app.
- **Showing the rivals' shelves now**: that is the compare screen (#16).

## Decisions for Diego (NEEDS DIEGO)

Every task except the copy strings is independent of these answers; each answer changes constants or copy only. One line each.

- **D1. Per trophy.** Gold trophy with the year of the title and the season name; "Compartido" mark; detail with date, "La final" or "La última fecha" (rival, score, penalties), co-champion, source link and the AFA criterion? **Recommended: yes.**
- **D2. Grouping.** Three shelves (Internacionales, Locales, Otros), one trophy per title in chronological order, silhouettes after them; no timeline in the MVP? **Recommended: yes.**
- **D3. Titles before the period.** Not lit and not counted; listed in a collapsed "Antes de que llegaras (N)" block? **Recommended: yes** (alternative: hide them).
- **D4. Club with no titles in the period.** Counters at 0, silhouettes, and the "vitrina limpita" humor line; and with no titles loaded at all, a "Todavía no cargamos los títulos" card with no counters? **Recommended: yes.**
- **D5. States.** Skeleton, no club, error with retry, and empty period as above? **Recommended: yes.**
- **D6. Coverage notice.** Always shown: the title window per competition ("tenemos los campeones de X a Y"), "Contamos títulos de: …", the cups line, the AFA criterion; never a complete badge? **Recommended: yes.**
- **D7. "Te falta" scope.** A silhouette only for loaded recognized competitions whose champions we have in the fan period, captioned with the window; unloaded cups are an "en obra" line, never a silhouette; aspirational for every loaded competition, even one the club never played? **Recommended: yes** (alternative: only competitions the club played in the period).
- **D8. Shelves of rivals.** Only the fan's club; rivals' shelves come with compare (#16)? **Recommended: yes.**
- **D9. Detail and unrecognized titles.** Detail as a modal sheet with no URL change; unrecognized titles (none loaded today) listed apart as "Títulos discutidos", not lit, not counted, with criterion and source? **Recommended: yes.**
- **D10. Ship order.** Build now on fixtures and merge only after plan 0017 writes `data/titles.json` (first-division titles), so the first screen after onboarding is never the "no titles" card in production? **Recommended: yes.** Also: open a data issue for the 2020 Copa Diego Armando Maradona title (its final is already loaded) and the Copa de la Liga 2021 to 2024 titles? **Recommended: yes.**
- **D11. Copy.** Approve the Spanish strings in "Copy" below (tunable on the preview)? **Recommended: approve.**

## Tasks

Test first in every task: write the failing test, then the code. One hour or less each. `pnpm test` before checking a task off; `pnpm test:coverage` keeps 100% branches in `src/domain`, `src/data-model` and `src/lib`.

### Group A: data contract and engine

- [ ] **T1 Titles as a shared table (ADR 0021).** In `tests/unit/domain/club-data.test.ts`: `sliceClubData(world, "club-c")` keeps every title of the fixture (sorted by id), and two merged slices still dedupe titles by id. In `tests/integration/club-data-equivalence.test.ts`: `titlesInPeriod`, `pendingTitles` and `titleCoverage` on each club's slice deep-equal the full dataset for every club, 6 start dates and `includeUnrecognized` both ways (fixture and real data). Then `sliceClubData`.
- [ ] **T2 Server wiring and guard.** `tests/unit/lib/club-data-client.test.ts`: `isClubData` rejects a title missing `season_id` or with a non-boolean `shared`, accepts `titles: []`. `tests/unit/app/club-data-route.test.ts`: every document has the same `titles` array as `data/titles.json`; the size test records the new gzip sizes (largest, smallest). Then `isClubData` and `club-data.server.ts` (parse `data/titles.json`). **Blocked until `data/titles.json` exists (D10)**; the guard part can land first.
- [ ] **T3 `titleCoverage`.** `tests/unit/domain/titles.test.ts` (extend `stats-world` with a league season without champion between two titled ones, and a cup with seasons and no title): window first and last seasons, `missingSeasonIds` only for decided seasons inside the window, an ongoing season (`end` after today) is never missing, a competition with no title has an empty window, unrecognized competitions are excluded, the Buenos Aires "today" at 02:59 UTC. Then the function.
- [ ] **T4 `pendingTitles` amended.** Same file: pending only when the window overlaps the period; a title of the club inside the period but outside the window is impossible by construction (assert); a title before the period does not remove the silhouette; window outside the period and empty window go to `unknown`; each item carries the window seasons; empty period gives nothing; order by shelf then competition id. Update the existing cases. Then the code and `methodology.md` "Pending titles".
- [ ] **T5 `titlesBeforePeriod` and `coChampions`.** Same file: before-period titles (the boundary day belongs to the period), recognized only by default, same order and shape as `titlesInPeriod`; empty period lists all; `coChampions(t5)` is `["club-b"]`, a not shared title gives `[]`. Then both functions (shared mapper with `titlesInPeriod`).
- [ ] **T6 Golden values on real data.** `tests/integration/vitrina-golden.test.ts` with `now = 2026-10-23T12:00:00Z`, on the full dataset once `data/titles.json` lands: for River from `1990-05-20`, Boca from `1990-05-20`, Banfield from `2000-01-01` and a club with no title in the window, the lit titles (ids and `awarded_on`), the pending competitions with their window, the unknown list (Copa de la Liga until its titles load), and `titleCoverage` for `primera-division`. The data auditor recomputes the values independently from the RSSSF list. **Blocked until `data/titles.json` exists.**

### Group B: copy and view model (`src/lib`, pure, 100% branches)

- [ ] **T7 Copy helpers.** `tests/unit/lib/vitrina-copy.test.ts`: counter labels by start mode; the counter caption; trophy button label ("Superliga 2018-19, campeón el 7 de abril de 2019. Ver detalle"); silhouette caption with the window (same season first and last: "en la Superliga 2018-19"); checklist labels with "Ganado (1)" and "Ganado (3)"; `matchHeading` for a final and a league day; `sharedWith` with one and two co-champions ("Compartido con A y B."); `sourceHost` for an `https:` URL and `null` for anything else; the "en obra" lines per shelf; the empty, zero-titles and empty-period lines by start mode. Then `src/lib/vitrina-copy.ts` (reusing `formatMatchDate`, `formatMonthYear`, `joinNames`).
- [ ] **T8 Title notice copy.** Same file: `titleCoverageCopy` for a window covering the period start, a window starting after the period start, a missing season inside the window, a competition with no titles, a window entirely before or after the period, an empty period (hidden); `show` is true for every non-empty period; the included line with zero, one and two competitions; no output contains "complet". Then the function.
- [ ] **T9 View model, part 1.** `tests/unit/lib/vitrina-view.test.ts` on `stats-world`: `since`; `hasAnyTitles` false when the dataset has none; counters; the three shelves in order with trophies chronological and silhouettes after; one trophy per title; a shelf with no loaded competition has the "en obra" line and no silhouettes; the checklist rows (won, missing, unknown). Then the first half of `src/lib/vitrina-view.ts`.
- [ ] **T10 View model, part 2, and privacy.** Same file: the detail (date, heading, `MatchCardView` from `decidingMatch`, `null` match line, shared, source, criterion, `recognized`); `before` (titles before the period, not counted); unrecognized titles apart with `includeUnrecognized`; a catalog miss falls back to the id; the empty period; property test: for 50 random start dates that are not title or match dates, `JSON.stringify(view)` contains none of the four spellings. Then the rest of the module.

### Group C: components (Testing Library, jsdom)

- [ ] **T11 Trophy art.** `tests/unit/components/vitrina/trophy-art.test.tsx`: one SVG per kind (league, cup, international, other), `aria-hidden`, lit uses the gold class, silhouette uses the outline class and no fill; snapshot of the paths so they do not drift. Extend `palette-contrast.test.ts`: gold text and the year on glass and on the glow at 4.5:1; the silhouette outline at 3:1. Then `src/components/vitrina/trophy-art.tsx` (own generic drawings).
- [ ] **T12 Shelf.** `shelf.test.tsx`: `h2` per shelf; lit trophies are buttons with the T7 names and 44 px classes; silhouettes are list items with name, "Te falta" and caption, not focusable; the "en obra" line; the "Compartido" mark; `onOpen(id)` on click and on Enter. Then `shelf.tsx`.
- [ ] **T13 Counters and checklist.** `counters.test.tsx`: both numbers with their labels and the caption; `checklist.test.tsx`: one row per competition with text plus icon for each status. Then `counters.tsx` and `checklist.tsx`.
- [ ] **T14 Trophy detail panel.** `trophy-detail.test.tsx`: opens labelled by the season heading, `aria-modal`, focus on the heading, Tab trapped, Escape and "Cerrar" close and return focus to the trophy; shows the date, the heading "La final" or "La última fecha", the `MatchCard`, the no-match line, the shared line, the source link (`rel="noreferrer"`, only for `https:`) and the criterion. Then `trophy-detail.tsx` on `focus-trap.ts`.
- [ ] **T15 Before the period and disputed.** `before-period.test.tsx`: a closed `<details>` "Antes de que llegaras (2)", muted rows with detail buttons, hidden when empty; the "Títulos discutidos" block with criterion and source, hidden when empty. Then the components.
- [ ] **T16 States.** `vitrina-states.test.tsx`: skeleton (`aria-busy`, "Cargando tu vitrina…", `motion-safe:animate-pulse`, same blocks as the layout); no club with the link to `/#elegi-tu-club`; error with "Reintentar"; no titles loaded with the link to `/rivales`; empty period. Then `src/components/vitrina/vitrina-states.tsx`.
- [ ] **T17 `VitrinaScreen` container.** `tests/unit/components/vitrina/vitrina-screen.test.tsx` with the loader mocked, `buildVitrinaView` spied and every `console` method spied: `"unknown"` renders both pending blocks; no choice gives the empty state; a choice shows the skeleton then the content in the D8 order (assert the `h2` sequence); a failing document shows the error and "Reintentar" loads it; the loader was called only with the club id; changing the saved club reloads; opening and closing a detail; `container.innerHTML` and every spy call are free of the start date. Then `src/components/vitrina/vitrina-screen.tsx`.
- [ ] **T18 Page, metadata and budget.** `tests/unit/app/vitrina-page.test.tsx`: the page renders the `h1` "Mi vitrina" and both pending blocks with no `\d{4}-\d{2}-\d{2}`; metadata title "Mi vitrina" and a generic description with no fan data. Then the page (replacing `ComingSoon`). Run `pnpm build`: `/vitrina` static; module scripts of `.next/server/app/vitrina.html` (gzip, `noModule` excluded) at most **20 KB over the 142.8 KB shell baseline** and under 170 KB; no `zod` or `contrastRatio` in its chunks; `/rivales` and `/rivales/[rival]` unchanged within 1 KB. Record it in the verification log.

### Group D: end to end (`tests/e2e/vitrina.spec.ts`, iphone, android, desktop)

Seeding as in `rivales.spec.ts`. Synthetic states use `page.route` on `/api/clubs/<id>` with a fixture `ClubData` (so these tests do not depend on which titles are loaded); the real-data checks run once `data/titles.json` lands. Screenshots go to `test-results/screens/{project}-vitrina-*.png`.

- [ ] **T19 Ready content (fixture document).** A club with two lit titles (one shared, one decided on penalties), one before the period, one pending league and an unloaded international shelf: counters "2" and "1" with labels by start mode; shelves in order; "Te falta" with the window caption; the "en obra" line; the notice with "Tu vitrina puede estar incompleta", "Contamos títulos de:" and the cups line; **no `/complet[ao]|toda la historia/i`**; "Antes de que llegaras (1)" closed (screenshots `-ready`, `-ready-full`). Phones: one column, no horizontal scroll at 390 and 412 px; desktop: the two columns with the sidebar.
- [ ] **T20 Trophy detail.** Tap or Enter on a trophy: the panel with "Campeón el …", "La final", the score, "Ganaste … por penales", "Compartido con …", "Fuente: …" and the criterion; Escape closes and focus returns to the trophy (screenshot `-detail`, bottom sheet on phones, side panel on desktop).
- [ ] **T21 States.** No saved club: empty state without skeleton flash; document held: skeleton with `aria-busy` (screenshot `-loading`); document 500: error, then "Reintentar" recovers (screenshot `-error`); a document with no titles at all: "Todavía no cargamos los títulos" and no counters (screenshot `-no-titles`); onboarding to `/vitrina` lands on the content (the `onboarding.spec.ts` flow still passes).
- [ ] **T22 Real data (after `data/titles.json`).** River from `1990-05-20`: the lit first-division titles of the window equal T6, the Primera División window line, Copa de la Liga under "Sin datos todavía" until its titles load (screenshot `-river`). A club with none in the window: the "limpita" line (screenshot `-zero`).
- [ ] **T23 Privacy, accessibility and footer.** During T19 to T22: every request URL, body and `document.cookie` free of the four spellings of the start date; the only data request is `GET /api/clubs/<club>` without query; no console message has the date; every button and link of the screen at least 44 x 44 on phones; reduced motion makes the skeleton duration under 0.01 s; the footer has the credits and the version. `layout.spec.ts`, `footer.spec.ts`, `security-headers.spec.ts`, `onboarding.spec.ts`, `rivales.spec.ts` and `rivalry.spec.ts` stay green.

### Group E: close

- [ ] **T24 Docs.** `docs/methodology.md`: title coverage (window, missing seasons, decided seasons), the amended pending rule, titles before the period, co-champions, and a "Vitrina (UI)" note (counters and caption, "desde que naciste" by start mode, never a complete badge, unloaded cups are never silhouettes, the notice lines, before-the-period titles not counted). ADR 0018 gets a pointer to ADR 0021; ADR 0021 to Accepted with Diego's answers. Check `/privacidad` still matches (one public club id is requested). This plan: "Decisions recorded", verification log, `status: done`.

## Copy (Spanish, voseo; D11)

| Where                      | Text                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page title (metadata)      | Mi vitrina                                                                                                                                                             |
| Description (metadata)     | Los trofeos que ganó tu club desde que sos hincha, y los que todavía te faltan.                                                                                        |
| `h1` / sub-line            | Mi vitrina / {Club} · desde {mes} de {año}                                                                                                                             |
| Counter 1                  | Trofeos ganados desde que naciste ("desde que sos hincha" when the start is not the birth date)                                                                        |
| Counter 2                  | Trofeos que te faltan                                                                                                                                                  |
| Counter caption            | En los torneos y temporadas que tenemos cargados.                                                                                                                      |
| Shelves                    | Internacionales · Locales · Otros                                                                                                                                      |
| Trophy button name         | {temporada}, campeón el {fecha}. Ver detalle                                                                                                                           |
| Shared mark                | Compartido                                                                                                                                                             |
| Silhouette                 | {competencia} · Te falta · No lo ganaste entre {primera temporada} y {última temporada}. (one season: "No lo ganaste en {temporada}.")                                 |
| En obra, international     | Todavía no cargamos Libertadores, Sudamericana ni las otras copas internacionales. La vitrina está en obra.                                                            |
| En obra, other             | Todavía no cargamos supercopas ni otros trofeos.                                                                                                                       |
| Checklist heading and rows | Tu checklist · Ganado ({n}) · Te falta · Sin datos todavía                                                                                                             |
| Zero titles in the period  | Todavía no levantaste ninguna copa desde que naciste. La vitrina está limpita y con lugar de sobra. ("desde que sos hincha")                                           |
| No titles loaded           | Todavía no cargamos los títulos / Cuando lleguen, tu vitrina se arma sola. Mientras tanto, mirá cómo te fue contra cada rival. / Ver rivales                           |
| Empty period               | Tu historia todavía no empezó / Cuando empiece, acá van a ir las copas.                                                                                                |
| Before the period          | Antes de que llegaras ({n}) / Los festejó tu club antes de que te hicieras hincha. No suman a tu vitrina, pero son parte de la historia.                               |
| Disputed                   | Títulos discutidos / No los contamos: no están reconocidos por la AFA.                                                                                                 |
| Notice heading and lead    | Tu vitrina puede estar incompleta / Mostramos solo los títulos que tenemos cargados.                                                                                   |
| Notice lines               | {Competencia}: tenemos los campeones de {primera} a {última}. · {Competencia}: nos falta el campeón de {temporada}. · {Competencia}: todavía no tenemos sus campeones. |
| Included line              | Contamos títulos de: {competencias}. / Todavía no cargamos títulos.                                                                                                    |
| Criterion                  | Contamos solo títulos reconocidos por la AFA. Un título compartido cuenta entero para cada campeón.                                                                    |
| Detail                     | Campeón el {fecha} · La final · La última fecha · No tenemos cargado el partido que lo definió. · Compartido con {clubes}. · Fuente: {sitio} · Cerrar                  |
| Loading (screen reader)    | Cargando tu vitrina…                                                                                                                                                   |
| No club                    | Todavía no elegiste tu club / Elegí tu club y desde cuándo sos hincha para armar tu vitrina. / Elegir mi club                                                          |
| Error                      | No pudimos abrir tu vitrina / Se nos cortó la transmisión. ¿Probamos de nuevo? / Reintentar                                                                            |

Dates on this screen are title and match dates (public facts, shown in full) or the month and year of the period start (ADR 0018 note).

## Tests to write (summary)

- **Unit, domain (100% branches):** `club-data` (titles shared), `titles` (`titleCoverage`, amended `pendingTitles`, `titlesBeforePeriod`, `coChampions`).
- **Unit, lib (100% branches):** `vitrina-copy`, `vitrina-view` (with the privacy property test), `club-data-client` (title guard), extended `palette-contrast`.
- **Unit, app:** the page and its metadata; the club data route (titles, sizes).
- **Component (jsdom):** trophy art, shelf, counters, checklist, trophy detail (focus trap), before-the-period and disputed blocks, states, `VitrinaScreen`.
- **Integration (real data):** slice equivalence for the title functions; golden values once titles land.
- **E2E (390x844, 412x915, 1280x800):** `vitrina.spec.ts` (T19 to T23) with screenshots `-ready`, `-ready-full`, `-detail`, `-loading`, `-error`, `-no-titles`, `-river`, `-zero`; existing specs green.
- **Edge cases:** no title in the dataset; titles loaded but none for the club; a title awarded on the start date (counts) and the day before (before the period); a shared title (both clubs, co-champion named; counts fully); two titles in one season of different competitions; a title whose deciding match is not loaded (`null`); a league title decided by a final with penalties (the 2025 knockout format); an administrative result as the deciding match (marked); a competition with seasons but no champions (Copa de la Liga today: unknown, never a silhouette); a decided season missing its champion inside the window; an ongoing season (not missing); a period starting before the window (notice line, silhouette captioned with the window); a period starting after the window ends (unknown, no silhouette); an empty period; an unrecognized title (apart, not counted); a source that is not `https:` (plain text); a catalog miss for a co-champion (id fallback); many titles (River: wrapping grid, no horizontal scroll); accented names; Buenos Aires midnight for "today"; storage blocked; saved date invalid; changing the saved club while the screen is mounted; the route hidden and shown by `<Activity>` (the document is not reloaded).

## Impact

- **Data:** no file written by this plan. It reads `data/titles.json` once plan 0017 writes it (D10). No Supabase.
- **Data contract:** every club document carries the whole titles table (ADR 0021); about 2 KB gzip more with titles from 1985-86, measured in T2.
- **Design:** new components under `src/components/vitrina/` and own generic trophy SVGs; gold stays reserved for trophies (ADR 0007); the silhouette outline and gold text join the palette contrast test. No new tokens, fonts or `motion`.
- **Security and privacy:** one public club id requested, no query or body; the start date stays in memory and the view returns only a month and year (property test); external source links use `rel="noreferrer"` and only `https:`; CSP unchanged (links are navigations, not fetches). Nothing is logged.
- **Performance:** the engine part is a few hundred bytes gzip; the route's client code is capped at 20 KB gzip over the shell (T18); the document is usually already cached from onboarding or `/rivales`.

## Risks and mitigation

- **Titles not loaded when the screen is ready.** Mitigation: D10 (merge after `data/titles.json`); the "no titles" state exists anyway; T2 and T6 are explicitly blocked, the rest builds on fixtures.
- **False "te falta".** A silhouette for a club that won the competition outside our data. Mitigation: ADR 0021 decision 3 (window-scoped silhouettes with the window in the caption, unknown otherwise), unit tests and the T22 real-data check.
- **A season missing in the middle of a window** is invisible to the derivation. Mitigation: plan 0017's config and inventory checks load whole runs; a note in the methodology.
- **Title data errors** (a wrong champion or `awarded_on`). Mitigation: plan 0017 checks the champion list against the final table, the data auditor recomputes T6, every detail shows the source.
- **Disputed titles** (the 2025 "Anual LPF" for Rosario Central). Mitigation: not loaded (plan 0017 D5); the criterion line is always visible; a schema field for a per-title criterion is a separate data-model issue if Diego decides to load it.
- **Copy that shames small clubs.** Mitigation: hopeful tails on every "zero" line; UI auditor review; D11.
- **The focus trap on a sheet** (scroll lock and iOS Safari). Mitigation: reuse the tested info menu pattern; T20 on the iphone project.
- **JS budget.** Mitigation: T18 measures and caps it; no new dependency.

## How to verify it is finished

- Each acceptance criterion maps to passing tests: lit trophies grouped in three shelves and silhouettes (T3, T4, T9, T12, T19, T22); the two counters (T7, T13, T19); the detail with date, final, rival and score (T5, T10, T14, T20); criterion and source for disputed titles (T7, T10, T14, T15, T20).
- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/domain`, `src/data-model`, `src/lib`), `pnpm data:validate`, `pnpm build` (`/vitrina` static and within budget) and `pnpm e2e` on the three projects are green.
- No "complete" text on the screen (T8, T19); the start date in no request, log or DOM attribute beyond the month and year (T10, T17, T23).
- Screenshots of the three projects attached to the PR.
- ADR 0021 accepted; D1 to D11 recorded here; the methodology updated.

## Decisions recorded

Diego approved D1 to D11 as recommended on 2026-10-24. Built with two small changes found while testing: when only one season has its champion loaded the notice says "tenemos el campeón de X" instead of a range "de X a X", and the silhouettes use the muted color of the palette (the `--line-strong` outline did not reach 3:1 over the glow), with a muted filled trophy for titles from before the fan arrived so they cannot be mistaken for a silhouette.

## Verification log

(Filled by the build.)

- 2026-10-24: `pnpm test` with 100% branches in `src/**`; `vitrina-golden.test.ts` on the real data (River, Boca, Banfield, Racing) checked by hand against `data/titles.json`; `tests/e2e/vitrina.spec.ts` green on the three projects with a synthetic document and with the real data.
