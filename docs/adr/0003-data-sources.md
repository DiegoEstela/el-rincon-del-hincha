# 0003 — Data sources

Status: **Proposed.** Measurements for API-Football are pending the key from Diego (see "Pending").

## Context

No free API covers decades of Argentine football. The product promises each fan their history since the date they started following their club, so we must know what we can back up, and where the app has to say "coverage is partial". The master prompt (section 3.1) fixes the strategy: a versioned curated dataset in `data/` as source of truth, plus API-Football for recent seasons and updates.

## Evaluated sources

| Source                                          | Coverage                                                                                                                | License / terms                                                                                                                                                       | Status                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| openfootball `south-america` (Argentina)        | Primera División, seasons 2018-19, 2019-20, 2020 to 2025 (folder `argentina/`, Football.TXT). Local league only.        | CC0-1.0 public domain dedication (repo license and README). Verified with the GitHub API.                                                                             | **Usable**                                    |
| API-Football, free plan                         | Local league, cups and international competitions exist in the API. Free plan depth by season: **pending measurement**. | Free plan reported at 100 requests/day and 10/minute (third-party sources; the vendor pricing page was not reachable). Terms of use must be re-read with the account. | **Usable for recent data**, limits to confirm |
| Wikipedia                                       | Champions lists and honours (titles). Not match-level.                                                                  | Text under CC BY-SA 4.0: credit title, authors, source and license, state changes, share alike. Plain facts may be reused freely. Images are licensed individually.   | **Usable for titles**, with attribution       |
| RSSSF                                           | Final tables since 1891 and per-season pages.                                                                           | Each page says it may be copied with acknowledgement and also carries "All rights reserved". Ambiguous.                                                               | **Not usable until permission**               |
| Kaggle `ivanramosctes/liga-argentina-1931-2023` | League results 1931 to 2023 (from its title; columns and provenance not verified).                                      | License not shown on the page; provenance unknown.                                                                                                                    | **Not usable until license is verified**      |
| TheSportsDB                                     | Not assessed: documentation unreachable during the spike (HTTP 522).                                                    | Free tier and terms unknown.                                                                                                                                          | Pending                                       |
| FootyStats CSV downloads                        | Per-season CSVs from about 2014 (from search results).                                                                  | No license stated.                                                                                                                                                    | Not usable                                    |

## Decision

1. **Full match-level coverage starts at the 2018-19 season** for the local league, from openfootball (CC0), cross-checked and extended with API-Football for the current season. This is the first date in the `coverage` table for every club; clubs promoted after 2018 get a later date.
2. **Titles (honours) go back further**, sourced from Wikipedia lists with the CC BY-SA attribution on `/acerca` and a per-record `source` URL, using only officially recognized titles by default (methodology rule).
3. **Before 2018 the app shows partial coverage** with the notice defined in docs/methodology.md. We never present incomplete data as complete.
4. **Permission requests** for RSSSF and for the Kaggle dataset author are drafted in `docs/spike/permission-requests.md`. Diego sends them. No data from these sources enters `data/` before a written answer is stored in `docs/spike/replies/`.
5. API-Football key lives only in server code and in the GitHub secret for the scheduled workflow.

## Pending

- Run `pnpm spike:api-football` (about 22 requests) and record here: real daily quota, seasons readable on the free plan, whether cups and international competitions open, and requests per ingestion.
- Assess TheSportsDB when its documentation is reachable.
- Per-club full-coverage date: to be filled when the dataset is built (issue about the coverage table).

## Consequences

- The MVP can launch honestly with 2018 onwards and a visible coverage notice; historical depth grows only with permission.
- Adapters in `scripts/ingest/` are one per source, and each record carries its `source`.
- If a permission is granted, the earlier history is added through a normal PR with data validation, without changing the app.
