# 0022 — Opponents in the clubs table

Status: **Accepted** (2026-10-23). Written with the re-plan of Phase B of plan 0017 (issue #70). Diego approved D-B1 and D-B2 on 2026-10-23.

## Context

The cups bring matches against clubs that are not in the onboarding: Copa Libertadores and Copa Sudamericana opponents from the ten CONMEBOL countries, and the lower-division clubs of the Copa Argentina draw. ADR 0016 scopes `data/clubs.json` to clubs that played a top-flight season we ingest and makes every club selectable in the onboarding; each club needs sourced colors, a jersey pattern, a founding year and a city (ADR 0012). Loading about 60 foreign clubs per year under those rules would flood the onboarding and require research of colors the project has no source for.

Diego approved on 2026-10-23: foreign and lower-division clubs are loaded only when one of the 34 clubs plays them, and only those matches are kept.

## Decision

1. **Same table, not selectable.** `clubs` gains `selectable` (boolean, default `true`) and `country` (ISO 3166 alpha-2, required when `selectable` is `false`). A club that is not selectable is an **opponent**. Matches keep referencing `clubs` through `home_id` and `away_id`, so the engine, the validator's referential rules and the Supabase foreign keys do not change.
2. **Opponents have no sourced colors.** `colors`, `jersey_pattern` and `founded` are optional for opponents; `source` stays required (the RSSSF page where the name appears). A record with colors keeps ADR 0012's contrast rules.
3. **Generic crest.** An opponent without colors gets one neutral crest with its initials. No color is researched without a source.
4. **Selectable only in the UI.** The onboarding grid, the search, the `/rivales` club list and the compare picker show `selectable` clubs only. Matches against opponents count in the fan's totals, history, titles and coverage.
5. **Name resolution is unchanged.** Exact aliases; an unknown name stops the run, and the list of new opponents is given to Diego for approval before any record is written.

## Alternatives

- **A separate `opponents` table.** Cleaner semantics, but every match then needs two possible parents, the engine and the Supabase schema get a second join and the validator a second lookup. Rejected for cost.
- **Load every club of the pages with full records.** Needs colors, a founding year and a city for dozens of foreign clubs per year, from sources we do not have. Rejected.
- **Drop the matches against opponents.** The fan's cup record would be wrong. Rejected.

## Consequences

- A migration for the two columns (with the parity tests of ADR 0006) and the Zod schema change; existing data validates unchanged.
- `club-options` and the views filter on `selectable`; the golden and equivalence tests are updated for the cups.
- The validator checks that an opponent has a country and a source and that no opponent appears in the onboarding data.
- If opponents later need their own page, a separate table can be added without undoing this.
