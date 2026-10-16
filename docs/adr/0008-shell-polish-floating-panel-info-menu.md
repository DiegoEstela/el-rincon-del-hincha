# 0008 — Shell polish: opaque bottom bar, floating sidebar panel, info menu, version-only footer

Amends [ADR 0007](0007-visual-identity-lawn-neon.md) (shell section). Palette tokens are unchanged.

## Context

Issue #26 reports that text bleeds through the translucent glass bottom bar on mobile, the footer is noisy (commit hash, Acerca/Privacidad links) and the docked desktop sidebar feels dated. Diego decided that Acerca and Privacidad move to a small menu: an info button in the mobile header that opens a sheet, and two discreet links in the desktop sidebar. ADR 0007 constraints still apply: exactly one `contentinfo` and one `app-version` node in the DOM, hidden variants via `display: none` only, footer as a direct child of `<body>`, AA contrast proven by the palette test.

## Decision

1. **Opaque bottom bar.** The mobile bar stops using `.glass`. It is a solid `--background-raised` surface with a 1px `--line-strong` border and a soft dark shadow, still floating (`inset-x-3 bottom-3`, `rounded-2xl`). No `backdrop-filter`. Every text pair on it is a pair already in the palette test (`raised`, active lime tint over `raised`). The "Tribuna" glass look is kept for cards only.
2. **Floating desktop panel.** From 1024px the sidebar is a fixed panel inset 12px from the top, left and bottom viewport edges (`inset-y-3 left-3 w-64`), `rounded-2xl`, solid `--background-raised`, an outer 1px ring in `--glass-border` (decorative; never the only cue for a control) and a soft dark shadow. No glass and no new colors. The content offset grows to clear the panel plus a gutter.
3. **Footer stays a single body-level element.** It is still the only `<footer>`, a direct child of `<body>` after `<main>`. On desktop it is `fixed` at the same left, bottom and width as the panel, with the panel's bottom radius and background, so it reads as part of the panel. The ring is a box-shadow outside the panel box, so the footer never covers it. The sidebar's bottom padding (the space reserved for the footer) is a fixed value that must be at least the footer height measured on Linux CI plus a 16px margin. An e2e test checks this on every run, so changes in font metrics fail CI instead of overlapping.
4. **Footer content.** Only "Creada por Diego Estela Lopez", "Idea original de Juan Farre" and `v{package.json version}` linking to `/changelog` (`data-testid="app-version"`). The commit hash is removed from the UI and from the build env (`NEXT_PUBLIC_APP_COMMIT` and the `git rev-parse` call in `next.config.ts` go away). Vercel already shows the deployed commit.
5. **Info menu.**
   - Mobile: the header has an icon button (`aria-label="Más información"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, 44x44px). It opens a native `<dialog>` with `showModal()`, styled as a bottom sheet. The rest of the page becomes inert, Escape closes the sheet natively, and the header sets focus back on the button explicitly on `close`. A small Tab/Shift+Tab wrap keeps focus inside the sheet, so behavior does not depend on the browser. A click on the backdrop or on a link closes the sheet. This adds no new dependencies. The only extra client JS is one small component.
   - Desktop: a second `<nav aria-label="Información">` inside the sidebar, below the main nav, with the same two links in smaller muted type.
   - Both menus use one shared `INFO_ITEMS` list in `src/lib/nav.ts`. Both set `aria-current="page"` on the active item.

## Consequences

- No color, glow or token changes. ADR 0007's 8% glow cap and the palette test still hold. The bar gets simpler (no blur), which also cuts mobile paint cost.
- The version shown depends on release-please. It reads `v0.1.0` until the next release bumps `package.json`.
- Debugging a deploy by commit now uses Vercel's deployment metadata, not the footer.
- The DOM now holds two "Información" link sets, one per viewport, and each is `display: none` on the other viewport. A closed `<dialog>` is `display: none` by the UA stylesheet. So `getByRole` sees one set at a time.
- The footer reserve is still a fixed value tied to font metrics, but it now has a CI guard. If the footer gets more lines, the reserve and its test must change together.
- On desktop the footer still comes after `<main>` in tab order. This is intentional and unchanged from ADR 0007.
