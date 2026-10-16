# Review report — issue #5 (data sources spike)

| Auditor                | Round 1          | Round 2                                                  |
| ---------------------- | ---------------- | -------------------------------------------------------- |
| code-reviewer          | CHANGES REQUIRED | APPROVED                                                 |
| security-auditor       | APPROVED         | not repeated (no security-relevant change since)         |
| data-integrity-auditor | CHANGES REQUIRED | one objection (quota claim), fixed afterwards, see below |

## What the audits changed

- **"Complete" coverage was overstated.** openfootball files are internally consistent (header count equals scored lines) but each file covers one tournament per year (2022: the league played 3 Jun to 25 Oct, for example). The ADR now says so, records coverage per competition and no longer calls 2018-19 to 2024 complete.
- **Last data update of openfootball** corrected to 2025-05-05; a later commit (2026-05-28) only reformatted.
- **Call count** corrected from 22 to 16.
- **581 vs 378 fixtures** for 2022 is recorded, with the likely explanation (another tournament under the same league id) marked as not verified.
- **Quota cost claim.** Round 2 found that the "4 requests counted" figure was an inference from non-monotonic headers. The ADR and the script header now say 16 calls, 7 returned data, exact cost not established, between 7 and 16 of 100 (third round of data-integrity-auditor asked for the bounded range instead of "worst case 7"). Not re-audited after this one-line fix.
- **2026** is marked as inferred, not probed.
- **Probe script:** Zod validation for `/status` and `/leagues`, a 15 s timeout, abort on 429 or 5xx, no `as` casts left.
- **TheSportsDB** stays unassessed (docs returned HTTP 522 twice); follow-up issue #29.

## Spot checks against independent sources (data-integrity-auditor, English Wikipedia season articles)

- 2022: Boca clinched the title on 23 Oct 2022 (Boca 2-2 Independiente, Racing 1-2 River) and the openfootball file shows the same results and date.
- 2023: River 3-1 Estudiantes on 15 Jul 2023 matches the file, and the season dates match.
- 2024: season dates 10 May to 16 Dec match the file header.

## Security

No key printed, logged or written; the saved JSON holds only plan name, status, quota numbers and coverage flags. Only the known dev-only `braces` advisory (#4) remains.
