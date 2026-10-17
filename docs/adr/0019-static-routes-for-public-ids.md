# 0019 — Static routes for public ids: prerender the dataset ids, 404 on the server, fan states in the browser

Status: **Accepted** (2026-10-18). Written with plan 0016 (issue #66, the rivalry detail `/rivales/[rival]`). Diego approved plan 0016 D1 to D10; the build check of task T1 passed (see Verification).

## Context

The rivalry detail is the first page route of the app with a dynamic segment. More will follow (a trophy detail in the vitrina, maybe a club page). Constraints:

- **Static shells.** `cacheComponents: true` and `partialPrefetching: true` (ADR 0013, 0014, 0018): every route is a prerendered static shell. Under Cache Components, `dynamicParams` is not available, `generateStaticParams` must return at least one param, and a param that was not prerendered is rendered on its first request. With Partial Prefetching (Next 16.3 and later) such a request can get the generic App Shell first (status 200) and the page content streamed after it, so a `notFound()` thrown while rendering the content would be a soft 404. Next 16.4 adds `export const ensureStatic = "navigation"`, which fails the build when the route reads request data and makes an unlisted param wait for its complete render (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/ensureStatic.md`).
- **Two kinds of input.** The segment value (a club id) is public: it is in the URL and in the dataset. The fan's club and start date live only on the device (ADR 0013, 0018), so the server can never know whether the rival is the fan's own club.
- **Privacy.** Nothing derived from the start date may reach a URL, request, log, cookie, error or analytics event (ADR 0013 decision 7, ADR 0018).
- **No proxy.** `next.config.ts` deliberately uses plain header rules and no proxy (middleware), so no request-time code runs on static routes.

Options evaluated (details in plan 0016, "Discarded alternatives"):

- **A.** A dynamic segment prerendered for every dataset id with `generateStaticParams`; the page validates the id with the server schema and calls `notFound()`; `ensureStatic = "navigation"`; everything that depends on the fan is rendered by a client component.
- **B.** The id in a query string (`?rival=`): `searchParams` makes the route dynamic.
- **C.** A client-only page reading `useParams()`: unknown ids would answer 200, and the public part (the rival's name and crest) would not be in the static HTML.
- **D.** Validating ids in a proxy: request-time code on every navigation, against the current setup.

## Decision

1. **Option A.** A page route whose segment is a public dataset id:
   - exports `generateStaticParams()` with every id of the dataset (built at build time from the server-only data module, like the club route of ADR 0018);
   - awaits `params` in the page, validates the id with the Zod schema of `src/lib/engine-input.server.ts` (`clubIdSchema` for clubs) and calls `notFound()` when it fails;
   - exports `ensureStatic = "navigation"`, so the build fails if the route ever reads cookies, headers, `searchParams` or uncached data, and an unknown id gets a real 404;
   - has a `not-found.tsx` with friendly copy that never echoes the id.
2. **The server renders only public data.** The page passes public records (the catalog, the rival's `ClubOption`) to a client component. Metadata (`generateMetadata`) is built from the public id only, never from the fan, and the client never rewrites `document.title`.
3. **Fan-dependent states are decided in the browser,** before any load or engine call, with the hand-written client guards (`parseRivalId`: `same_club` gives a friendly state, the engine is never called). The pending markup before hydration follows ADR 0018 (CSS on `html[data-club]`).
4. **Personal pages are not indexed:** routes whose content is the fan's own numbers export `robots: { index: false, follow: true }` (plan 0016, D7).
5. **Fallback if T1 shows the 404 cannot be obtained statically:** keep option A, answer a soft 404 (status 200, `noindex`, the same friendly UI), and record it here. A proxy or a dynamic route is not an acceptable fix.

## Consequences

- Known ids are files on the CDN; there is no function cost except for unknown ids, each of which costs one render ending in `notFound()` (the same order of cost as the 400 of `/api/clubs/[clubId]`). The T1 check confirms that unknown ids are not stored as pages.
- The public part of the page (the rival's name and crest) is in the static HTML, which helps the first paint; the numbers still arrive after hydration (ADR 0018).
- A "same club" visit is a 200 with a friendly state, not an error: the server cannot know the fan's club, and the browser decides.
- `ensureStatic` is new in Next 16.4. If it changes, removing it keeps the route static; the build output check in each plan (route list, prerendered paths) stays the second line of defense.
- Future dynamic routes with public ids (a trophy, a club) follow the same pattern. Routes whose segment is not a public dataset id (for example a comparison slug in #16, stored in Supabase) are out of this ADR and need their own decision.

## Verification (plan 0016, T1)

On a production build (`pnpm build`, `pnpm start`) with a minimal page and `ensureStatic = "navigation"`:

- The route list shows `/rivales/[rival]` with the 34 ids prerendered; `.next/server/app/rivales/` holds 34 `.html` files plus the generic `[rival].html`.
- `GET /rivales/boca-juniors` answers **200**.
- `GET /rivales/not-a-club` and `GET /rivales/..%2Fapi` answer a real **404** with `noindex` in the body, repeated requests included.
- No file is created under `.next/server/app/rivales/` for unknown ids.

The soft 404 fallback (decision 5) is therefore not needed.
