# 0013 — Club theming without flash and onboarding storage

Status: **Accepted** (2026-10-17). Written with plan 0008 (issue #40). Diego explicitly approved on 2026-10-16 the table of accent colors per club and the returning-visitor banner; the other visual items of the plan (initials rule, crest look, theme preview, home layout, blocked storage, copy) were left as the plan recommends and are reviewed by Diego on the live site, where they can be adjusted club by club.

## Context

The onboarding (`/`, issue #40) lets the fan pick a club and a start date (birth date by default). Three things have to be decided for the whole app, not just for one screen:

- **Club theming.** ADR 0007 reserved `--accent` / `--accent-contrast` for the club, and said each club's accent must be re-validated for AA. ADR 0012 only guarantees that every club has one color at 3:1 against the app backgrounds. Text in the accent color (active nav item, links, the "La tuya se sigue jugando." line) needs 4.5:1 on every surface, and 16 of the 29 clubs have no color that reaches it as is (dark blues, red, granate, brown, greens).
- **No flash on first paint.** Next.js 16 runs here with `cacheComponents: true`. Every route is prerendered as a static shell. The server cannot know the club of the visitor without a runtime API (`cookies()`), and reading a cookie in the root layout forces every segment under it to block on the request (Next docs: "Preventing flash before hydration", "Caching"). A client-only theme (applied in `useEffect`) paints lime first and then the club color.
- **Privacy of the start date.** The start date is usually the birth date. Product rule (prompt section 5.5, `/privacidad`): it never goes in a URL, a log or analytics. The database already bounds it (`1880-01-01` to today in Buenos Aires, migration `20261016120100_comparisons.sql`).

## Decision

1. **Accent derivation, at build time, in pure code.** `deriveClubTheme(colors)` in `src/lib/club-theme.ts`:
   - Base color: the first of `primary`, `secondary`, `tertiary` that is chromatic (OKLCH chroma >= 0.04). If none is (black and white clubs), the lightest one. White or black is never chosen while the club has a real color, because a white accent does not say "River" or "Vélez".
   - Lift: if the base is below **4.6:1** (AA 4.5 plus a 0.1 margin for rounding and for the browser mixing tints in OKLab) against any accent surface, raise its **OKLCH lightness only**, with hue fixed and chroma reduced only as much as the sRGB gamut forces, by bisection, to the smallest lightness that passes. The result is rounded to hex and checked again. The accent is never darkened: every surface is dark, so darker text only loses contrast.
   - Accent surfaces: `--background`, `--background-raised`, glass on both, glass over the accent glow (8%) over raised, and the active-item tint (accent 12% over raised).
   - `--accent-contrast` (text on accent fills) is the existing `#0a1a00` when it reaches 4.5:1 on the accent, otherwise `#ffffff`.
   - Guard: hue drift of a chromatic base stays under 5 degrees. A unit test runs the whole `data/clubs.json` through the function and asserts every pair with `src/lib/contrast.ts`.
2. **Per-club CSS plus a `data-club` attribute.** The root layout (a Server Component) renders, in `<head>`, one `<style>` with a rule per club, `html[data-club="<id>"]{--accent:…;--accent-contrast:…}`, computed once at module scope from `data/clubs.json` (static, prerendered, about 2.5 KB). With no attribute, `:root` keeps the lime default.
3. **localStorage plus a tiny inline script, no cookie.** A constant inline script in `<head>` (built by `themeBootScript()`, tested) reads the saved choice from `localStorage` inside `try`/`catch`, checks that the club id is a slug, and sets `data-club` on `<html>` while the HTML is parsed, before the first paint. `<html>` gets `suppressHydrationWarning`. A small client component re-applies the attribute in `useLayoutEffect` (React Strict Mode clears it on the dev remount). A cookie was rejected: reading it on the server makes the shell dynamic, and reading it in the inline script gives nothing that `localStorage` does not, while sending data to the server on every request for no reason.
4. **Glows follow the accent.** The body glow, the lawn stripes and the active nav glow use `color-mix(in srgb, var(--accent) N%, transparent)` instead of hardcoded lime, with the 8% cap of ADR 0007 kept. The contrast test covers every text token on the club glow.
5. **One storage record, never throwing.** Key `rincon-del-hincha:fan`, value `{"v":1,"clubId":…,"startDate":"YYYY-MM-DD","startMode":"birth"|"other"}`. Only `src/lib/fan-storage.ts` touches it. Every read and write is wrapped (getting `window.localStorage` itself can throw); a failed write keeps the choice in memory for the session and the app goes on. A read that does not match the record shape, an unknown club or an invalid date gives "no saved choice".
6. **Start date rules live in the domain.** `validateStartDate(value, now)` in `src/domain/start-date.ts` uses the same bounds as the database: a real `YYYY-MM-DD` date, not before `1880-01-01`, not after today in `America/Argentina/Buenos_Aires`. The engine's `fanPeriod` is unchanged (a future start still gives an empty period); the form simply never produces one. Issue #43 reuses this function for route handlers.
7. **The start date never leaves the device.** The date input has no `name` (a native submit without JavaScript cannot put it in a query string), navigation to `/vitrina` carries no parameters, no code logs it, and the future analytics event carries only the club (`onboarding_completado {club}`). E2E tests watch every URL, request body and cookie.

## Consequences

- No flash and no dynamic rendering: every route stays a static shell, and the theme is right on the first paint of a hard navigation. The cost is a 2.5 KB style block and a 300-byte script in every HTML page.
- A future Content Security Policy must allow the inline script by hash or nonce (the script is a constant, so a hash works).
- Several clubs share an accent (all the reds become the same coral), because the palette of ADR 0012 is shared. Identity comes from the crest; the accent is a mood.
- Some lifted accents move away from the shirt color (granate becomes a rose, brown a tan, navy a light blue). The plan lists every club's accent for Diego to approve. A club whose lifted color is not acceptable gets a decision from Diego, not an ad hoc hex.
- `src/lib/contrast.ts` stops being test tooling only: the server uses it at build time. It must stay out of the client bundle (only server modules import it).
- `src/lib/**` gets a 100% branch threshold, like `src/domain` and `src/data-model`.
- The saved choice lives only in this browser. A fan with storage blocked has to choose again on the next visit. A persistent profile is Stage 2 (#19).
