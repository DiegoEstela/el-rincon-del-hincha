# 0007 — Visual identity "Césped y neón" and responsive app shell

## Context

The original "night stadium" palette (navy background, gold accent) made the web version look like the mobile layout stretched out, and gold doubled as both accent and trophy color. Diego chose a new direction for issue #13: "Césped y neón" (very dark forest-green background, electric lime accent, gold reserved for trophies, readable win/even/loss colors) plus a dedicated desktop navigation (fixed left sidebar). Constraints:

- Product rule: footer with credits and version on every page; the e2e suite locates it with `getByRole("contentinfo")` and `getByTestId("app-version")`, which require exactly one match (Playwright strict mode counts hidden DOM nodes for `getByTestId`).
- A `<footer>` only maps to the `contentinfo` landmark when it is not nested inside `article`, `aside`, `main`, `nav` or `section`.
- WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and UI components / focus indicators.
- Club theming (out of scope now) will later override `--accent` / `--accent-contrast` at runtime.

## Decision

1. **Tokens.** All colors are CSS custom properties in `src/app/globals.css` `:root`, exposed to Tailwind via `@theme inline`. Values:

   | Token                 | Hex / value               | Use                                                                |
   | --------------------- | ------------------------- | ------------------------------------------------------------------ |
   | `--background`        | `#07140d`                 | page background (very dark forest green)                           |
   | `--background-raised` | `#0d2318`                 | sidebar, raised surfaces                                           |
   | `--foreground`        | `#ecfdf3`                 | body text                                                          |
   | `--muted`             | `#9db8a9`                 | secondary text                                                     |
   | `--glass`             | `rgb(255 255 255 / 0.06)` | glass cards (unchanged)                                            |
   | `--glass-border`      | `rgb(255 255 255 / 0.12)` | decorative card borders only (1.38:1)                              |
   | `--line-strong`       | `#5a7a68`                 | borders that identify a control (>= 3:1 on background/raised only) |
   | `--accent`            | `#c6ff3d`                 | electric lime: active nav, links, focus ring                       |
   | `--accent-contrast`   | `#0a1a00`                 | text on accent fills                                               |
   | `--gold`              | `#f5c542`                 | trophies and titles only                                           |
   | `--win`               | `#4ade80`                 | win                                                                |
   | `--even`              | `#a8b5ad`                 | draw                                                               |
   | `--loss`              | `#ff8a8a`                 | loss (brightened from `#f87171` to keep AA on glowing glass)       |

   Decorative accent glows (radial gradients) are capped at **8% lime alpha** so every text token stays >= 4.5:1 on the worst surface (glass over the glow). Contrast is enforced by a pure helper (`src/lib/contrast.ts`) and a unit test that parses `globals.css` and asserts every documented pair; the measured ratios are in `docs/plans/0001-visual-refresh.md`.

2. **Shell.** A single responsive shell in `src/app/layout.tsx`, switching at Tailwind's `lg` breakpoint (1024px):
   - `>= 1024px`: fixed left sidebar (logo + vertical nav); the mobile header and bottom nav are `display: none` (`lg:hidden`).
   - `< 1024px`: current header + floating bottom nav; the sidebar is `display: none` (`hidden lg:flex`).
   - Hidden variants use `display: none` only (never `opacity`, `visibility` tricks or off-screen positioning), so they leave both the tab order and the accessibility tree.
   - Nav items come from one shared list and one pure `isActiveRoute` helper; both presentations set `aria-current="page"`.
   - **One `<Footer>` in the DOM**, a direct child of `<body>` placed after `<main>`. On mobile it flows below the content; on desktop it is positioned (`lg:fixed`) at the bottom of the sidebar column. It is never nested inside the sidebar `nav`/`aside`, so it remains the only `contentinfo` landmark and the only `app-version` node.
   - The skip link lives in the layout (not in the mobile-only header) and targets `<main id="contenido" tabIndex={-1}>` so focus actually moves.

3. **Motion.** Non-essential animation and transitions are disabled under `prefers-reduced-motion: reduce` (global rule kept); new transitions use `motion-safe:` variants.

## Consequences

- Gold no longer doubles as the accent, so trophies stand out; the lime accent becomes the default club-theming slot.
- Any new color pair used for text must be added to the contrast test, or CI does not prove AA.
- On desktop the footer is visually in the sidebar but comes after `<main>` in tab order; this is intentional (content first) and matches the DOM order rule (no CSS `order` reflow).
- The sidebar must reserve bottom space for the fixed footer; very short desktop viewports (< ~640px tall) are covered by letting the sidebar nav scroll.
- Club theming will need to re-validate contrast for each club's accent with the same helper.
- Playwright gains a `desktop` project (1280x800), increasing e2e time by about one third.
