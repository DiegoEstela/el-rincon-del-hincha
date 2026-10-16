# Review report — Plan 0007 (issue #39)

| Auditor                | Round 1                      | Round 2                               |
| ---------------------- | ---------------------------- | ------------------------------------- |
| code-reviewer          | APPROVED (two docs findings) | APPROVED (one test hygiene finding)   |
| security-auditor       | APPROVED                     | not repeated (no relevant change)     |
| data-integrity-auditor | CHANGES REQUIRED (3 clubs)   | APPROVED (after two docs count fixes) |

## What the audits changed

- **Data, round 1 (independent sources: Wikidata, official club sites, the Copa Argentina page, live Wikipedia).** 22 of 29 clubs confirmed. Three corrected:
  - **Deportivo Riestra**: the current home shirt (since 2012) is black with white details; the striped kit is the traditional one. Pattern changed from `vertical_stripes` to `solid`. Round 2 confirmed it with the official-replica store (2024-25 home shirt "diseño negro") and press.
  - **Defensa y Justicia**: no source states the stripe direction of the body of the current shirt; the sources describe a yellow shirt with green collar and cuffs. Pattern changed to `solid`, the safest reading. Colors (yellow and green) confirmed.
  - **Independiente**: kept, with an explicit decision. `founded` is the OFFICIAL year (1905, the constitutive assembly of 1 January 1905) while the club celebrates its birth on 4 August 1904. The second color navy blue is the recurring home trim (shorts and socks), quoted from es.wikipedia, ESPN Argentina and club press; the caveat is that red alternates with it by season.
- **Platense** founding year: the Spanish Wikipedia lead says 1930 but its infobox, its history and en.wikipedia say 1905; the file keeps 1905 (a typo in the lead).
- **Code review.** The short name limit is 15 characters (not 14) everywhere in plan and ADR; `PENDING_CLUB_IDS` carries the issue number; the alias script fails friendly (exit code 2) when the local CSV is missing and skips and counts malformed rows; the accent test now uses real unicode escapes so a formatter cannot normalize the two strings (the comment had claimed escapes that were not there) and the spawned CLI test has a 15 second timeout.
- **Honesty about counts.** Two plan lines still said 30 records after the dataset went to 29; fixed after the second data audit.

## Decisions by Diego (2026-10-16)

- The more intense celeste (`#3b94e0`) for Racing, Atlético Tucumán and Belgrano is accepted so the generic crest keeps the 3:1 contrast between primary and secondary.
- Independiente Rivadavia stays out for now (issue #48).
- Single-band shirts stay `other` until a `band` value exists (issue #49).
- Credits of the data sources on the About page: issue #50.

## Known limits

- Atlético Tucumán, Rosario Central and others have an ambiguous primary and secondary order between sources; the choice is recorded in the verification log.
- Sarmiento de Junín and Lanús: white as the second color is supported mainly by the Spanish Wikipedia infobox.
- The data auditor used WebFetch-free tools (curl, Wikidata) and could not always reach press sources; the log says which source was reached.

## Known

`pnpm audit` reports only the dev-only `braces` advisory tracked in #4.
