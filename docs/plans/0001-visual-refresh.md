---
issue: 13
status: done
date: 2026-10-16
---

# Plan 0001 — Visual refresh: "Césped y neón" palette and desktop sidebar

Related ADR: [0007 — Visual identity "Césped y neón" and responsive app shell](../adr/0007-visual-identity-lawn-neon.md)

## Goal

Refresh the visual identity before Phase 1: new "Césped y neón" palette (very dark forest-green background, electric lime accent, gold kept for trophies, readable win/even/loss), and a real desktop layout with a fixed left sidebar, while mobile keeps its current look and bottom nav with the new palette and becomes visibly distinct from desktop.

## Acceptance criteria (copied from issue #13)

- **Given** the app styles, **when** the new palette is applied, **then** the new design tokens live in `globals.css` and text/UI contrast meets WCAG AA (4.5:1 text, 3:1 large text and UI components), verified and recorded in the PR.
- **Given** a viewport >= 1024px, **when** any route loads, **then** the fixed left sidebar is shown (logo, Inicio/Vitrina/Rivales/Comparar vertical, credits + version at the bottom) and the bottom nav is hidden.
- **Given** a viewport < 1024px, **when** any route loads, **then** the bottom nav is shown and no sidebar is rendered visibly.
- **Given** any route at any viewport, **when** the page renders, **then** the mandatory footer with credits and version is present; the existing e2e tests pass and a new e2e covers a desktop viewport of 1280x800.
- **Given** keyboard navigation, **when** the user tabs through the page, **then** focus is clearly visible, the skip link moves focus to the main content, and the active nav item (sidebar and bottom nav) exposes `aria-current="page"`.
- **Given** `prefers-reduced-motion: reduce`, **when** the user navigates or interacts, **then** non-essential animations/transitions are disabled.
- **Given** the PR, **when** it is opened, **then** it attaches screenshots at 390x844, 412x915 and 1280x800.

Out of scope: club theming logic, new pages.

## Proposed palette (answers open question 1)

Tokens in `src/app/globals.css` `:root` (full table and rationale in ADR 0007):

| Token                 | Value                     |
| --------------------- | ------------------------- |
| `--background`        | `#07140d`                 |
| `--background-raised` | `#0d2318`                 |
| `--foreground`        | `#ecfdf3`                 |
| `--muted`             | `#9db8a9`                 |
| `--glass`             | `rgb(255 255 255 / 0.06)` |
| `--glass-border`      | `rgb(255 255 255 / 0.12)` |
| `--line-strong` (new) | `#5a7a68`                 |
| `--accent`            | `#c6ff3d`                 |
| `--accent-contrast`   | `#0a1a00`                 |
| `--gold`              | `#f5c542`                 |
| `--win`               | `#4ade80`                 |
| `--even`              | `#a8b5ad`                 |
| `--loss`              | `#ff8a8a`                 |

`viewport.themeColor` in `layout.tsx` changes from `#060d1f` to `#07140d` (Next 16 `viewport` export accepts a string; checked in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`).

### Computed WCAG contrast ratios

Computed with a Node script implementing the WCAG 2.x relative-luminance formula (sRGB linearization, `(L1 + 0.05) / (L2 + 0.05)`); sanity check white/black = 21.00. Surfaces are alpha-composited and rounded to 8-bit:

- `background` = `#07140d`
- `raised` = `#0d2318`
- `glassOnBg` = 6% white over background = `#16221c`
- `glassOnRaised` = 6% white over raised = `#1c3026`
- `worst` = 6% white over (8% lime glow over raised) = `#2a4129` (the brightest surface text can sit on)

| Token      | Hex       | background | raised | glassOnBg | glassOnRaised | worst |
| ---------- | --------- | ---------- | ------ | --------- | ------------- | ----- |
| foreground | `#ecfdf3` | 17.86      | 15.67  | 15.56     | 13.27         | 10.55 |
| muted      | `#9db8a9` | 8.85       | 7.76   | 7.71      | 6.57          | 5.23  |
| accent     | `#c6ff3d` | 15.94      | 13.99  | 13.89     | 11.85         | 9.42  |
| gold       | `#f5c542` | 11.61      | 10.19  | 10.12     | 8.63          | 6.86  |
| win        | `#4ade80` | 10.81      | 9.48   | 9.42      | 8.03          | 6.39  |
| even       | `#a8b5ad` | 8.86       | 7.77   | 7.72      | 6.58          | 5.24  |
| loss       | `#ff8a8a` | 8.30       | 7.28   | 7.23      | 6.17          | 4.91  |
| lineStrong | `#5a7a68` | 3.96       | 3.48   | 3.45      | 2.95          | 2.34  |

Other pairs:

- `accent-contrast` on `accent` (skip link, primary buttons): **15.31**; `accent-contrast` on `gold`: **11.16**.
- Active nav item: lime tint 12% over raised = `#233d1c`; `accent` text on it **10.12**, `foreground` on it **11.34**.
- Focus ring (`accent`, 2px) against background **15.94**, against active tint **10.12** (>= 3:1 UI).
- `glass-border` over background: **1.38** — decorative only; never the only cue that identifies a control. Use `--line-strong` for control borders, and only on `background`/`raised` (it fails on glass: 2.95 / 2.34).

Findings that shaped the values:

- With the old `#f87171` loss and a 18% lime glow, loss text dropped to 3.91 (fail). Fix: loss brightened to `#ff8a8a` and decorative glows capped at **8%** lime alpha (at 10% loss on worst is 4.64, at 12% it fails, so 8% leaves headroom).
- Win (`#4ade80`) is close in hue to the lime accent; win/even/loss must always be paired with a letter or label (G/E/P, "Ganados"...), never color alone (WCAG 1.4.1).

## Layout design

DOM order in `src/app/layout.tsx` (single tree, responsive by CSS only):

```
<body>
  <SkipLink/>                       always present, sr-only until focused -> #contenido
  <Header/>                         lg:hidden       (mobile logo)
  <Sidebar/>                        hidden lg:flex  (fixed left, w-64: logo + <NavLinks variant="sidebar"/>)
  <main id="contenido" tabIndex=-1> lg:pl-64, wider max-width on desktop
  <Footer/>                         ONE instance; mobile: below content (pb-28 for the bar); lg: fixed bottom-left, w-64, left-aligned
  <BottomNav/>                      lg:hidden       (<NavLinks variant="bottom"/>)
</body>
```

Key decisions:

- **Exactly one footer.** `<Footer>` is a direct child of `<body>`, never inside the sidebar `nav`/`aside` (a nested `<footer>` loses the `contentinfo` role). On desktop it is positioned into the sidebar column with `lg:fixed lg:bottom-0 lg:left-0 lg:w-64`. So `getByRole("contentinfo")` and `getByTestId("app-version")` each match exactly one element at every viewport, and the existing spec keeps working unchanged.
- **Hidden variant leaves the a11y tree.** Only `display: none` via `hidden lg:flex` / `lg:hidden`. No `opacity-0`, `invisible`, `sr-only` or off-screen tricks. Two `<nav aria-label="Principal">` exist in the DOM but only one is rendered per viewport.
- **No duplicated nav logic.** `src/lib/nav.ts` exports `NAV_ITEMS` (href + label; icons mapped in the component) and the pure `isActiveRoute(pathname, href)`. A single client component `NavLinks` with `variant: "sidebar" | "bottom"` renders both presentations.
- **Sidebar container** is a plain `div` (fixed, `h-dvh`, `bg-raised`, right `line-strong` border) holding the logo link and the `nav`; it reserves bottom padding equal to the footer height and lets the nav area scroll (`overflow-y-auto`) so short desktop viewports do not overlap.
- **Skip link** moves out of `Header` (which is hidden on desktop) into the layout; `<main tabIndex={-1}>` so focus really lands on main (`focus:outline-none` on main only, since it is not an interactive control).
- **Tab order:** skip link -> logo -> nav -> main -> footer links. On desktop the footer sits visually at the sidebar bottom but comes after content; accepted (content first, no CSS `order`).
- **Reduced motion:** keep the global `prefers-reduced-motion` rule; new hover/active transitions use `motion-safe:transition-*`.
- **Server/client:** `layout.tsx`, `Header`, `Sidebar` shell and `Footer` stay Server Components; only `NavLinks` is `"use client"` (needs `usePathname`), as `BottomNav` is today.

## Open question 2: what makes mobile visibly distinct — APPROVED by Diego: option 1

Options (all keep the current mobile structure and bottom nav):

1. **"Tribuna vs. palco" (recommended).**
   - Mobile: floating glass bottom bar with a lime glow under the active item and a pill indicator; compact header; home hero in large display type with a subtle mowed-lawn stripe background; full-bleed cards with big radius (`rounded-3xl`), glass surfaces.
   - Desktop: solid `raised` sidebar (no glass), flatter content surfaces with smaller radius (`rounded-xl`), wider container (`max-w-6xl`) and a two-column content grid utility (`lg:grid-cols-[2fr_1fr]`) ready for Phase 1 pages; lawn stripes only as a faint texture on the sidebar.
   - Why: clear difference in silhouette (floating bar + glass + big radius vs. docked rail + flat + tight radius) at low cost, tokens shared.
2. **"Cancha".** Mobile gets a pitch line-art header (center circle / touchline motif) and striped lawn background on every page; desktop stays plain dark green. Most "football" feel, but more SVG work and risk of visual noise behind text (needs contrast re-check per stripe).
3. **"Densidad".** Same surfaces everywhere; only navigation and density differ (mobile larger type and spacing, desktop denser). Cheapest, but the difference may feel like "just a sidebar", which is what Diego wants to avoid.

Recommendation: **Option 1**. Tasks 9-10 implement it and are **blocked until Diego approves** (or picks another option); tasks 1-8 do not depend on this choice.

## Discarded alternatives

- **Two footers (one in the sidebar, one below content) toggled by CSS.** `getByRole` ignores hidden nodes, but `getByTestId("app-version")` matches hidden DOM too, so strict mode fails; also duplicates the product-rule content. Discarded.
- **Footer nested inside the sidebar `<aside>`.** Loses the `contentinfo` role. Discarded.
- **JS breakpoint detection (`matchMedia`) to render only one nav.** Hydration mismatch / flash on first paint and client-only shell. CSS display toggling is simpler and SSR-safe. Discarded.
- **CSS `order` / grid placement to move the footer before content on desktop.** Breaks DOM/visual order consistency (WCAG 1.3.2, 2.4.3). Discarded.
- **Tokens duplicated in a TS file.** Drift risk; the test parses `globals.css` directly instead.

## Tasks

Each task: write the test first, see it fail, implement, see it pass. Each fits in <= 1 h.

- [x] **1. Contrast helper.** Test first `tests/unit/lib/contrast.test.ts`: black/white = 21, identical = 1, symmetric, `#fff` == `#ffffff`, uppercase accepted, invalid hex throws, `composite()` at alpha 0 and 1 returns bg/fg, `rgb(255 255 255 / 0.06)` parses, `meetsAA(4.49,"text")` false / `4.5` true, `meetsAA(3,"ui")` true, `meetsAA(3,"large")` true. Then `src/lib/contrast.ts`: `parseColor`, `relativeLuminance`, `contrastRatio`, `composite`, `meetsAA(ratio, "text" | "large" | "ui")`.
- [x] **2. CSS token parser.** Test first `tests/unit/lib/css-tokens.test.ts`: extracts `--name: value;` from the first `:root` block, ignores comments and `@theme`, throws on a missing token lookup. Then `src/lib/css-tokens.ts` `parseRootTokens(css)`.
- [x] **3. Palette AA test (red).** `tests/unit/lib/palette-contrast.test.ts` reads `src/app/globals.css` and asserts every pair in the table above (text tokens >= 4.5 on all five surfaces, `accent-contrast` on accent/gold >= 4.5, accent focus ring >= 3 on background and active tint, `line-strong` >= 3 on background/raised). It also asserts each token equals the agreed hex (snapshot of the palette table), so it is red until task 4: `--line-strong` is missing and the old values differ. Surfaces (glass, 8% glow cap) are composited with the helper, not hardcoded.
- [x] **4. Apply palette (green).** Update `:root` tokens, add `--line-strong` to `@theme inline`, replace the blue/gold radial gradients in `body` with forest-green + lime glows at <= 8% alpha, update `viewport.themeColor`. Test 3 passes; `pnpm lint && pnpm typecheck`.
- [x] **5. Shared nav model.** Test first `tests/unit/lib/nav.test.ts`: `isActiveRoute("/", "/")` true, `("/vitrina", "/")` false, `("/vitrina", "/vitrina")` true, `("/vitrina/2024", "/vitrina")` true, `("/vitrinas", "/vitrina")` false (segment boundary, fixes today's `startsWith` bug), 4 items in order Inicio/Vitrina/Rivales/Comparar. Then `src/lib/nav.ts`.
- [x] **6. Playwright desktop project + layout spec (red).** Add project `desktop` (`devices["Desktop Chrome"]`, viewport 1280x800) to `playwright.config.ts`. New `tests/e2e/layout.spec.ts` for every public route: at width >= 1024 the sidebar nav (`data-testid="sidebar"`) is visible and `bottom-nav` hidden; below 1024 the inverse; exactly one `navigation` named "Principal" in the a11y tree (`getByRole` count 1); the active link has `aria-current="page"` with the right label. Update `tests/e2e/footer.spec.ts`: add `toHaveCount(1)` for `contentinfo` and `app-version`, `toBeVisible()` on the footer, keep screenshots (now also produced as `desktop-*`).
- [x] **7. Shell implementation (green).** `NavLinks` client component (variants, `motion-safe` transitions, active tint), `Sidebar` (`hidden lg:flex`, fixed, logo + nav, bottom reserve), `BottomNav` -> `lg:hidden` wrapper using `NavLinks`, `Header` -> `lg:hidden` without the skip link, `SkipLink` in layout, `main` `tabIndex={-1}` + `lg:pl-64`, `Footer` responsive classes (`lg:fixed lg:bottom-0 lg:left-0 lg:w-64 lg:pb-6 lg:text-left`). Specs from task 6 pass on all three projects.
- [x] **8. Keyboard and reduced-motion e2e.** Test first `tests/e2e/a11y-shell.spec.ts`: first `Tab` focuses "Saltar al contenido" and it is visible; `Enter` -> `main#contenido` `toBeFocused()`; focused nav link has a non-`none` computed `outline-style`; with `page.emulateMedia({ reducedMotion: "reduce" })` the `.rise` element's computed `animation-duration` parses to < 0.01s. Fix any failures.
- [x] **9. Mobile distinct treatment.** Per the approved option. For option 1: bottom bar glow + pill indicator, mobile radius/glass; screenshot review at 390x844 and 412x915. Test first: extend task 3 with any new color pair (glow under the active item) and `layout.spec.ts` with the active-indicator `data-testid` visible only below 1024.
- [x] **10. Desktop content treatment.** Wider container, flat surfaces, two-column grid utility on `ComingSoon`/home where it applies. Test first: layout spec asserts main content box width > 900px at 1280x800 and the footer box does not overlap the nav box (bounding boxes) at 1280x800 and 1024x640.
- [x] **11. Verification and PR evidence.** `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm e2e`; attach `test-results/screens/{iphone,android,desktop}-*.png` and the contrast table to the PR; manual pass with keyboard and a screen reader (NVDA or VoiceOver) at 390 and 1280 widths.

## Tests to write

- **Unit (Vitest):** `contrast.test.ts`, `css-tokens.test.ts`, `palette-contrast.test.ts`, `nav.test.ts`. Keeps `src/lib/**` above the 80% thresholds (all new `src/lib` files are pure and fully tested).
- **Integration:** none needed (no data or server code touched).
- **E2E (Playwright, projects iphone 390x844, android 412x915, desktop 1280x800):** updated `footer.spec.ts`, new `layout.spec.ts`, new `a11y-shell.spec.ts`.

Edge cases:

- Viewport exactly 1024px (sidebar shown) and 1023px (bottom nav shown) — add to `layout.spec.ts` with `page.setViewportSize`.
- Short desktop viewport 1024x640: footer must not cover nav items (bounding boxes do not intersect).
- Nested route (`/vitrina/...`) and look-alike prefix (`/vitrinas`) for active state.
- Routes that are not in the nav (`/acerca`, `/privacidad`, `/changelog`): no item has `aria-current`.
- 3-digit hex, uppercase hex, invalid hex, alpha 0/1 in the helper.
- Zoom 200% / text resize at 1280 (effective width 640 -> mobile shell): no horizontal scroll (manual check in task 11).

## Impact

- **Data:** none.
- **Design:** new tokens and shell for every page; gold now only for trophies. `ComingSoon` keeps working. Club theming later overrides `--accent`/`--accent-contrast` and must re-run the contrast helper.
- **Security:** none (no new dependencies, no data, no env).
- **Performance:** CSS-only responsive switch, no extra JS beyond the existing client nav; two navs in the HTML (a few hundred bytes). `backdrop-filter` stays on mobile only if option 1 is approved (desktop sidebar is solid), which helps desktop paint cost. No new fonts.
- **Accessibility:** improves (real focus move on skip link, segment-safe active state, single landmarks).

## Risks and mitigation

- **Footer overlaps sidebar nav on short screens** -> bottom reserve + scrollable nav + bounding-box e2e at 1024x640.
- **Strict-mode e2e failures from duplicated nodes** -> one footer, `toHaveCount(1)` assertions.
- **Lime win/accent confusion** -> semantic colors always with labels; noted in ADR.
- **Glows creeping above 8%** -> the `worst` surface in the palette test is computed from the cap; any new glow must be added to the test.
- **Diego rejects option 1** -> tasks 9-10 are isolated; tasks 1-8 ship regardless.

## Definition of done

- All tasks checked (9-10 per Diego's decision), CI green, coverage thresholds met.
- E2E green on iphone, android and desktop projects; screenshots at 390x844, 412x915 and 1280x800 attached to the PR with the contrast table.
- ADR 0007 accepted; plan status set to `done`.
