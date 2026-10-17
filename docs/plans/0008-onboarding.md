---
issue: 40
status: pending
date: 2026-10-16
---

# Plan 0008: Onboarding with club theming

Related ADRs: [0005](../adr/0005-no-official-crests.md) (generic SVG crests), [0007](../adr/0007-visual-identity-lawn-neon.md) (tokens, AA, club theming slot), [0008](../adr/0008-shell-polish-floating-panel-info-menu.md) (shell, single footer), [0012](../adr/0012-club-identity-aliases-colors.md) (colors, aliases, `foldName`), [0013](../adr/0013-club-theming-and-onboarding-storage.md) (new, this plan: accent derivation, no-flash theming, storage, start date privacy).

## Goal

The first screen the fan sees. On `/` the hero stays, followed by step 1 "Elegí tu club" (a grid of generic SVG crests with a search box) and step 2 "¿Desde cuándo sos hincha?" (birth date by default, or another date), then the CTA "Ver mi historia". The CTA saves the club and the start date in `localStorage` and goes to `/vitrina` (still a placeholder). The accent of the whole app takes the club colors with AA contrast, with no flash on first paint. A returning visitor sees their club and a way to change it.

## Acceptance criteria (copied from issue #40)

- Given the onboarding, when it loads, then a grid of club crests is shown with a search box.
- Given a search term, when typed, then the grid filters clubs by name, short name and aliases.
- Given a selected club, when the fan chooses a start date (birth date or another date), then both are saved in localStorage inside try and catch.
- Given localStorage is unavailable or throws, when saving, then the app does not crash and continues.
- Given a selected club, when the theme is applied, then accent colors adapt to the club and text keeps AA contrast, verified by a test reusing src/lib/contrast.ts.
- Given the start date, when navigating or sending analytics, then it never appears in a URL or analytics event.
- Given the UI, when rendered, then copy is Spanish rioplatense with voseo.

Out of scope (from the issue): real crests or brands; login or persistent profile (Stage 2, #19); vitrina, rivales and compare screens. Input validation in route handlers is #43 (this plan provides the shared pure rule it will reuse). Analytics is #16 (no event is sent here). Lighthouse and bundle budgets are #18.

## Approval status (2026-10-16)

Diego answered explicitly: **item 1** (the accent color table per club: Boca light blue and not gold, Rosario Central blue, San Lorenzo and Tigre light blue, Lanús rose, Platense tan, Central Córdoba and Riestra white, all red clubs one coral) is APPROVED; **item 4** (returning visitor) is APPROVED as the banner on `/` with a button to go to their history and another to change the club. Items 2, 3, 5, 6, 7 and 8 were left as recommended by this plan and will be reviewed on the live site.

## Approval needed from Diego (product and visual decisions only)

Tasks T1 to T12 do not depend on these answers (they are pure logic, tests and plumbing). T13 to T17 use the recommended option until Diego answers; changing an answer later only changes constants or copy.

1. **Accent color per club** (table below). Rule: the first real color (not white or black) among primary, secondary, tertiary, lightened only as much as AA needs, hue kept. Points to look at:
   - **Boca** gets a light blue (`#83a0d8`), not gold: ADR 0007 reserves gold for trophies, and a gold accent would make every link look like a title. Alternative: gold accent for Boca only, accepting the clash.
   - **Rosario Central** gets light blue (`#719dff`), not yellow (same rule: primary first). Alternative: yellow.
   - **San Lorenzo and Tigre** get light blue (navy lifted), not red. Alternative: red (`#ff6f64`).
   - **Lanús** becomes a rose (`#e67f94`) and **Platense** a tan (`#c49677`): the lifted granate and brown. Alternative: white.
   - **White-first clubs** (River, Huracán, Barracas, Vélez, Gimnasia, Platense) use their second color. **Black and white clubs** (Central Córdoba, Riestra) get a white accent.
   - All the reds share one coral (`#ff6f64`), all the celestes one blue: the palette of ADR 0012 is shared on purpose.
2. **Crest initials rule** (table below): for names of two or more words, the first letter of each word except "de", "del" and "y", up to 4 letters (`BJ`, `ELP`, `GELP`, `SMSJ`, `NOB`); for one-word names, the first 3 letters (`BAN`, `TIG`, `HUR`). Alternative: one letter for one-word names (ambiguous: Banfield and Belgrano are both `B`).
3. **Crest look**: a generic shield, the pattern of the shirt in the body (stripes, hoops, sash from top left to bottom right, halves, solid), a top band (chief) in the primary color with the initials, outline in the tertiary color (or the secondary). `other` (single band shirts like Boca, Gimnasia, Platense, Tigre, Vélez) is drawn as a horizontal chest band until #49 adds a `band` pattern.
4. **Returning visitor**: a "¡Volviste!" banner on `/` with their crest, "Ver mi historia" and "Cambiar club o fecha", instead of an automatic redirect to `/vitrina`. Issue #15 says "goes straight to their history"; a redirect would make "Inicio" in the nav unreachable. Recommended: banner now, revisit when the vitrina exists.
5. **Theme preview**: the accent changes as soon as a crest is selected (live preview), and goes back to the saved club (or lime) if the fan leaves without pressing the CTA. Alternative: change the accent only after "Ver mi historia".
6. **Home layout**: the "Muy pronto" card is removed. Desktop: the hero on top, then step 1 (grid, two thirds) and step 2 with the CTA (one third, sticky). Mobile: everything stacked, the CTA in the flow after step 2 (not fixed, so it never fights with the bottom bar).
7. **Storage failure message**: when the browser blocks storage, navigate anyway and say nothing (recommended), or show "No pudimos guardar tu elección en este dispositivo. La vas a tener que elegir de nuevo la próxima vez." for a few seconds before navigating.
8. **Copy**: the strings in "Copy (Spanish)" below.

### Accent per club (computed with the prototype of the algorithm, to be pinned by T5)

Ratios are the minimum over the six accent surfaces; accent-contrast is `#0a1a00` for all 29 clubs (6.6:1 or more on the accent).

| Club(s)                                                                                      | Base color                | Accent    | Min ratio |
| -------------------------------------------------------------------------------------------- | ------------------------- | --------- | --------- |
| Aldosivi, Defensa y Justicia                                                                 | `#ffd60a` amarillo        | `#ffd60a` | 8.24      |
| Argentinos, Barracas, Estudiantes, Huracán, Independiente, Instituto, Newell's, River, Unión | `#d62828` rojo            | `#ff6f64` | 4.60      |
| Atlético Tucumán, Belgrano, Racing                                                           | `#3b94e0` celeste intenso | `#4da5f2` | 4.64      |
| Banfield, San Martín SJ, Sarmiento                                                           | `#1a9850` verde           | `#41b46a` | 4.63      |
| Boca, Gimnasia, San Lorenzo, Talleres, Tigre                                                 | `#0b1f4d` azul marino     | `#83a0d8` | 4.62      |
| Godoy Cruz, Rosario Central, Vélez                                                           | `#1d4ed8` azul            | `#719dff` | 4.60      |
| Lanús                                                                                        | `#7b1e3a` granate         | `#e67f94` | 4.62      |
| Platense                                                                                     | `#6b4226` marrón          | `#c49677` | 4.63      |
| Central Córdoba, Deportivo Riestra                                                           | `#ffffff` blanco          | `#ffffff` | 10.92     |

Hue drift is at most 1.4 degrees (Platense); red and blue lose some chroma to stay in the sRGB gamut. With the club glow, the worst text token is `--loss` at 4.81:1 and `--muted` at 5.13:1, so no other token changes.

### Initials (rule of item 2)

ALD, AJ, AT, BAN, BC, BEL, BJ, CC, DJ, DR, ELP, GELP, GC, HUR, IND, INS, LAN, NOB, PLA, RC (Racing), RP, RC (Rosario Central), SL, SMSJ, SAR, TAL, TIG, UNI, VS.

## Approach

### Data flow (no Supabase, no client fetch)

- `src/lib/club-catalog.server.ts` (`import "server-only"`) imports `data/clubs.json` at build time, parses it with `clubSchema` (zod stays on the server), and exports at module scope (computed once, per the Next 16 "predictable values" rule, so the route stays prerendered):
  - `CLUB_OPTIONS: ClubOption[]`, the minimal serializable list for the client: `{ id, name, shortName, searchKeys, crest: { pattern, primary, secondary, tertiary?, initials, initialsInk } }`. No `source`, `city`, `founded`. About 29 x 200 bytes, roughly 6 KB raw and under 2 KB gzip in the RSC payload: small enough to send whole, so no pagination or lazy loading.
  - `CLUB_THEME_CSS: string`, the per-club rules (ADR 0013, item 2).
- `src/app/page.tsx` (Server Component) renders the hero and `<Onboarding clubs={CLUB_OPTIONS} />` (Client Component). The grid is server-rendered with all clubs, so it shows before JavaScript loads.
- `src/app/layout.tsx` renders `<head>` with `<style>{CLUB_THEME_CSS}</style>` and the boot `<script>`, and `<html suppressHydrationWarning>`.
- Client modules never import `contrast.ts`, `club-theme.ts`, zod or the JSON: derivation happens on the server, the client only sets `data-club`.

### Pure modules (all `.ts`, 100% branch coverage)

| Module                      | Exports                                                                                                                               | Notes                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data-model/dates.ts`   | `isRealIsoDate` (moved from `src/domain/period.ts`, now exported)                                                                     | `period.ts` imports it; behavior unchanged.                                                                                                                                                                         |
| `src/domain/start-date.ts`  | `START_DATE_MIN = "1880-01-01"`, `validateStartDate(value, now)`                                                                      | Returns `{ ok: true, date }` or `{ ok: false, error: "empty" \| "format" \| "not_a_date" \| "too_early" \| "future" }`. Error values never contain the input. Same bounds as the database. Reused by #43.           |
| `src/lib/oklch.ts`          | `hexToOklch`, `oklchToHex`                                                                                                            | OKLab matrices (Björn Ottosson); `oklchToHex` bisects chroma down to the sRGB gamut. No dependency.                                                                                                                 |
| `src/lib/club-theme.ts`     | `ACCENT_TARGET = 4.6`, `accentSurfaces`, `minAccentRatio`, `pickAccentBase`, `liftToContrast`, `accentContrastFor`, `deriveClubTheme` | Algorithm in ADR 0013, item 1. Throws only on impossible input (a color that cannot reach the target even as white), which the dataset test proves never happens.                                                   |
| `src/lib/club-theme-css.ts` | `clubThemeCss(themes)`, `themeBootScript()`, `CLUB_SLUG`                                                                              | Throws if an id is not a slug or a color is not a 6-digit hex (no CSS injection from data). The script is a constant string with no interpolated data except the storage key.                                       |
| `src/lib/fan-storage.ts`    | `FAN_STORAGE_KEY`, `getBrowserStorage`, `readFanChoice`, `writeFanChoice`, `clearFanChoice`, `subscribeFanChoice`                     | Never throws. Storage is injected (`Storage \| null`); memory fallback when writes fail; listeners notified on write (the `storage` event only fires in other tabs). Hand-written type guard, no zod on the client. |
| `src/lib/club-search.ts`    | `searchFold`, `searchClubs(options, query)`                                                                                           | Ranking below.                                                                                                                                                                                                      |
| `src/lib/club-options.ts`   | `clubInitials(name)`, `initialsInk(primary)`, `toClubOption(club)`                                                                    | `initialsInk` picks `#ffffff` or `#0a1a00`, whichever contrasts more on the primary (ADR 0012 guarantees one reaches 4.5:1). Runs on the server only (uses `contrast.ts`).                                          |
| `src/lib/crest.ts`          | `CREST_VIEWBOX`, `SHIELD_PATH`, `crestShapes(spec)`                                                                                   | Geometry as data: list of rects and polygons with fills, chief, outline, initials font size by length (1 to 2 letters 26, 3 letters 22, 4 letters 17, in a 100 x 120 viewBox).                                      |
| `src/lib/club-theme-dom.ts` | `applyClubTheme(root, clubId \| null)`                                                                                                | Sets or removes `data-club` after checking `CLUB_SLUG`.                                                                                                                                                             |

Search ranking (`searchClubs`): the query and each key are folded with `foldName` (case, accents, spaces) and then stripped of `.` `'` `’` (`searchFold`), so "velez", "newells", "atl tucuman" and "Atl. Tucumán" all work. Keys are name, short name and aliases. Score per club is the best over its keys: 0 exact, 1 key starts with the query, 2 a word of the key starts with the query (words split on spaces, hyphens and parentheses), 3 the key contains the query; no match is excluded. Ties keep dataset order (alphabetical by name). An empty or blank query returns every club in dataset order. Example: "central" ranks Rosario Central first (short name "Central", exact), then Central Córdoba, then Barracas Central.

### Components

- `src/components/crest.tsx`: pure, no `"use client"`, no state; uses `useId` for the clip path id (two crests of the same club on one page do not clash). `aria-hidden` by default (the name is always next to it); `title` prop renders `role="img"` with a label when used alone.
- `src/components/onboarding/club-picker.tsx` (client): `<fieldset>` with `<legend>` "Elegí tu club"; a labelled `type="search"` input; a live region (`aria-live="polite"`) with the result count; the grid is a native radio group (`<input type="radio" name="club">` visually hidden inside a `<label>` with the crest and the short name), so Tab enters the group and arrow keys move, with screen reader semantics for free. Each tile is at least 44 x 44 px (in practice about 104 x 96 at 390 px); the focus ring is drawn on the tile with `has-[:focus-visible]`; the selected tile has an accent border, the 12% tint and a check icon (not color alone). When the name differs from the short name, the label adds the full name as visually hidden text (accessible name contains the visible text, WCAG 2.5.3). Empty state with a "Ver todos los clubes" button that clears the search and returns focus to it. Grid: 3 columns below 640 px, 4 from `sm`, 5 from `lg`, 6 from `xl`.
- `src/components/onboarding/start-date-step.tsx` (client): `<fieldset>` "¿Desde cuándo sos hincha?" with two radios ("Desde que nací", default, and "Desde otra fecha") and one native `<input type="date">` whose label follows the mode. **No `name` attribute on the date input.** `min="1880-01-01"`; `max` is set after mount (`todayInBuenosAires(new Date())` in an effect, never during render, because Cache Components rejects `new Date()` while prerendering). Validation on blur and on submit with `validateStartDate`; error text linked with `aria-describedby`, `aria-invalid` on the input. The value is kept only in React state.
- `src/components/onboarding/onboarding.tsx` (client): owns club, mode and date state; reads the saved choice with `useSyncExternalStore` (server snapshot `null`, client snapshot the raw string, parsed with `useMemo`), so hydration matches and a returning visitor sees the banner right after hydration. The banner slot reserves its height only when the boot script found a saved club (`html[data-club] .returning-slot { min-height }`), to avoid layout shift. Live preview: selecting a club calls `applyClubTheme`; an effect cleanup restores the saved club (or none) when the route is hidden or unmounted (with Cache Components the route stays mounted in a hidden `<Activity>` and effects are cleaned up and re-run). Submit: `preventDefault`, validate club then date, move focus to the first error, `writeFanChoice`, `router.push("/vitrina")` with no query string. No `console` call anywhere in the flow.
- `src/components/club-theme-sync.tsx` (client, in the layout): `useLayoutEffect` re-applies `data-club` from storage (needed only for the dev Strict Mode remount; a no-op in production).

### Theming and CSS

- `:root` tokens in `globals.css` do not change (the palette test keeps pinning them).
- Hardcoded lime becomes accent-based: body radial glow `color-mix(in srgb, var(--accent) 8%, transparent)`, `.lawn` stripes at 3%, the bottom-nav active glow `shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_8%,transparent)]`. `bg-accent/12` already follows the variable.
- The accent fades between clubs with a 200 ms color transition behind `motion-safe:`; the global reduced-motion rule also neutralizes it.

### Discarded alternatives

- **Cookie with the club id read by the server.** `cookies()` in the root layout makes every segment block on the request under Cache Components; wrapping the theme in Suspense would still paint the default first. A cookie read by the inline script works, but is equivalent to `localStorage` while sending the id to the server on every request for nothing.
- **Client-only theme in `useEffect`.** Paints lime, then the club color (the flash the issue forbids). `useLayoutEffect` alone still flashes before hydration on slow networks.
- **Inline script with a color map that sets `style.setProperty`.** Works, but puts color logic in an untested string; a `data-club` attribute plus static CSS keeps the script to one attribute.
- **Computing the theme in the browser.** Ships `contrast.ts` and the OKLCH code to every visitor for a result that is fixed at build time.
- **HSL lightening or mixing with white.** Simpler math, but blue drifts toward violet and red toward pink; OKLCH keeps the hue the eye sees.
- **Choosing the accent from the primary color only.** White-first clubs (River, Vélez, Huracán) would all get a white accent with no club feeling.
- **A combobox or listbox widget for the grid.** Needs custom roving focus and ARIA; native radios give keyboard and screen reader support with no script.
- **A date picker library or three selects (day, month, year).** New dependency or more code; the native date input is comfortable on iOS and Android and accessible.
- **Passing the choice to `/vitrina` in the URL.** Forbidden for the date; the club alone in the URL is not needed yet.
- **zod on the client for the storage record.** Adds weight to the first-load bundle for a four-field guard.

## Tasks

Test first in every task: write the failing test, then the code. Each task is one hour or less. Run `pnpm test` (and `pnpm e2e` for group D) before checking it off.

### Group A: pure foundations

- [x] **T1 `isRealIsoDate`.** Tests in `tests/unit/data-model/dates.test.ts`: `2024-02-29` true, `2023-02-29` false, `2026-13-01` false, `2026-00-10` false, `16/10/2026` false, `2026-1-1` false, `""` false. Move the function from `src/domain/period.ts` to `src/data-model/dates.ts` and import it in `period.ts`; `tests/unit/domain/period.test.ts` passes untouched.
- [x] **T2 `validateStartDate`.** `tests/unit/domain/start-date.test.ts`, with `now = 2026-10-16T02:30:00Z` (today in Buenos Aires is `2026-10-15`): `""` and `"   "` give `empty`; `"15/10/2026"` gives `format`; `"2023-02-29"` gives `not_a_date`; `"1879-12-31"` gives `too_early`; `"1880-01-01"` ok; `"2026-10-15"` ok; `"2026-10-16"` gives `future` (and ok with `now = 2026-10-16T03:00:00Z`); leading or trailing spaces are trimmed; no error result contains the input string (`JSON.stringify(result)` does not include it). Then `src/domain/start-date.ts`. Add the rule to `docs/methodology.md` (one line under "Fan period").
- [x] **T3 OKLCH helpers.** `tests/unit/lib/oklch.test.ts`: `#ffffff` gives L 1, C about 0; `#000000` gives L 0; `#ff0000` gives L 0.628, C 0.258, H 29.2 (3 decimals); round trip of every `CLUB_PALETTE` hex within 1 unit per channel; an out-of-gamut request (L 0.9, C 0.3, H 29) returns a valid hex with the same hue within 1 degree and lower chroma; values are clamped to `#000000` to `#ffffff`. Then `src/lib/oklch.ts`.
- [x] **T4 Theme derivation.** `tests/unit/lib/club-theme.test.ts` with synthetic colors: `pickAccentBase` takes the primary when chromatic, the secondary when the primary is white or black, the tertiary when only it is chromatic, the lightest when all are neutral; `liftToContrast` returns a passing color unchanged, lifts a dark red to a lighter red with hue drift under 5 degrees and minimum ratio at least 4.6 and below 4.8 (smallest lift), and throws for a target no color can reach (for example 25); `accentContrastFor` returns `#0a1a00` for a light accent and `#ffffff` for a mid-dark fixture accent (direct call with a custom surface set is allowed for this branch), and throws when neither reaches 4.5; `accentSurfaces` returns the six surfaces with the glow and tint mixed from the given accent. Then `src/lib/club-theme.ts`. Update the header comment of `src/lib/contrast.ts` (now also used at build time on the server).
- [x] **T5 Dataset contrast.** `tests/unit/lib/club-theme-contrast.test.ts`, reading `data/clubs.json` and `globals.css` like `clubs-contrast.test.ts`: for every club, `deriveClubTheme` gives an accent at 4.5:1 or more on all six surfaces (with that club's glow and tint), `--accent-contrast` at 4.5:1 on the accent, the accent at 3:1 or more for the focus ring; `foreground`, `muted`, `gold`, `win`, `even`, `loss` at 4.5:1 on the worst surface with that club's glow; hue drift under 5 degrees for chromatic bases; and an exact snapshot of `{ id: accent }` for the 29 clubs (pins the approved table, so a palette change shows up in review).
- [x] **T6 CSS and boot script.** `tests/unit/lib/club-theme-css.test.ts`: `clubThemeCss` emits one `html[data-club="id"]{--accent:#…;--accent-contrast:#…}` rule per club, in input order; throws on an id like `x"]{}body{` and on a color like `red`. Boot script (`// @vitest-environment jsdom`, evaluated with `new Function`): valid record sets `data-club`; no record, invalid JSON, wrong shape, non-slug id (`"a b"`), and a `localStorage` getter that throws all leave no attribute and do not throw. Then `src/lib/club-theme-css.ts`.
- [x] **T7 Storage wrapper.** `tests/unit/lib/fan-storage.test.ts` with an in-memory `Storage` fake: write then read round trip; read returns `null` for missing key, invalid JSON, `v` not 1, unknown club id, invalid or future date, unknown `startMode`; `getItem` throwing gives `null`; `setItem` throwing (quota) returns `false`, keeps the value in memory and the next read returns it; `null` storage works the same way; `getBrowserStorage` returns `null` when the `window.localStorage` getter throws; `clearFanChoice` removes both; `subscribeFanChoice` listeners fire on write and clear and stop after unsubscribe. Then `src/lib/fan-storage.ts`.
- [x] **T8 Club search.** `tests/unit/lib/club-search.test.ts` on a small fixture plus the real dataset: empty and blank queries return all in order; "VELEZ", "vélez", "velez" find Vélez; "newells" and "newell's" find Newell's; "atl tucuman" finds Atlético Tucumán; "central" ranks Rosario Central, Central Córdoba, Barracas Central; "la plata" finds Estudiantes and Gimnasia; "san" ranks San Lorenzo and San Martín before Unión (alias "Unión de Santa Fe"); "zzz" returns `[]`; ties keep input order. Then `src/lib/club-search.ts`.
- [x] **T9 Club options and initials.** `tests/unit/lib/club-options.test.ts`: `clubInitials` for every row of the initials table, plus apostrophe and accent cases; `initialsInk` gives `#0a1a00` on `#ffd60a` and `#ffffff` on `#0b1f4d`, and its choice reaches 4.5:1 for every club; `toClubOption` keeps only the allowed fields (assert the exact key set, no `source`, `city`, `founded`), dedupes `searchKeys`. Then `src/lib/club-options.ts`.
- [x] **T10 Crest geometry.** `tests/unit/lib/crest.test.ts`: each of the 6 patterns returns the expected layer count and fills (solid 1 layer; stripes primary base and 2 secondary stripes; hoops 2 secondary bands; sash 1 polygon; halves 2 rects; other 1 chest band); outline uses tertiary when present, else secondary; chief fill is the primary and ink is `initialsInk`; font size 26, 22, 17 for 2, 3, 4 letters. Then `src/lib/crest.ts`.
- [x] **T11 Catalog and coverage config.** `tests/unit/lib/club-catalog.test.ts` (with `vi.mock("server-only", () => ({}))`): `CLUB_OPTIONS` has 29 entries in dataset order; the serialized list is under 8 KB (guards bundle growth); `CLUB_THEME_CSS` has 29 rules. Then `src/lib/club-catalog.server.ts`. In `vitest.config.ts` add `"src/lib/**": { branches: 100 }` to the thresholds (every current `src/lib` file is already at 100%, checked on 2026-10-16). Run `pnpm test:coverage`.

### Group B: theming in the shell

- [x] **T12 Accent-based glows.** Extend `tests/unit/lib/palette-contrast.test.ts` so the "worst" surface is computed from `--accent` (still lime by default, same numbers) and add a CSS check that `globals.css` and `nav-links.tsx` no longer contain `198 255 61` outside `:root`. Then replace the hardcoded lime in the body glow, `.lawn` and the active nav glow with `color-mix(… var(--accent) …)`.
- [ ] **T13 Layout head and sync.** Component test `tests/unit/components/club-theme-sync.test.tsx`: with a saved club, mounting sets `data-club` on `document.documentElement`; with storage throwing, nothing happens and nothing throws. Test `applyClubTheme` (`tests/unit/lib/club-theme-dom.test.ts`): sets, replaces, removes, ignores a non-slug. Then `src/lib/club-theme-dom.ts`, `src/components/club-theme-sync.tsx`, and in `src/app/layout.tsx`: `<head>` with the `<style>` and the boot `<script>` (both `dangerouslySetInnerHTML` with constants only), `suppressHydrationWarning` on `<html>`, `<ClubThemeSync />` in `<body>`. Run `pnpm build` (the route list must still show `/` as prerendered static, no new dynamic route).

### Group C: UI

- [ ] **T14 `Crest` component.** `tests/unit/components/crest.test.tsx`: renders an `svg` with the shield path and the initials; `aria-hidden` by default; with `title`, `role="img"` and accessible name; two crests of the same club have different clip path ids; no `<image>` or external `href`. Then `src/components/crest.tsx`.
- [ ] **T15 `ClubPicker`.** `tests/unit/components/club-picker.test.tsx` (user-event): a radio group named "Elegí tu club" with 29 radios; accessible names include the short name and, when different, the full name; typing "velez" leaves one radio and the live region says "1 club"; "zzz" shows the empty state; "Ver todos los clubes" clears the search, shows 29 and focuses the search box; clicking a tile checks it and calls `onSelect(id)`; arrow keys move the selection; the selected club stays selected when filtered out and back. Then `src/components/onboarding/club-picker.tsx`.
- [ ] **T16 `StartDateStep`.** `tests/unit/components/start-date-step.test.tsx`: "Desde que nací" is checked by default and the input label is "Tu fecha de nacimiento"; switching to "Desde otra fecha" changes the label to "¿Desde qué fecha?" and keeps the value; the date input has no `name` attribute and has `min="1880-01-01"`; after mount `max` is today in Buenos Aires (fake timers); blur with a future date shows "Eso todavía no se jugó…", sets `aria-invalid` and links the message with `aria-describedby`; a valid date clears the error. Then `src/components/onboarding/start-date-step.tsx`.
- [ ] **T17 `Onboarding` container.** `tests/unit/components/onboarding.test.tsx` (mock `next/navigation` `useRouter`, spy on every `console` method): submit with no club shows "Primero elegí tu club." and focuses the group; with club and valid date it writes `{ v: 1, clubId, startDate, startMode }` and calls `push("/vitrina")` with no query; with `setItem` throwing it still calls `push` and renders no error; selecting a club sets `data-club` (preview) and unmounting without saving restores the previous value; a saved choice shows the "¡Volviste!" banner with the club name, and "Cambiar club o fecha" moves focus to the search box; no `console` spy was called with the date; the rendered HTML never contains the date outside the input value. Then `src/components/onboarding/onboarding.tsx`.
- [ ] **T18 Home page.** Update `src/app/page.tsx`: hero kept, hero CTA link "Empezá: elegí tu club" to `#elegi-tu-club`, "Muy pronto" card removed, `<Onboarding clubs={CLUB_OPTIONS} />`, desktop layout of approval item 6, `.returning-slot` rule in `globals.css`. Check by hand at 390, 412 and 1280 px with `pnpm build && pnpm start`; `pnpm e2e` existing specs (footer, layout, a11y-shell, info-menu) pass unchanged.

### Group D: end to end (`tests/e2e/onboarding.spec.ts`, all three projects)

- [ ] **T19 Grid, search and keyboard flow.** Grid shows 29 radios and the search box; "velez" filters to one; "zzz" shows the empty state; keyboard only: Tab past the skip link and nav to the hero CTA, Enter jumps to step 1, Tab to the search box, type "racing", Tab into the radio group, Space selects, Tab to the mode radios, Tab to the date input, fill `1990-05-20`, Tab to "Ver mi historia", Enter; URL is exactly `/vitrina`; `localStorage` holds the record; every focused element shows a non-`none` outline. Screenshots `{project}-onboarding-grid.png`, `-search-empty.png`, `-step2-error.png`.
- [ ] **T20 Privacy and resilience.** Listen to `request` and `framenavigated` during the whole flow: no URL, request body (`postData`) or `document.cookie` contains `1990-05-20`, `20/05/1990`, `19900520` or `1990%2D05%2D20`. With `addInitScript` making the `window.localStorage` getter throw: `/` renders the grid, the flow reaches `/vitrina`, no `pageerror` and no console error. With storage that throws only on `setItem`: same. Future date (tomorrow in Buenos Aires) and `1879-12-31` show their errors and stay on `/`.
- [ ] **T21 Theme without flash, returning visitor, touch targets.** Seed the record with `addInitScript` for `river-plate`, block `**/_next/static/chunks/**` (no hydration at all), load `/` and `/rivales`: `html[data-club="river-plate"]` and the computed `--accent` equals `deriveClubTheme` for River (`#ff6f64`); without a record, `--accent` is `#c6ff3d`. With JS allowed: the "¡Volviste!" banner shows "River Plate" and "Cambiar club o fecha" focuses the search box. On iphone and android: every tile, the mode radios, the date input and the CTA are at least 44 x 44. Reduced motion: tile transition duration under 0.01 s. Screenshots `{project}-themed-river.png`, `-themed-boca.png`, `-returning.png`. The existing footer spec still passes on `/` with a saved club.

### Group E: close

- [ ] **T22 Docs.** `docs/methodology.md` (start date rule, T2), ADR 0013 status to Accepted with Diego's answers, this plan's "Decisions recorded" section and `status: done`. Check `/privacidad` copy still matches (it already says the club and start date stay on the device and the birth date never travels in a link or analytics).

## Copy (Spanish, voseo; approval item 8)

Hero (unchanged): "Tu DNI futbolero" · "La historia de tu club ya está escrita." · "La tuya se sigue jugando." · "Elegí tu club, decinos desde cuándo sos hincha y mirá cuántos títulos viviste, a quién tenés de hijo y qué te falta ganar."

| Where                                    | Text                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Hero CTA (link to step 1)                | Empezá: elegí tu club                                                                                  |
| Step 1 kicker                            | Paso 1 de 2                                                                                            |
| Step 1 legend                            | Elegí tu club                                                                                          |
| Search label                             | Buscá tu club                                                                                          |
| Search placeholder                       | Ej.: Racing, Lanús, Newell's                                                                           |
| Live count                               | 1 club · {n} clubes · Ningún club                                                                      |
| Selected chip                            | Elegiste a {short_name}                                                                                |
| Empty state title                        | No encontramos ese club                                                                                |
| Empty state text                         | Probá con otro nombre. Por ahora están los clubes de la Primera División.                              |
| Empty state button                       | Ver todos los clubes                                                                                   |
| Step 2 kicker                            | Paso 2 de 2                                                                                            |
| Step 2 legend                            | ¿Desde cuándo sos hincha?                                                                              |
| Mode 1                                   | Desde que nací                                                                                         |
| Mode 1 hint                              | Contamos tu historia desde el día que naciste.                                                         |
| Mode 2                                   | Desde otra fecha                                                                                       |
| Mode 2 hint                              | El día que te hiciste hincha, tu primera vez en la cancha o la fecha que quieras.                      |
| Date label, mode 1                       | Tu fecha de nacimiento                                                                                 |
| Date label, mode 2                       | ¿Desde qué fecha?                                                                                      |
| Privacy note                             | Tu fecha se guarda solo en este dispositivo. No viaja en ningún link ni se comparte.                   |
| CTA                                      | Ver mi historia                                                                                        |
| Error, no club                           | Primero elegí tu club.                                                                                 |
| Error, empty date                        | Poné una fecha para arrancar.                                                                          |
| Error, not a date                        | Esa fecha no existe. Revisala.                                                                         |
| Error, too early                         | Tan atrás no llegamos: elegí una fecha desde el 1 de enero de 1880.                                    |
| Error, future                            | Eso todavía no se jugó. Elegí una fecha de hoy para atrás.                                             |
| Returning title                          | ¡Volviste!                                                                                             |
| Returning text                           | Sos de {name}. Tu historia te está esperando.                                                          |
| Returning primary                        | Ver mi historia                                                                                        |
| Returning secondary                      | Cambiar club o fecha                                                                                   |
| Storage failure (only if item 7 says so) | No pudimos guardar tu elección en este dispositivo. La vas a tener que elegir de nuevo la próxima vez. |

## Tests to write (summary)

- **Unit (Vitest, node):** `dates` (`isRealIsoDate`), `start-date`, `oklch`, `club-theme`, `club-theme-contrast` (whole dataset, reuses `src/lib/contrast.ts`, satisfies the AA acceptance criterion), `club-theme-css` (with jsdom for the boot script), `fan-storage`, `club-search`, `club-options`, `crest`, `club-catalog`, `club-theme-dom`, extended `palette-contrast`.
- **Component (Testing Library, jsdom):** `crest`, `club-picker`, `start-date-step`, `onboarding`, `club-theme-sync`.
- **E2E (Playwright, iphone 390x844, android 412x915, desktop 1280x800):** `onboarding.spec.ts` (T19 to T21); existing `footer`, `layout`, `a11y-shell`, `info-menu` unchanged and green.
- **Edge cases:** leap day valid and invalid; 1880-01-01 bound; Buenos Aires midnight (02:30Z vs 03:00Z); query with accents, apostrophes, dots, extra spaces; empty results; selected club hidden by the filter; storage getter throwing, `setItem` throwing, corrupt JSON, old or unknown record version, club removed from the dataset (no CSS rule, falls back to lime); white and black clubs; tertiary color (River); returning visitor on a route other than `/`; route hidden by `<Activity>` after navigation (preview restored).

## Impact

- **Data:** none. `data/clubs.json` is read, not changed. No Supabase call, no schema change.
- **Design:** the accent and its glows follow the club on every page; the lime stays the default. New `Crest` component reusable by vitrina and rivales. The home loses the "Muy pronto" card.
- **Security and privacy:** the start date stays in React state and `localStorage` only; the date input has no `name`; no URL parameter, no log, no analytics. Inline style and script are build-time constants; ids and colors are validated before they reach CSS or the DOM. A future CSP needs the script hash (ADR 0013).
- **Performance:** about 2.5 KB of CSS and 0.3 KB of script inlined in every HTML page; the club list adds under 2 KB gzip to the home RSC payload; client code is the onboarding components plus small pure helpers (no new dependency; no `motion` on this screen; icons from `lucide-react` are tree-shaken). The grid is server-rendered, so LCP does not wait for JavaScript. Budgets are enforced by #18.
- **Coverage config:** `src/lib/**` gets a 100% branch threshold.

## Risks and mitigation

- **Hydration warning or lost attribute.** The inline script changes `<html>` before React hydrates. Mitigation: `suppressHydrationWarning` on `<html>` (one level only), `ClubThemeSync` for the dev remount, e2e T21 with hydration blocked.
- **Browser tint differs from the test model.** Tailwind mixes `bg-accent/12` in OKLab while the test composites in sRGB. Mitigation: the 4.6 target leaves 0.1 of margin; T21 screenshots for review.
- **`new Date()` during prerender** fails the build under Cache Components. Mitigation: today is computed only in effects and event handlers; `pnpm build` in T13 and T18.
- **Contrast code leaking into the client bundle.** Mitigation: only `*.server.ts` and the layout import it; check the build output chunks in T18.
- **Layout shift for returning visitors** (banner appears after hydration). Mitigation: the `.returning-slot` reserve keyed on `html[data-club]`.
- **Native date input differences** (iOS shows a wheel, desktop Safari a field, empty string while incomplete). Mitigation: validation treats `""` as empty, messages are ours, e2e uses `fill`.
- **A visual answer from Diego changes accents.** Only constants and the T5 snapshot change.

## Definition of done

- Every acceptance criterion maps to a passing test: grid and search (T15, T19), filtering by name, short name and aliases (T8, T15, T19), saving in try/catch (T7, T17, T19), storage unavailable (T7, T17, T20), AA with `contrast.ts` (T5, T12), date never in URL or analytics (T16, T17, T20; no analytics code is added), Spanish voseo copy (approved table).
- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/domain`, `src/data-model`, `src/lib`), `pnpm build` (`/` still prerendered) and `pnpm e2e` on the three projects are green.
- Screenshots of the three projects attached to the PR.
- ADR 0013 accepted and Diego's answers recorded in this plan.
