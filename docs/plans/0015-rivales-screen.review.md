# Review report: plan 0015, "[Mi club] vs. Todos" (issue #65)

## Verdicts

| Auditor                | Verdict  |
| ---------------------- | -------- |
| code-reviewer          | APPROVED |
| security-auditor       | APPROVED |
| ui-designer-auditor    | APPROVED |
| data-integrity-auditor | APPROVED |

## What the auditors verified

- **Data (recomputed independently):** the data auditor counted River Plate's record against every rival with its own Node script on `data/matches.json` (no engine), and it matched the screen: 33 rivals, 181 matches, 21 favorable, 11 even, 1 unfavorable, with six rivals compared one by one (for example Lanús 7 played 6-1-0, +6, and Talleres 7 played 2-1-4, -2). Results of 2022 and 2023 matched the es.wikipedia season pages, and River's 2023 title table (19-4-4, 50 to 20) equals the dataset. Dominance thresholds, year options (2018 to 2025), tournament types and the coverage notice texts agree with the data.
- **Privacy:** the start date was traced through every place it flows (request, console, error boundary, title, aria text, data attributes, storage key, the "Desde mes de año" text) and does not leak. The route validates the club id with Zod, answers a fixed 400 without echoing the input and never logs. The `/rivales` client chunks have no Zod and no club data. No new dependency.
- **Code:** the load race (changing club while a load is in flight, retry, StrictMode), hook order, the server/client boundary, hydration with the `"unknown"` snapshot and the pending CSS, and 100% branch coverage were reviewed; no existing test was weakened.
- **UI:** coherent with "Césped y neón", River's coral accent legible, chips use text and icon, the coverage notice is honest and not alarming, the copy is Rioplatense with voseo and no betting or violence.

## Findings and what was done

Fixed in this PR:

1. **Stale error on return to a club** (code-reviewer). If a club's load failed, going to another club that was still loading and back showed the old error for a moment. The result is now cleared when the club changes, with a test that reproduces it.
2. **No-matches state had only a heading** (UI). It now says "Todavía no cargamos partidos de tu club en este período."
3. **Skeleton did not match the final layout** (UI). It now has the header, notice and filters placeholders.
4. **Chips were 12 px** (UI). They are now 14 px.
5. **`aria-sort="none"` on every column** (code and UI). Only the sorted column carries it.
6. A comment next to the pending CSS rules says both blocks (each with an `h1`) are in the DOM, and ADR 0018 records that the "Desde mes de año" text derives from the start date and must never be logged or sent.

Left as is, on purpose:

- **Crowding above the fold on a phone** (UI): the notice, the "Contamos" line and the cups line push the summary cards down. They are the honest part of the screen; merging them is a design change for Diego to ask for.
- **A "Ver más" for the long list** (about 33 cards) and **a focus offset** on the filter chips: polish for phase 5.
- **`isClubData` does not check the score fields** (code): the server is ours and the error boundary catches a render error.
- Titles, movements and rivalries are empty today, so `isClassic` is always false; this does not affect the numbers.

## Checks run

`pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (106 files, 1543 tests, 100% branches in `src/domain`, `src/data-model` and `src/lib`), `pnpm data:validate`, `pnpm data:coverage --check`, `pnpm build` (`/rivales` static, the club route prerendered for the 34 clubs, 150.6 KB gzip of module scripts against a 170 KB budget) and `pnpm e2e` (231 tests on iphone, android and desktop).
