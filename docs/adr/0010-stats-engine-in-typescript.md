# 0010 — Statistics engine: pure TypeScript over in-memory records, Postgres only fetches

Status: **Accepted** (plan 0005, issue #14; product decisions confirmed by Diego on 2026-10-16).

## Context

Every number a fan sees (P/W/D/L, balance, dominance, streaks, titles, finals, the friend comparison) follows the calculation rules of `docs/methodology.md`. The master prompt (section 6) puts the pure logic in `src/domain` with 100% branch coverage, and also says that heavy queries (history by date range) are solved in Postgres with SQL functions or views. If the rules were written in SQL as well as in TypeScript, there would be two implementations of "a shoot-out counts as a draw", "suspended matches do not count", the coverage notice and so on, and they could drift apart without any test noticing.

The dataset is small: about 30 current clubs, a few decades of matches, so at most tens of thousands of match rows overall and a few thousand per club.

## Decision

1. **The statistics engine is the single implementation of the methodology.** It lives in `src/domain/` as pure functions (no I/O, no `Date.now()`, the clock is passed in as `now: Date`) over plain arrays of data-model records (`Match`, `Title`, `Coverage`... from `src/data-model/types.ts`).
2. **Postgres (and `src/data/` repositories) only select and cache rows**: for example "the matches of club X and of its rivals" or "the matches between X and Y". They never compute P/W/D/L, balance, dominance, streaks, titles in period or coverage status. SQL indexes on `(home_id, date)` and `(away_id, date)` stay as planned, for fetching.
3. **Entry point:** callers build one `StatsIndex` with `buildStatsIndex(data: StatsData)` (lookups by id, matches per club sorted by date then id) and pass it to every engine function. `StatsData` is a narrow, read-only view of the data model (`statsDataFrom(dataset)` adapts the validator's `Dataset`).
4. **Engine output is language-neutral.** Enumerations are English string literal unions exported with `as const` objects (for example `Dominance = { Dominates: "dominates", Even: "even", Dominated: "dominated" }`), never TypeScript `enum` (the repo uses `isolatedModules`, and string unions serialize cleanly). Spanish labels ("Dominás", "Parejo", "Te domina", "Te tiene de hijo") belong to the UI layer.
5. **Configurable thresholds are exported constants** (`DOMINANCE_THRESHOLDS`, `WIN_MILESTONE_STEP`) that every function accepts as an optional parameter defaulting to the constant, so tests and a future settings screen can change them without touching the rules.

## Consequences

- One place to test each methodology rule; the screens (#15) and the comparison (#16) cannot disagree with each other.
- Per-request work is in memory: a club's full history is a few thousand rows, which is well under a millisecond per function. If the dataset ever grows by orders of magnitude, the repositories can pre-filter by date range in SQL without moving any rule.
- The engine can also run at build time (ISR) or in a route handler, since it has no dependency on the runtime.
- Supabase views that expose aggregated numbers are out of bounds; if one is ever needed for performance, it must be generated from or tested against the engine.
