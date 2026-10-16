---
issue: 26
status: done
date: 2026-10-16
---

# Plan 0002: Visual polish (opaque bottom bar, minimal footer, floating sidebar, info menu)

Related ADRs: [0007](../adr/0007-visual-identity-lawn-neon.md) (palette and shell) and [0008](../adr/0008-shell-polish-floating-panel-info-menu.md) (this change).

## Goal

Do a second visual pass before Phase 1 without touching the "Césped y neón" palette:

- the mobile bottom bar becomes opaque, with no text bleeding through;
- the footer shows only the credits and the version, smaller;
- the desktop sidebar becomes a modern floating panel;
- Acerca and Privacidad move to a small info menu (a sheet on mobile, discreet links in the sidebar on desktop).

## Acceptance criteria (copied from issue #26)

- **Given** a mobile viewport, **when** content scrolls under the floating bottom bar, **then** the bar background is opaque, no text shows through, and text/icon contrast stays AA.
- **Given** any viewport, **when** the footer renders, **then** it contains exactly the credits (Creada por Diego Estela Lopez, Idea original de Juan Farre) and the version, with no commit hash and no Acerca/Privacidad links.
- **Given** the footer version, **when** the user activates it, **then** it links to /changelog.
- **Given** mobile or desktop layout, **when** a user navigates by keyboard or screen reader, **then** Acerca and Privacidad are reachable and have accessible names.
- **Given** the mobile info sheet is open, **when** the user presses Escape, **then** the sheet closes and focus returns to the info button that opened it.
- **Given** a viewport of 1024px and up, **when** the page renders, **then** the sidebar floats with a visible margin from the viewport edges, rounded corners and a soft shadow.
- **Given** any viewport, **when** the page renders, **then** there is exactly one contentinfo landmark and one app-version element visible per viewport.
- **Given** the existing e2e suite, **when** it runs, **then** the footer regex no longer expects the commit hash and all tests pass.
- **Given** the AA contrast tests, **when** they run, **then** they still pass.
- **Given** the finished work, **when** the PR is opened, **then** it includes screenshots at 390x844, 412x915 and 1280x800.

Out of scope: palette change, new pages.

## Approach

### 1. Opaque bottom bar (`bottom-nav.tsx`)

- Replace `glass` with `bg-raised border border-line-strong shadow-[0_12px_32px_-8px_rgb(0_0_0/0.7)]`. Keep `fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl lg:hidden`. There is no `backdrop-filter`.
- Text on the bar is `muted` (inactive) and `accent` (active) on `raised`, plus `accent` on the active pill (12% lime over `raised` = `activeTint`). All these pairs are already in `palette-contrast.test.ts`. We add a named "bottom bar" block that asserts them explicitly, and that the bar border (`line-strong` on `background`) is at least 3:1 (3.96). This documents the surface even though no new color is introduced.
- The active pill and its 8% glow stay unchanged.

### 2. Minimal footer (`footer.tsx`, `src/lib/version.ts`, `next.config.ts`)

- Content: `Creada por Diego Estela Lopez · Idea original de Juan Farre · v0.1.0`. The `·` separators are `aria-hidden`. Only the version is a link (`/changelog`, `data-testid="app-version"`).
- Size: `text-xs text-muted`.
  - Mobile: centered, wraps naturally (credits on one line, version on the next at 390px), `pt-6 pb-28` to clear the bar. The version link keeps a `min-h-11` hit area (touch).
  - Desktop: left-aligned, stacked lines, version link `min-h-6` (24px, WCAG 2.5.8 AA). A `border-t border-glass-border` separates it from the scrollable panel content.
- `formatVersion(version = APP_VERSION)` returns `v${version}`. Remove `APP_COMMIT`, `NEXT_PUBLIC_APP_COMMIT` and `shortSha()` (and its `execSync` import) from `next.config.ts`. Nothing else uses them (checked with grep). Removing them also drops a `git` subprocess from every build. A unit test pins `nextConfig.env` to `{ NEXT_PUBLIC_APP_VERSION: pkg.version }` so the commit cannot come back unnoticed.

### 3. Floating desktop panel (`sidebar.tsx`, `layout.tsx`, `globals.css`)

- Sidebar: `fixed inset-y-3 left-3 z-30 hidden w-64 flex-col overflow-y-auto rounded-2xl bg-raised px-4 pt-6 lg:flex`, plus the `.panel` utility in `globals.css`:
  - outer 1px ring `box-shadow: 0 0 0 1px var(--glass-border)`;
  - top inner highlight `inset 0 1px 0 rgb(255 255 255 / 0.04)`;
  - soft drop shadow `0 24px 48px -16px rgb(0 0 0 / 0.6)`.

  These use no new tokens and no lime. The old right border is removed. The ring is a box-shadow, so it sits outside the box and the fixed footer never covers it.

- Footer on desktop: `lg:fixed lg:bottom-3 lg:left-3 lg:w-64 lg:rounded-b-2xl lg:bg-raised lg:px-7 lg:pt-4 lg:pb-5 lg:z-40`. It has the same box as the bottom of the panel, so it reads as part of the panel while staying the single `<footer>` directly under `<body>`.
- Footer reserve:
  - The sidebar `padding-bottom` must be at least the footer height measured on Linux CI plus 16px.
  - First measure the new footer at 1280x800 (local and in the CI e2e artifact), then set the reserve as a single arbitrary value (for example `lg:pb-[9rem]`) with a comment linking to commit 153f08e.
  - A new e2e asserts `sidebar padding-bottom >= footer height + 16` on every project, so font drift fails CI instead of overlapping silently.
- Content offset: `main` goes from `lg:pl-72` to `lg:pl-[19rem]` (12px gap + 256px panel + about 36px gutter) and from `lg:pt-10` to `lg:pt-12`. `max-w-6xl` is kept.
- "More current" desktop feel, without color changes:
  - Logo `text-[1.75rem]` with tighter leading.
  - Nav items `text-sm font-medium tracking-tight min-h-10 rounded-xl`.
  - Active state: `bg-accent/12 text-accent` plus a 3px lime bar on the left (`before:` pseudo, `rounded-full`, `bg-accent`). The bar is UI, 15.94:1 on `raised`, already covered.
  - Hover `bg-glass text-foreground` with `motion-safe:transition-colors`.
  - Main nav and info links are separated by a hairline `border-glass-border`.

### 4. Info menu (`src/lib/nav.ts`, `header.tsx`, new `info-menu.tsx`, `sidebar.tsx`)

- `INFO_ITEMS = [{ href: "/acerca", label: "Acerca" }, { href: "/privacidad", label: "Privacidad" }] as const` in `src/lib/nav.ts`. Both menus use it, together with `isActiveRoute`, so active items get `aria-current="page"`.
- **Mobile.** `Header` (server) renders the logo and `<InfoMenu />` (client).
  - **Button.** `type="button"`, lucide `Info` icon (`aria-hidden`), `aria-label="Más información"`, `aria-haspopup="dialog"`, `aria-expanded={open}`, `aria-controls="info-sheet"`, `size-11` (44px), `rounded-full border border-line-strong text-muted hover:text-foreground`. The `line-strong` border is 3.96:1 on `background`.
  - **Sheet.** Native `<dialog id="info-sheet" aria-labelledby="info-sheet-title">` opened with `showModal()`.
    - Layout: positioned as a bottom sheet (`m-0 mx-auto top-auto bottom-3 inset-x-3 max-w-md w-auto rounded-2xl bg-raised border border-line-strong p-4`), backdrop `::backdrop { background: rgb(0 0 0 / 0.6) }`.
    - Contents: heading "Más info" (`text-foreground`), close button with `aria-label="Cerrar"` (X icon, 44px), and `<nav aria-label="Información">` with the two links (`min-h-11`, `text-foreground`).
    - Behavior:
      - Escape closes natively.
      - On the `close` event the button gets focus back and `open` becomes false.
      - Clicks on the backdrop (`event.target === dialog`) and on any link call `close()`. Links are needed because the header persists across client navigations, so the sheet would otherwise stay open.
      - Tab and Shift+Tab wrap inside the sheet via a pure `nextFocusIndex()` helper, so the behavior is deterministic in every browser and in headless runs.
      - Scroll lock without JS: `html:has(dialog[open]) { overflow: hidden }`.
      - Optional slide-up uses `@starting-style` inside `prefers-reduced-motion: no-preference` only.
- **Desktop.** Inside the sidebar, below `NavLinks`, a `<nav aria-label="Información">` with the two links in `text-xs text-muted`, `min-h-8`, `hover:text-foreground`. It sits inside the scrollable area, so it counts toward the reserve test.
- Per viewport, only one "Información" nav is in the accessibility tree: the header is `lg:hidden`, the sidebar is `hidden lg:flex`, and a closed `<dialog>` is `display: none` by the UA stylesheet.

## Discarded alternatives

- **Keeping the glass bar with a stronger blur or higher alpha.** Text still shows through on busy content, and contrast would depend on what scrolls under it. Discarded in favor of solid `raised`.
- **Moving the footer inside the sidebar `<div>`/`<aside>` on desktop and duplicating it for mobile.** This gives two `app-version` nodes, which breaks strict mode, and a nested footer loses `contentinfo` (plan 0001). Discarded.
- **A flex-column sidebar where the footer takes its natural height (no reserve).** This needs the footer to be a DOM child of the sidebar. Same problem as above. Discarded. We keep the reserve and add a CI guard instead.
- **A gradient (border-box) border on the panel.** A real border takes layout space, so the fixed footer would cover it at the bottom, or it would need `calc(... + 1px)` offsets. Discarded in favor of an outer ring via `box-shadow`.
- **A dialog library (Radix, Headless UI) or `motion` for the sheet.** It adds a dependency or bundle weight for two links. Native `<dialog>` already gives top layer, inertness and Escape. Discarded.
- **`popover` attribute instead of `<dialog>`.** A popover is not modal and does not make the rest inert. Discarded.
- **Keeping the commit hash in a hidden `data-commit` attribute.** Vercel already shows the deployed commit, and keeping it would keep the build-time git call. Discarded, unless Diego wants it (see approvals).
- **A desktop dropdown for the info links.** It is an extra interaction for two links. Diego already chose discreet inline links.

## Tasks

Each task: write the test first, see it fail, implement, see it pass. Each task takes at most 1 h. Do not mention environment files in shell commands (the Windows guard blocks them).

- [x] **1. Version without commit (unit).**
  - Test first in `tests/unit/version.test.ts`:
    - `formatVersion("0.4.2")` is `"v0.4.2"`;
    - `formatVersion()` matches `/^v\d+\.\d+\.\d+$/`;
    - the result never contains `·`.
  - New `tests/unit/next-config.test.ts`: `nextConfig.env` deep-equals `{ NEXT_PUBLIC_APP_VERSION: <package.json version> }`.
  - Implement: simplify `src/lib/version.ts`; remove `APP_COMMIT`, `shortSha` and `execSync` from `next.config.ts`.
- [x] **2. `INFO_ITEMS` and `nextFocusIndex` (unit).**
  - Test first in `tests/unit/lib/nav.test.ts`: `INFO_ITEMS` labels and hrefs in order Acerca and Privacidad; `isActiveRoute("/acerca", "/acerca")` is true.
  - New `tests/unit/lib/focus-trap.test.ts` for `nextFocusIndex(current, total, backwards)`:
    - forward wraps from last to 0;
    - backward wraps from 0 to last;
    - `current = -1` (focus outside) goes to 0 forward and to last backward;
    - `total = 1` stays 0;
    - `total = 0` returns -1.
  - Implement in `src/lib/nav.ts` and `src/lib/focus-trap.ts`.
- [x] **3. Palette test: bottom bar and info button pairs (unit).** Add a `describe("opaque bottom bar and info menu")` block to `palette-contrast.test.ts`:
  - `muted` and `accent` on `raised` are at least 4.5;
  - `accent` on `activeTint` is at least 4.5;
  - `line-strong` (bar, sheet and button border) on `background` is at least 3;
  - `foreground` on `raised` (sheet text) is at least 4.5.

  It should pass right away (no token change). The point is to name the new surfaces, so any future change to them fails. Confirm the token snapshot is unchanged.

- [x] **4. Footer e2e (red).** In `tests/e2e/footer.spec.ts`:
  - version regex `/^v\d+\.\d+\.\d+$/`;
  - `footer.getByRole("link")` has count 1;
  - the footer does not contain "Acerca" or "Privacidad";
  - the footer text does not match `/\b[0-9a-f]{7}\b/`;
  - the footer computed `font-size` is `12px`.

  Keep `contentinfo` and `app-version` `toHaveCount(1)` and the screenshots.

- [x] **5. Footer implementation (green).** Update `footer.tsx` with the new content and the mobile `text-xs` classes. Task 4 passes on iphone and android. The desktop placement comes in task 7.
- [x] **6. Opaque bottom bar (e2e red, then green).**
  - Test first in `layout.spec.ts` (only for widths below 1024):
    - `bottom-nav` computed `background-color` is `rgb(13, 35, 24)` (alpha 1);
    - `backdrop-filter` is `none`;
    - `box-shadow` is not `none`;
    - after `window.scrollTo` to the bottom, `elementFromPoint` at the bar's center returns a node inside `bottom-nav`.

    Then the screenshots `{iphone,android}-scrolled-under-bar.png`.

  - Implement the `bottom-nav.tsx` classes.
- [x] **7. Floating panel geometry (e2e red).** In `layout.spec.ts`, at 1280x800 and 1024x800:
  - the sidebar box has `x >= 8`, `y >= 8` and `viewportHeight - (y + height) >= 8`;
  - computed `border-top-left-radius` is at least `16px`;
  - `box-shadow` is not `none`;
  - the footer box is horizontally inside the sidebar box (±1px) and its bottom equals the sidebar bottom (±1px);
  - `#contenido > div` starts at least 24px right of the sidebar's right edge;
  - the content width is still above 900 at 1280.
- [x] **8. Floating panel implementation (green).**
  - `.panel` utility in `globals.css`.
  - Sidebar classes; footer `lg:` classes (bottom-3, left-3, rounded-b-2xl, border-t).
  - `main` offset and padding.
  - Measure the footer height on desktop; set a provisional reserve (footer height + 24).
- [x] **9. Reserve guard plus short screens (e2e).**
  - Test first: at 1280x800, sidebar computed `padding-bottom` is at least footer `boundingBox.height + 16`.
  - Update the existing 1024x640 and 1024x400 tests: after scrolling the sidebar to the end, the bottom of the last item of the desktop "Información" nav is at or above the footer top. The footer background is not transparent.
  - Run them in CI (Linux) through the draft PR. If the guard fails there, raise the reserve. Do not lower the margin.
- [x] **10. Desktop look refresh.** Logo size, nav typography, active left bar, hover, hairline separator in `nav-links.tsx` and `sidebar.tsx`.
  - Test first in `layout.spec.ts`:
    - at 1280 the active sidebar link has a `::before` with non-zero width (`getComputedStyle(el, "::before").width`);
    - only one `aria-current` link is visible.
  - The `active-indicator` test stays mobile-only.
- [x] **11. Desktop info links (e2e red, then green).**
  - Test first in new `tests/e2e/info-menu.spec.ts` (desktop project and 1024 edge):
    - `getByRole("navigation", { name: "Información" })` has count 1 and is visible;
    - its links "Acerca" (`/acerca`) and "Privacidad" (`/privacidad`) are present;
    - on `/acerca` the Acerca link has `aria-current="page"`;
    - the info button is hidden at 1024.
  - Update the `layout.spec.ts` `aria-current` loop: on `/acerca` and `/privacidad`, desktop expects one current link (the info link) and mobile expects 0 (sheet closed).
  - Implement the nav in `sidebar.tsx`.
- [x] **12. Info button and sheet: component unit test (jsdom).**
  - Test first in new `tests/unit/components/info-menu.test.tsx` (`// @vitest-environment jsdom`; stub `HTMLDialogElement.prototype.showModal`/`close`, since jsdom 30 does not implement them):
    - the button has the name "Más información", `aria-expanded="false"` and `aria-controls="info-sheet"`;
    - a click calls `showModal` and sets `aria-expanded="true"`;
    - a `close` event resets `aria-expanded` and focuses the button;
    - a click on a link calls `close`;
    - the links have the names Acerca and Privacidad.
  - Implement `src/components/layout/info-menu.tsx` (client) and wire it into `header.tsx`.
- [x] **13. Sheet keyboard and pointer flow (e2e).** In `info-menu.spec.ts` (iphone and android projects, plus the 1023 edge):
  - The button bounding box is at least 44x44.
  - Keyboard path: Tab from the start goes skip link, then logo, then info button.
  - Enter opens the dialog: `getByRole("dialog", { name: "Más info" })` is visible, `aria-expanded="true"`, and `aria-controls` equals the dialog id.
  - Focus is inside the dialog.
  - Tab x5 and Shift+Tab x5 keep `document.activeElement` inside the dialog.
  - Escape closes it: the dialog is hidden, the button is focused, `aria-expanded="false"`.
  - Reopen, click Acerca: the URL is `/acerca` and the dialog is hidden.
  - Reopen, click the backdrop corner: it closes.
  - Reopen, click Cerrar: it closes and focus is back on the button.
  - While open, `getByRole("contentinfo")` still has count 1, and the bottom nav is inert (`page.getByRole("navigation", { name: "Principal" })` is not reachable).
  - Screenshot `{project}-info-sheet.png`.
- [x] **14. Reduced motion for the sheet.** Test first: with `reducedMotion: "reduce"`, the computed `transition-duration` of the open dialog is below 0.01s. Implement `@starting-style` inside `no-preference` only.
- [x] **15. Verification and PR evidence.**
  - Run `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm e2e`.
  - Attach to the PR: `test-results/screens/{iphone,android,desktop}-*.png` (390x844, 412x915, 1280x800), the scrolled-under-bar shots, the info-sheet shots and a 1024x400 shot.
  - Manual pass with keyboard plus NVDA or VoiceOver at 390 and 1280.
  - Update ADR 0008 status in the PR and set this plan to `done`.

## Tests to write

- **Unit (Vitest):**
  - `version.test.ts` (updated);
  - `next-config.test.ts` (new);
  - `nav.test.ts` (`INFO_ITEMS`);
  - `focus-trap.test.ts` (new, pure);
  - `palette-contrast.test.ts` (new named surface block);
  - `components/info-menu.test.tsx` (new, jsdom with a dialog stub).

  Coverage: all new `src/lib` code is pure and fully tested, and the 80% thresholds hold.

- **Integration:** none (no data or server code).
- **E2E (Playwright: iphone 390x844, android 412x915, desktop 1280x800):**
  - `footer.spec.ts` (regex, exactly one link, no hash, no Acerca/Privacidad, 12px);
  - `layout.spec.ts` (opaque bar, floating geometry, reserve guard, short screens, active state, `aria-current` on info routes);
  - `info-menu.spec.ts` (new: desktop links, mobile sheet keyboard, Escape, focus return, backdrop, link close, inertness);
  - `a11y-shell.spec.ts` (unchanged; the skip link must still be the first tab stop).

Edge cases:

- 1023px: info button visible, sidebar hidden. 1024px: button hidden, panel floating with the info links.
- 1024x400: the panel scrolls, and the info links and nav are never under the footer. 1024x640 likewise.
- Client navigation from the sheet to `/acerca`: the sheet closes because the header persists.
- Opening and closing the sheet twice: no duplicated listeners, focus returns each time.
- Sheet open while the viewport is resized to 1024 or more: the header becomes `display: none`. Check that the dialog closes or stays inert-safe. Handle it with a `matchMedia("(min-width: 1024px)")` change listener that calls `close()`, plus an e2e.
- Footer with a long version string (`v10.12.3`) still fits on one line on desktop (unit-free visual check in screenshots).
- 200% zoom at 1280 (effective 640): mobile shell with the info button, no horizontal scroll (manual).
- `/changelog` is not in either nav: no `aria-current` anywhere.

## Impact

- **Data:** none.
- **Design:**
  - No token, color or glow changes. The bar and the panel switch to solid `raised`; glass is kept for cards only.
  - The footer is smaller and has only one link. Acerca and Privacidad remain reachable from every page through the info menu.
  - ADR 0008 amends the shell section of ADR 0007.
- **Security:**
  - No new dependencies. One fewer `NEXT_PUBLIC_` variable, so the commit SHA is no longer exposed in the bundle.
  - No `execSync` in the Next config.
  - No user data.
- **Performance:**
  - Removing `backdrop-filter` from the mobile bar lowers paint and compositing cost on low-end phones.
  - One small client component (`InfoMenu`, under 2 KB) and no new libraries.
  - The build no longer spawns `git`.
- **Accessibility:**
  - The info button exposes its state (`aria-expanded`, `aria-controls`, `aria-haspopup`).
  - The modal dialog makes the background inert, and focus return is explicit.
  - Targets are 44px on mobile and at least 24px on desktop.
  - `aria-current` now also marks the Acerca and Privacidad items.

## Risks and how to verify

- **Footer reserve too small on Linux fonts (repeat of 153f08e).** Mitigation: the reserve is sized as footer height + at least 16px, the CI e2e guard compares the computed padding with the measured footer height, and the short-screen tests run at 1024x400 and 1024x640.
- **Tab wrap differs between browsers in a native dialog.** Mitigation: an explicit wrap via `nextFocusIndex`, tested in unit and e2e.
- **jsdom lacks `showModal`.** Mitigation: a prototype stub in the component test. Real behavior is covered by Playwright.
- **The sheet stays open after a client navigation or a resize.** Mitigation: close on link click and on the `matchMedia` change, both with tests.
- **Duplicate "Información" navs confuse tests.** Mitigation: assert `toHaveCount(1)` per viewport. A closed `<dialog>` and `lg:hidden`/`hidden lg:flex` are all `display: none`.
- **Desktop footer covers the panel ring.** Mitigation: the ring is an outer box-shadow, and the geometry e2e checks that the footer and sidebar boxes align.

Definition of done:

- All tasks are checked, and CI is green on iphone, android and desktop.
- The palette test passes with unchanged token values.
- Screenshots at 390x844, 412x915 and 1280x800 (plus the open sheet and 1024x400) are in the PR.
- The manual keyboard and screen-reader pass is done.
- ADR 0008 is accepted and the plan status is `done`.

## Needs Diego approval (all four taken as recommended; see review report)

1. **Version display (open question in the issue).** Recommendation: keep it automatic from `package.json`. It shows `v0.1.0` until release-please cuts the next release (`v0.1.1` after a `fix` release). Setting it by hand would conflict with release-please.
2. **Removing the commit hash from the build env entirely** (not only from the UI). Recommendation: remove it (Vercel already shows the commit). Alternative: keep it in a hidden `data-commit` attribute for support.
3. **Copy for the new UI strings (Rioplatense Spanish):** button label "Más información", sheet title "Más info", close "Cerrar", nav label "Información".
4. **`aria-current` on the Acerca and Privacidad items.** This changes the current e2e expectation that non-nav routes have no current item. Recommended for a11y.
