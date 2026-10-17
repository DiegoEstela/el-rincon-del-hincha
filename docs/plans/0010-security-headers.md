---
issue: 55
status: pending
date: 2026-10-17
---

# Plan 0010: Security headers and a Content-Security-Policy

Related ADRs: [0002](../adr/0002-nextjs-vercel-stack.md) (Next.js on Vercel), [0013](../adr/0013-club-theming-and-onboarding-storage.md) (inline `<style>` and boot `<script>`, start date privacy), **0014** (new, written in this plan: security headers policy).

## Goal

Every response of the app ships a Content-Security-Policy and the basic hardening headers (`X-Content-Type-Options`, `Referrer-Policy`, framing protection), without breaking the no-flash club theming of ADR 0013 and without losing the static prerender of `/` under Cache Components. The policy reinforces the product promise that the fan's start date never leaves the device.

## Acceptance criteria (copied from issue #55)

- Given any page response, When headers are inspected, Then it includes `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `frame-ancestors` (via CSP) restricting framing.
- Given the layout's constant boot `<script>` (no-flash theming, ADR 0013), When the CSP is applied, Then the script still runs, allowed by a sha256 hash or a nonce, with no `unsafe-inline` for scripts.
- Given the layout's constant inline `<style>` (club accent rules), When the CSP is applied, Then the styles still render, via an explicit allowance for inline style.
- Given a cross-origin navigation or request from the app, When the browser sends a referrer, Then it follows the chosen policy (`strict-origin-when-cross-origin` suggested, or `same-origin`) and the start date is never exposed.
- Given Next 16 with Cache Components, When `pnpm build` runs, Then `/` still prerenders as static (if a nonce would force dynamic rendering, a hash is used instead).
- Given the change, When `pnpm e2e` runs and a Vercel preview is opened, Then e2e passes and the preview works with no CSP violations in the console.

Out of scope (from the issue): any change to the onboarding behavior. Also out of scope here: HSTS (Vercel already sends `Strict-Transport-Security` on its HTTPS domains), CSP violation reporting endpoint, and analytics origins (#16 will extend `connect-src` if it ever needs a third-party origin; Vercel Analytics is same-origin).

## Finding that blocks acceptance criterion 2 as written

The issue assumes the only inline script in the HTML is the boot script. A look at the current build (`.next/server/app/index.html`, built from `main` at 0.2.0) shows otherwise:

| Page            | Inline `<script>` without `src` | Ours | Next's own                                                                      |
| --------------- | ------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `/`             | 17                              | 1    | 16 (`_R_` Turbopack bootstrap + 15 `self.__next_f.push(...)` RSC flight chunks) |
| other routes    | 14 each                         | 1    | 13                                                                              |
| `_not-found`    | 14                              | 1    | 13, plus 4 inline `style="..."` attributes and an extra `<style>`               |
| `_global-error` | 9                               | 0    | 9, plus 7 inline `style="..."` attributes and a `<style>`                       |

Next's inline scripts carry the RSC payload of each page (it even contains `CLUB_THEME_CSS` again) and the chunk list of each build, so their content, and therefore their sha256, changes **per page and per build**. Next 16.4 has no option to hash them or to move them out of line (checked: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, `config-shared.d.ts`; `experimental.sri` only adds `integrity` to external `<script src>` files). The Next CSP guide gives exactly two supported shapes:

1. **Nonce via `proxy.ts`**: Next reads `'nonce-…'` from the request CSP and stamps it on its own scripts. It "**must use dynamic rendering**", and "Partial Prerendering is incompatible with nonce-based CSP since static shell scripts won't have access to the nonce". Every route would stop being a static shell. Fails acceptance criterion 5.
2. **Without nonces** (`headers()` in `next.config`): the guide's own example uses `script-src 'self' 'unsafe-inline'`. Fails acceptance criterion 2.

A policy with only the boot script hash (`script-src 'self' 'sha256-…'`) blocks Next's flight scripts: the page paints from HTML but **never hydrates** (no search, no club picker, no info menu). And adding the hash next to `'unsafe-inline'` does not help: in every CSP2+ browser, the presence of a hash or nonce makes the browser ignore `'unsafe-inline'`.

So criteria 2 and 5 cannot both hold with supported Next APIs. This is a security and product trade-off that needs Diego (CLAUDE.md human checkpoint: product decision not covered).

## Approval needed from Diego

Tasks T1, T2, T4, T6 and T8 do not depend on these answers. T3, T5 and T7 use the recommended option until Diego answers; changing answers 2 to 4 later only changes constants and the pinned test strings. Answer 1 = B or C means re-planning (see "If Diego picks B or C").

1. **Script policy (amends acceptance criterion 2).**
   - **A (recommended): `script-src 'self' 'unsafe-inline'`, everything else strict.** Keeps every route static, uses only the documented `headers()` path, survives any build. Inline scripts are allowed, but the rest of the policy limits what an injected script could do: `connect-src 'self'` blocks `fetch`, XHR, `sendBeacon` and WebSocket to other origins; `img-src 'self' data:` blocks image beacons; `form-action 'self'` blocks form posts out; `object-src 'none'`, `base-uri 'none'`, no `'unsafe-eval'` in production. The app renders no user-supplied HTML (React escapes everything; the only `dangerouslySetInnerHTML` are the two build-time constants of ADR 0013, validated by `clubThemeCss`), so the injection surface is small today. Honest limit: CSP cannot stop a top-level navigation leak (`location = "https://x?d=…"`), with any of the three options.
   - **B: strict `script-src 'self'` plus per-build hashes of every inline script.** Meets the criterion literally. Needs a post-build step that scans `.next/server/app/**/*.html`, hashes about 14 to 17 scripts per page, and then either a second `next build` (with a pinned `generateBuildId`, hoping the output is byte-identical) or rewriting `.next/routes-manifest.json` (an undocumented Next internal that Vercel's builder reads). Roughly 110 hashes (about 6 KB) per header if one policy covers all routes. Breaks the moment any route gets a dynamic hole under Cache Components, because streamed flight scripts then carry request data. Not recommended.
   - **C: nonce via `proxy.ts` plus dynamic rendering of every route.** Meets criterion 2, fails criterion 5 (and costs a server render per visit, no CDN caching). Not recommended.
2. **Referrer-Policy: `same-origin` (recommended) or `strict-origin-when-cross-origin`.** Neither can expose the start date (it is never in a URL, ADR 0013 decision 7), and both hide paths from other sites. `strict-origin-when-cross-origin` is already the browser default, so setting it only protects old browsers; `same-origin` sends nothing at all to other origins (external sites, such as data source links on `/acerca`, do not even learn the visit came from the app). Cost of `same-origin`: outbound links lose attribution. No feature today needs the referrer cross-origin.
3. **Vercel Toolbar on preview deployments.** Vercel injects a toolbar script from `https://vercel.live` into previews; a strict CSP blocks it and fills the console with violations (criterion 6). Options: **(recommended)** allow the toolbar origins **only when `VERCEL_ENV === "preview"`** at build time (production stays strict); or Diego disables the toolbar for the project in the Vercel dashboard (account setting, Diego only) and the CSP stays identical everywhere.
4. **Two extra low-cost headers** not listed in the issue: `X-Frame-Options: DENY` (framing protection for old browsers that ignore `frame-ancestors`) and `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`, plus `poweredByHeader: false` (drops `X-Powered-By: Next.js`). Recommended: include all three. Alternative: only the four headers of the issue.

## Approach

### Where the headers are set

`async headers()` in `next.config.ts`, one rule with `source: "/:path*"` (pages, RSC requests, `/_next/static`, favicon). It needs no request API and no proxy, so rendering is untouched and every route stays a static shell; on Vercel the headers are applied by the CDN from the routes manifest, and `pnpm start` (e2e) applies them from the Next server.

The values are built by a pure module, `src/lib/security-headers.ts` (100% branch coverage like the rest of `src/lib`), so the policy is unit tested as data and `next.config.ts` stays a thin wiring:

- `cspDirectives({ dev, vercelPreview }): Record<string, string[]>`, the policy as data (easy to assert directive by directive).
- `serializeCsp(directives): string`, `"name v1 v2; name v1"` in a fixed order, no trailing `;`, no newlines; throws if a value contains `;`, `,` or a newline (no header splitting from a bad constant).
- `securityHeaders({ dev, vercelPreview }): { key: string; value: string }[]`, the full list for `headers()`.

`next.config.ts` passes `dev: process.env.NODE_ENV === "development"` and `vercelPreview: process.env.VERCEL_ENV === "preview"`. No secret is read; `VERCEL_ENV` is a public system variable available at build time. Note: `next.config.ts` must import the module with a relative path (`./src/lib/security-headers`), not the `@/` alias.

### The policy (option A, production)

| Directive         | Value                    | Why                                                                                                                                                                                                     |
| ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src`     | `'self'`                 | Fallback for everything not listed (workers, manifest, media, frames).                                                                                                                                  |
| `script-src`      | `'self' 'unsafe-inline'` | `/_next/static` chunks plus Next's per-page inline flight scripts and the boot script (decision 1). Dev adds `'unsafe-eval'` (Next guide: React uses `eval` for dev error stacks; never in production). |
| `style-src`       | `'self' 'unsafe-inline'` | See "Inline style" below.                                                                                                                                                                               |
| `img-src`         | `'self' data:`           | Favicon and same-origin images; crests are inline SVG elements (not subject to `img-src`). No `blob:`, nothing uses it.                                                                                 |
| `font-src`        | `'self'`                 | `next/font/google` self-hosts Geist and Bebas Neue under `/_next/static/media`.                                                                                                                         |
| `connect-src`     | `'self'`                 | RSC navigations and prefetches are same-origin. Main exfiltration guard. In dev, `'self'` also covers the HMR WebSocket in current browsers.                                                            |
| `object-src`      | `'none'`                 | No plugins.                                                                                                                                                                                             |
| `base-uri`        | `'none'`                 | The app uses no `<base>`; an injected one cannot redirect relative URLs.                                                                                                                                |
| `form-action`     | `'self'`                 | The onboarding form (if submitted natively without JS) posts to the same page.                                                                                                                          |
| `frame-ancestors` | `'none'`                 | No site may frame the app (criterion 1, clickjacking).                                                                                                                                                  |

Preview only (decision 3, `vercelPreview: true`): add `https://vercel.live` to `script-src`, `connect-src`, `img-src`, `frame-src` (and `frame-src` then also lists `'self'`), `style-src` and `font-src`, plus `https://vercel.com` to `img-src`, `https://assets.vercel.com` to `font-src` and `wss://ws-us3.pusher.com` to `connect-src`. The exact list must be checked against Vercel's current "Vercel Toolbar and CSP" documentation at implementation time; if it differs, follow the docs and update the test.

Not included, on purpose: `upgrade-insecure-requests` (Vercel serves HTTPS only and every URL is relative; on `http://localhost` in e2e it would try to upgrade same-origin subresources), `'strict-dynamic'` (does not cover parser-inserted inline scripts, so it adds nothing to option A), `require-trusted-types-for` (React and Next do not ship Trusted Types policies), `report-uri` / `report-to` (no endpoint; follow-up if wanted).

### Other headers

- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: same-origin` (decision 2; recommended value).
- `X-Frame-Options: DENY` and `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()` (decision 4).
- `poweredByHeader: false` in `next.config.ts` (decision 4).

### The boot script: hash vs nonce

- **Nonce: rejected.** Forces dynamic rendering of every route (Next guide, quoted above); `/` would stop being prerendered (criterion 5) and ADR 0013 decision 3 chose the inline script precisely to keep static shells.
- **Hash of the boot script alone: computed, but not sent under option A.** A hash would work for our script (it is a constant), but listing any hash in `script-src` makes the browser ignore `'unsafe-inline'`, which blocks Next's flight scripts and kills hydration. So under option A the header must contain **no** `sha256-` and **no** `nonce-` source in `script-src`, and a unit test enforces that invariant (T1), because adding "just one hash" later is the most likely way to break the site silently.
- **How the hash would be computed (option B, and the reference for ADR 0014):** at config time, `createHash("sha256").update(themeBootScript(), "utf8").digest("base64")`, sent as `'sha256-<base64>'`. Pinned by two tests: a unit test comparing it with a literal (any change to the boot script shows up in review), and an e2e or build check that hashes the `<script>` body actually found in the built HTML (React does not escape `dangerouslySetInnerHTML`, so the bytes are identical). Today's script has no character React would alter, but the build check is the real guard. Under option A this is documented in ADR 0014 and not implemented (no dead code).

### Inline style: hash or `'unsafe-inline'`

`'unsafe-inline'` for `style-src` (criterion 3 asks for "an explicit allowance for inline style").

- A hash of `CLUB_THEME_CSS` alone would be stable per dataset, but Next's own `_not-found` and `_global-error` pages render `style="…"` attributes and their own `<style>` block, and inline `style` attributes can only be allowed by `'unsafe-inline'` or `'unsafe-hashes'` plus one hash per attribute value. A hash-only `style-src` would leave the 404 page unstyled and would break the first time a component server-renders a `style` attribute (for example `motion` with an `initial` prop).
- The residual risk of `'unsafe-inline'` styles is CSS injection (attribute selectors that leak values through background requests). It needs an HTML injection point, which the app does not have, and `img-src 'self' data:` plus `font-src 'self'` block the cross-origin requests such an attack needs.
- Runtime style changes through the CSSOM (`element.style.x = …`, what `motion` does on the client, and `setProperty` on `<html>`) are not governed by `style-src` at all, so they keep working either way.

### Next's own inline scripts and hydration

Covered by `'unsafe-inline'` in option A (the only supported static option). External chunks (`/_next/static/chunks/*.js`, including the `noModule` polyfill) are covered by `'self'`. Client-side navigations fetch RSC payloads with `fetch` (same-origin, `connect-src 'self'`), not inline scripts. Dev mode needs `'unsafe-eval'` and works with the same `connect-src 'self'` for HMR; the dev error overlay uses inline styles (allowed).

### If Diego picks B or C

- **B:** T1 to T3 change (`script-src 'self'` plus a generated hash list), and two new tasks: a post-build hash collector with its tests, and the delivery mechanism (second build or manifest rewrite), each needing its own spike and ADR 0014 text. Re-plan before building.
- **C:** a `proxy.ts` with the nonce and a matcher that skips `_next/static`, `favicon.ico` and prefetches (Next guide), `await connection()` or a runtime API in the root layout, ADR 0013 decision 3 revisited, and criterion 5 dropped. Re-plan before building.

### Discarded alternatives

- **CSP in a `<meta http-equiv>` tag.** Cannot carry `frame-ancestors` (ignored in meta), and has the same inline script problem.
- **`proxy.ts` without nonce, only to set headers.** Adds a function invocation to every request for headers that `next.config` can set statically.
- **`experimental.sri`.** Adds `integrity` to external chunks only; does not solve inline scripts, and is experimental.
- **`vercel.json` headers.** Splits configuration between two files and does not apply to `pnpm start`, so e2e would not test it.
- **`Content-Security-Policy-Report-Only` with the strict policy.** Without a report endpoint nobody reads the reports; it would also print violations in the console on every page (criterion 6).
- **Dropping the boot script to make a strict policy easier.** Does not help: Next's own inline scripts remain.

## Tasks

Test first in every task: write the failing test, then the code. Each task is one hour or less. Run `pnpm test` (and `pnpm build && pnpm e2e` for groups B and C) before checking it off.

### Group A: the policy as data

- [x] **T1 CSP directives and serializer.** `tests/unit/lib/security-headers.test.ts`: `cspDirectives({ dev: false, vercelPreview: false })` equals the production table above exactly (one assertion per directive, plus the exact key set); `script-src` contains no `'unsafe-eval'` in production and contains it with `dev: true` (and nothing else changes in dev); `script-src` contains no source starting with `'sha256-`, `'sha384-`, `'sha512-` or `'nonce-` while it contains `'unsafe-inline'` (the invariant that keeps hydration working, with a comment pointing to ADR 0014); `frame-ancestors` is `'none'`; `connect-src`, `img-src`, `font-src` contain no `https:` source and no `*` in production; no `upgrade-insecure-requests`. `serializeCsp` gives the exact string for a two-directive fixture, keeps the fixed order, has no newline and no trailing `;`, and throws on a value containing `;`, `,` or `\n`. Then `src/lib/security-headers.ts` (header comment: ADR 0014, why `'unsafe-inline'`).
- [x] **T2 Preview allowance.** Same test file: with `vercelPreview: true` the Vercel Toolbar origins are added to exactly the directives listed in the approach (check against Vercel docs first and adjust the list); production values are a subset of preview values directive by directive (preview only adds); `frame-ancestors`, `object-src`, `base-uri` are identical. Then extend `cspDirectives`. If Diego chooses to disable the toolbar instead (decision 3), delete this branch and its test.
- [x] **T3 Header list.** Same test file: `securityHeaders({ dev: false, vercelPreview: false })` returns exactly `Content-Security-Policy` (the serialized production policy), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`, with no duplicate keys and every value free of newlines. Then `securityHeaders`. Run `pnpm test:coverage` (100% branches in `src/lib`).

### Group B: wiring and build

- [x] **T4 `next.config.ts`.** Extend `tests/unit/next-config.test.ts`: `await nextConfig.headers()` returns one rule with `source: "/:path*"` whose headers equal `securityHeaders({ dev: false, vercelPreview: false })` when `NODE_ENV` is `test` and `VERCEL_ENV` is unset; with `vi.stubEnv("VERCEL_ENV", "preview")` the CSP includes `https://vercel.live` (if T2 exists); `poweredByHeader` is `false`; the existing `env` assertion still passes. Then add `poweredByHeader: false` and `async headers()` to `next.config.ts` (relative import of the module).
- [x] **T5 Build stays static.** Run `pnpm build`: the route table must still mark `/` and every other page as prerendered static, with no new dynamic route (paste the table in the PR). Then `pnpm start` and `curl -sI http://localhost:3000/`, `/_next/static/...` (any chunk) and `/no-existe`: all carry the five headers. Fix and repeat until clean. No test file (build check), but record the output in the PR.

### Group C: end to end (`tests/e2e/security-headers.spec.ts`, all three projects)

- [x] **T6 Headers on every route, no violations.** For `/`, `/vitrina`, `/rivales`, `/comparar`, `/acerca`, `/privacidad`, `/changelog` and `/no-existe` (404): the document response has the five headers with the exact production values (import `securityHeaders` from the module to avoid a second source of truth). An `addInitScript` registers a `securitypolicyviolation` listener that pushes `{ effectiveDirective, blockedURI }` into `window.__cspViolations`; after load and `networkidle` the array is empty, and no `console` message of type `error` mentions "Content Security Policy". Hydration proof on `/`: typing "velez" in the search box leaves one radio (needs client JS, so it fails if Next's inline scripts are blocked). Open the info menu on one route and check it opens.
- [x] **T7 Boot script, inline style, framing and exfiltration guards.** (a) Seed the fan record for `river-plate` with `addInitScript`, block `**/_next/static/chunks/**`, load `/`: `html[data-club="river-plate"]` is set and the computed `--accent` is `#ff6f64` (boot script ran and the inline `<style>` applied under the CSP), with no violation recorded. (b) Without a record, `--accent` is `#c6ff3d`. (c) From the page, `fetch("https://csp-check.invalid/x")` rejects and a violation with `effectiveDirective === "connect-src"` is recorded; the same for an `Image` with a cross-origin `src` (`img-src`). (d) `page.setContent('<iframe src="http://localhost:3000/"></iframe>')` on `about:blank`: the child frame never contains `#contenido` (blocked by `frame-ancestors`). Keep (d) as best effort: if a browser reports framing differently, assert the header instead and note it in the PR.
- [x] **T8 Referrer policy with a real flow.** Complete the onboarding with `1990-05-20`, then from `/vitrina` trigger a cross-origin navigation (an injected `<a href="https://referrer-check.invalid/x">` clicked) and intercept it with `page.route("https://referrer-check.invalid/**")`, recording `request.headers().referer`. With `same-origin` it is absent (with `strict-origin-when-cross-origin` it would be exactly `http://localhost:3000/`); in every case no header value of the intercepted request contains `1990`, `20/05` or `19900520`. A same-origin navigation still sends the full referrer (`http://localhost:3000/vitrina`), proving the header is applied and not just the browser default.

### Group D: close

- [x] **T9 ADR 0014.** Write `docs/adr/0014-security-headers-policy.md` (Context / Decision / Consequences): the inline script inventory found in the build, the three options and Diego's choice, the policy table, why no hash is sent under option A and the invariant test that guards it, how the boot script hash would be computed and pinned (for a future switch), inline style trade-off, Referrer-Policy choice, Vercel Toolbar handling, and when to revisit (a route with a dynamic hole, user-generated content, a third-party script, or Next adding hash support for its inline scripts). In the same change, add one line to ADR 0013's consequences pointing to 0014 ("the boot script alone could use a hash, but Next's own inline scripts cannot; see 0014"), without changing its decisions.
- [ ] **T10 Preview check and plan close.** Open the Vercel preview of the PR (Diego, or the reviewer with access): DevTools console clean on `/`, `/vitrina`, a 404 and after a full onboarding; toolbar works (or is disabled, per decision 3); `curl -sI` the preview URL shows the headers. Record the result and Diego's answers in "Decisions recorded" and set `status: done`.

## Tests to write (summary)

- **Unit (Vitest, node):** `tests/unit/lib/security-headers.test.ts` (directives, serializer, preview branch, header list, the no-hash-with-unsafe-inline invariant); extended `tests/unit/next-config.test.ts` (headers rule, env branches, `poweredByHeader`).
- **E2E (Playwright, iphone, android, desktop, against `pnpm start`):** `tests/e2e/security-headers.spec.ts` (T6 to T8). Existing `onboarding`, `footer`, `layout`, `a11y-shell`, `info-menu` specs must pass unchanged: they are the broad proof that hydration survives the CSP. Note: Playwright's `page.evaluate` and `addInitScript` run through DevTools and are not blocked by the page CSP, so existing specs keep working; checks that need the CSP to apply create the request from page code (an appended element or a `fetch` inside the evaluated function, which the page CSP does govern).
- **Manual:** build route table (T5), `curl -sI` on local and preview (T5, T10), preview console (T10).
- **Edge cases:** 404 page (Next's own inline styles and scripts); `/_next/static` assets get the headers too (harmless, `nosniff` is useful there); RSC requests and prefetches (same headers, no effect); dev mode (`'unsafe-eval'` present, HMR works over `connect-src 'self'`); preview vs production builds (`VERCEL_ENV`); fan record seeded with hydration blocked (boot script and style under CSP); storage unavailable (existing onboarding e2e, unchanged); a cross-origin `fetch`, image and frame attempt.

## Impact

- **Data:** none.
- **Design:** none visible. Theming, fonts and the 404 page render as before (T6, T7).
- **Security and privacy:** adds a CSP that blocks third-party scripts, cross-origin `fetch`/XHR/beacons/WebSockets, cross-origin images and fonts, plugins, `<base>` hijacking, form posts out and framing; plus `nosniff`, a referrer policy that sends nothing cross-origin (recommended), `X-Frame-Options`, a restrictive `Permissions-Policy`, and no `X-Powered-By`. Known limit, recorded in ADR 0014: inline scripts are allowed (option A), and no CSP can block a navigation-based leak. Any future third-party origin (Supabase from the browser, analytics, images from a CDN) must be added to the policy and its test on purpose, which is the intended friction.
- **Performance:** about 400 bytes of extra response headers per request; no runtime code, no proxy, no change in rendering (every route stays a static shell, served from the CDN).

## Risks and mitigation

- **A blocked Next inline script breaks hydration silently** (the page still paints from HTML). Mitigation: the no-hash invariant test (T1), the hydration check in T6, and the existing interactive e2e specs.
- **Vercel Toolbar origins drift** (Vercel changes the hosts). Mitigation: T2 checks the docs at implementation time; T10 checks the preview console; fallback is disabling the toolbar (decision 3).
- **Header differences between `pnpm start` and Vercel.** Both read the same `headers()` output, but Vercel applies it at the CDN. Mitigation: `curl -sI` on the preview in T10.
- **`next.config.ts` import path.** The `@/` alias is not resolved when Next loads the config. Mitigation: relative import; T4 imports the real config in Vitest and `pnpm build` (T5) loads it in Next.
- **Dev experience.** A too-strict dev policy would break HMR or the error overlay. Mitigation: dev adds only `'unsafe-eval'` (Next guide); check `pnpm dev` by hand once in T4.
- **Future dynamic routes or new inline content.** They keep working under option A; switching to B or C later is a new ADR.

## Definition of done

- Every acceptance criterion maps to a check: headers on every page (T3, T4, T5, T6); boot script runs under the CSP (T7a) with criterion 2 as amended by Diego's answer to decision 1 (option A: no hash or nonce, invariant in T1); inline style renders (T7a, T7b, T6 on the 404); referrer policy and no date exposure (T8); `/` still prerendered static (T5); e2e green and preview console clean (T6, T10).
- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/lib`), `pnpm build` (route table unchanged) and `pnpm e2e` on the three projects are green.
- ADR 0014 written and accepted; ADR 0013 consequence line points to it.
- Diego's answers to decisions 1 to 4 recorded below.

## Decisions recorded

Diego answered on 2026-10-17:

1. **Script policy:** option A (`script-src 'self' 'unsafe-inline'`, everything else strict). Criterion 2 of issue #55 is amended: no hash is sent, because Next's own inline scripts cannot be hashed and `/` must stay static.
2. **Referrer-Policy:** `same-origin`.
3. **Vercel Toolbar:** its origins are allowed only on previews (`VERCEL_ENV=preview`).
4. **Extras** (`X-Frame-Options: DENY`, restrictive `Permissions-Policy`, `poweredByHeader: false`): left as the plan recommends; reviewed on the live site.
