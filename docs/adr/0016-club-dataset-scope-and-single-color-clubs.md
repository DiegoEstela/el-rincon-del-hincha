# 0016 — Club dataset scope and single-color clubs

Status: **Accepted** (2026-10-17). Written with plan 0012 (issues #60 and #48). Diego approved decision 1 (D2: the former clubs are selectable), decision 2 (D1: the documented trim as `secondary`) and the Arsenal shade of decision 3 (D4) on 2026-10-17. Decision 3 otherwise follows from ADR 0012.

## Context

Plan 0007 scoped `data/clubs.json` to the 30 clubs of the Primera División 2025 (openfootball `2025_ar1.txt`). The openfootball adapter (ADR 0015) ingests the seasons 2018-19 to 2025, and four clubs of those seasons are no longer in the top flight: Arsenal de Sarandí, Colón de Santa Fe, Patronato de Paraná and San Martín de Tucumán. An unresolved team name stops the ingestion (ADR 0012, decision 2), so no real match can be written until those clubs exist. The onboarding grid is built from every record of `clubs.json` (plan 0008), so adding a club also makes it selectable.

Independiente Rivadavia (issue #48) was left out by plan 0007 because its official colors name a single color (dark blue) and `colors.secondary` is required by the Zod schema, the validator and the Supabase `clubs` check `colors ?& array['primary', 'secondary']`. ADR 0012 already defines `secondary` for a `solid` shirt as "the main trim color", but plan 0007 only looked for a second **official** color. Press descriptions of the 2026 home kit name white trim; the Spanish Wikipedia article (the record's `source`) does not.

## Decision

1. **Scope: every club that played a top-flight season we ingest.** `clubs.json` holds the clubs of the current Primera División plus every club that appears in a top-flight season of an ingested source. Former clubs follow the same record rules (ADR 0012, plan 0007) and are not marked or separated in the data. They are selectable in the onboarding like any other club (their fans exist and their history is real; coverage gaps are shown, not hidden).
2. **Single-color clubs use their documented home-kit trim as `secondary`.** When a club's official colors name one color and its home shirt is `solid`, `secondary` is the main trim color of the current home kit, as ADR 0012 already says. Because the cited Wikipedia revision may not describe trim, the trim needs **two independent sources other than the record's `source`** (for example two press reports of the kit launch), listed in the plan's verification log with the date read. If no trim can be verified, the club stays out and the schema is not relaxed silently. The alternative (an optional `secondary`, with a migration) is described in plan 0012 and rejected for now.
3. **Palette variant `celeste claro`.** Arsenal's official colors (celeste with a red sash) do not reach 3:1 with the base celeste against `rojo` (2.24:1). A lighter shade in the celeste family, `celeste claro` (`#a9d6f5`, 3.25:1 against `rojo`), is added to the project palette, as ADR 0012 allows ("tuned only within the same color family"). It is a project shade, not the club's hex.

## Consequences

- The openfootball ingestion can resolve every team name of 2018-19 to 2025, so issue #8 can commit real matches.
- The onboarding grid grows from 29 to 34 clubs (the four former clubs and Independiente Rivadavia, shipped together). The empty-state copy "Por ahora están los clubes de la Primera División." becomes inaccurate and is changed with the clubs (plan 0012, D2).
- Later adapters (Kaggle, from 1967) will add many more former clubs under the same rule; the grid will need grouping or search-first behavior before that. That is a separate issue, not this ADR.
- No schema, validator or migration change: `secondary` stays required, the Supabase constraints stay as they are, and seeding needs no migration.
- A trim color can change with the next kit. The record pins the trim verified on the date in the log; a later change is a normal data PR with new sources. The id never changes.
- If Diego prefers the optional `secondary` (rejected alternative of D1), this ADR is superseded by one that relaxes the schema, adds a migration with parity tests, and amends ADR 0012 decision 5 (a single dark color cannot reach 3:1 against the app backgrounds).

## Known weakness: Independiente Rivadavia (recorded 2026-10-17)

Decision 2 asks for two independent sources for the trim. For `independiente-rivadavia` the rule is met only weakly, and Diego accepted it knowing this:

- Mendoza Post (16 Jan 2026) names a white detail on the sleeves and the collar of the home shirt.
- El Sol (17 Jan 2026) names a white edge (`ribete`) on the **shorts** only, and describes the 2026 shirt as "azul eléctrico en Jacquard", which disagrees with Wikipedia, the official site and Mendoza Post (all dark blue). The one source that disputes the shade is also one of the two that support the trim.
- The official site never mentions white, and the cited Wikipedia revision calls the shirt "lisa".
- The kit that both reports describe is the 2026 home kit, so the trim can change with the next kit.

`primary` stays `azul marino` (three sources against one) and `secondary` stays `blanco`. A better source (a kit-launch caption or the club's own post describing white on the shirt) would settle it; until then the record is the least certain of the five and is flagged as such in plan 0012.
