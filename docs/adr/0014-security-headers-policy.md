# 0014 — Security headers and Content-Security-Policy

Status: **Accepted** (2026-10-17). Written with plan 0010 (issue #55). Diego chose on 2026-10-17: script policy option A (`'unsafe-inline'`, no hash), `Referrer-Policy: same-origin`, and the Vercel Toolbar allowed on previews only. The extra headers (`X-Frame-Options`, `Permissions-Policy`, no `X-Powered-By`) were left as the plan recommends.

## Context

The app sent no security headers. The security audit of PR #52 flagged it as non-blocking and noted that ADR 0013 inlines a constant `<style>` (club accents) and a constant boot `<script>` (no-flash theming), so a strict policy had to decide how to allow them.

Looking at the real build (`.next/server/app/`), our boot script is only one of many inline scripts: `/` has 17 and every other page 14. The rest belong to Next: the Turbopack bootstrap and the `self.__next_f.push` RSC flight chunks. Their content, and so their hash, changes per page and per build, and Next 16 can neither hash them nor move them out of the HTML (`experimental.sri` only covers external chunks).

## Decision

1. **Where.** `async headers()` in `next.config.ts`, one rule for `/:path*`. No `proxy.ts` and no request API, so every route stays a prerendered static shell. The values come from the pure module `src/lib/security-headers.ts`, unit tested as data.
2. **Script policy: `script-src 'self' 'unsafe-inline'`** (plus `'unsafe-eval'` in development only). **No hash and no nonce is sent.**
   - A nonce forces every route to render dynamically, which loses the static shells ADR 0013 chose the inline script to keep.
   - A hash of our boot script alone is possible (`sha256` of `themeBootScript()` in base64), but listing any hash or nonce next to `'unsafe-inline'` makes browsers ignore `'unsafe-inline'`. Next's own inline scripts are then blocked and the page never hydrates. A unit test pins that `script-src` has no hash or nonce source.
3. **Rest of the policy, strict:** `default-src 'self'`, `img-src 'self' data:`, `font-src 'self'`, `connect-src 'self'` (the exfiltration guard), `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`. No `upgrade-insecure-requests`, no `'strict-dynamic'`, no Trusted Types, no report endpoint.
4. **Inline style: `style-src 'self' 'unsafe-inline'`.** A hash of the club CSS would leave Next's own 404 and global-error pages unstyled, which render `style` attributes and their own `<style>`. Changes through the CSSOM (`motion`, `setProperty`) are not governed by `style-src`. The residual risk is CSS injection, which needs an HTML injection point the app does not have, and `img-src` and `font-src` block the cross-origin requests such an attack needs.
5. **Other headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` (nothing is sent to other sites, which backs the rule that the start date never leaves the device), `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`, and `poweredByHeader: false`.
6. **Vercel Toolbar.** Only when `VERCEL_ENV=preview`, the origins from Vercel's documentation are added to `script-src`, `style-src`, `connect-src`, `img-src`, `font-src` and `frame-src`. Production never gets them.

## Consequences

- Scripts injected into the HTML would run. The protection is that nothing can load from, or send data to, other origins, and that no one can frame the app.
- If the boot script ever needs a hash (for example when Next can hash its own inline scripts), it is computed at build time as `createHash("sha256").update(themeBootScript(), "utf8").digest("base64")`, pinned by a unit test against a literal and by a build check against the bytes in the HTML, and the policy moves to `script-src 'self' 'sha256-…'`.
- **Revisit** when a route has a dynamic hole, when user-generated content appears, when a third-party script is added, or when Next supports hashing its inline scripts.
- Any new origin (analytics, fonts, images) must be added to the policy on purpose, with a test.
