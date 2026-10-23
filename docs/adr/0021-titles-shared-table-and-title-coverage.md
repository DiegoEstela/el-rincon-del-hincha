# 0021 — Titles travel as a shared table, and the vitrina derives its own title coverage

Status: **Accepted** (2026-10-24, Diego approved plan 0018 D1 to D11). Written with plan 0018 (issue #67, the vitrina `/vitrina`). Amends ADR 0018 decision 1 (what a per-club document holds). Accepted with plan 0018.

## Context

The vitrina shows the titles a fan's club won during the fan's period, the competitions it still has not won ("te faltan"), and the detail of each title. It computes in the browser on the fan's own per-club document (ADR 0018), so the start date never leaves the device.

- **What the document has today.** `sliceClubData` keeps only the club's own rows of `titles.json` (ADR 0018 decision 1). That is enough for `titlesInPeriod`, but not for three things the vitrina needs: (1) the co-champion of a shared title ("compartido con ..."); (2) whether a season's champion is loaded at all; (3) the window of seasons whose champions we know.
- **Title lists do not depend on match coverage** (methodology, "Recognized titles"), and the match coverage table (ADR 0017) says nothing about titles. A season can have every match loaded and no champion record (the 2020 Copa Diego Armando Maradona today), or a champion without matches (any title before 2018-19 once plan 0017 loads them from 1985-86).
- **Titles arrive piece by piece.** Plan 0017 (D5) writes first-division league titles from RSSSF; cup titles come later from whichever permitted source lands first (plan 0017, D10 as changed by Diego). `data/titles.json` does not exist yet.
- **Never claim what we do not know.** A "te falta" silhouette is a claim: "your club did not win this in your period". With partial title data it is false for, say, a fan of a club that won a league before the first season we have.
- **Size.** About 70 first-division seasons from 1985-86 give about 70 title records of about 220 bytes: about 15 KB raw, about 2 KB gzip, the same for every club document.

## Decision

1. **`titles` becomes a shared table of the per-club document**, like `competitions` and `seasons`: `sliceClubData` keeps every title record, sorted by id. `statsDataFromClubData` already dedupes titles by id. The document shape and its version (`v: 1`) do not change; only the meaning of the `titles` array does. The equivalence test of ADR 0018 extends to the title functions.
2. **Title coverage is derived, never stored.** A pure function `titleCoverage(index)` in `src/domain/titles.ts` returns, per recognized competition, the loaded seasons that have at least one title record: the first and the last of them (the **title window**, from the first one's `start` to the last one's `end`), and the decided seasons inside the window that have no champion (`end` before today, no title record). A competition with seasons loaded and no title at all has an empty window. No file is added to `data/`, and the validator does not change.
3. **Every vitrina claim is scoped to the title window.** A lit trophy is a loaded title inside the fan period (always true). A "te falta" silhouette means "no title of this competition inside the fan period and inside its title window", and the screen says the window ("No lo ganaste entre la Superliga 2018-19 y el Torneo Clausura 2025"). A competition with an empty window, or whose window does not overlap the fan period, never gets a silhouette: it is listed as "sin datos todavía". `pendingTitles` is amended to apply this rule.
4. **The vitrina has its own notice**, built from the title coverage of the fan period, rendered by the existing `CoverageNotice` component (so the "cups not loaded" line always shows and there is no complete state). It never shows a "complete" badge while plan 0014 Phase 2 is open.

## Consequences

- Every club document grows by the whole titles table (about 2 KB gzip with titles from 1985-86). The size test of ADR 0018 records it; it stays far below the 130 KB era-split threshold.
- Shared titles can name the co-champion, and a future "who won it" line needs no new data.
- The vitrina is honest with any amount of title data: with first-division titles only, the international and "other" shelves say they are not loaded; with no titles at all, the screen says so instead of showing zeros.
- A season that is missing from `seasons.json` in the middle of a window is invisible to the derivation (the same limit as the match coverage table, methodology "Coverage table"). Sources must load whole runs of seasons, which plan 0017 already enforces with its config checks.
- The counters ("Trofeos ganados", "Trofeos que te faltan") always carry the caption "en los torneos y temporadas que tenemos cargados".
- If titles ever need provenance beyond `source` (a disputed criterion per title, for example the 2025 "Anual LPF"), the title schema gains an optional field through a data-model issue; this ADR does not add one.
