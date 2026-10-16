# 0003 — Data sources

Status: **Proposed.** Measured on 2026-10-16. One product decision about current-season data is open (see "Open decision").

## Context

No free API covers decades of Argentine football. The product promises each fan their history since the date they started following their club, so we must know what we can back up, and where the app has to say "coverage is partial". The master prompt (section 3.1) fixes the strategy: a versioned curated dataset in `data/` as source of truth, plus API-Football for recent seasons and updates.

## Measurements

### API-Football, free plan (measured with Diego's key, `docs/spike/api-football-probe.json`)

- **Quota:** 100 requests per day (`limit_day: 100`), 10 per minute. A full run of the probe (22 calls) used about 4 percent of the day.
- **Seasons readable on the free plan: 2022, 2023 and 2024 only.** Any other season returns `Free plans do not have access to this season, try from 2022 to 2024.` That includes 2018 to 2021 and **2025 and 2026**.
- The API lists the Liga Profesional (id 128) for 2015 to 2026 with events and statistics coverage, so the data exists but is behind a paid plan.
- **Cost of an ingestion:** one request returns a whole competition season (`/fixtures?league=128&season=2024` gave 378 matches in one call). A season of a competition costs 1 request.
- **Cups and international competitions open on the free plan for 2024:** Copa Argentina (id 130, 63 matches), Copa Libertadores (id 13, 155), Copa Sudamericana (id 11, 157).
- Consequence: the free plan can **cross-check 2022 to 2024** and supply cups for those years, but it **cannot supply the current season** nor fill the gap after May 2025.

### openfootball `south-america` (CC0-1.0, verified with the GitHub API)

- Argentine Primera División files: 2018-19, 2019-20, 2020, 2021, 2022, 2023, 2024 and 2025.
- Header match counts equal the number of scored lines in every file from 2018-19 to 2024 (325, 276, 135, 325, 378, 378, 378).
- **2025 is partial:** 240 matches, from 2025-01-23 to 2025-05-04 (first semester only).
- **No 2026 file**, and the last commit touching `argentina/` is from 2025-05-05 (automatic weekly updates stopped; a later commit only reformatted).
- The 2020 file has only 135 matches; that season had special formats, so full coverage of 2020 must be checked when building the dataset.
- Local league only: no cups.

## Evaluated sources

| Source                                          | Coverage                                                             | License / terms                                                                                                                                          | Status                                      |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| openfootball `south-america`                    | League 2018-19 to 2024 complete, 2025 until 4 May. No cups.          | CC0-1.0                                                                                                                                                  | **Usable**                                  |
| API-Football, free plan                         | League and cups 2022 to 2024. Nothing for 2018 to 2021, 2025, 2026.  | Free plan: 100 requests/day. Vendor terms of use to be re-read from the account (pricing page returned 403 to our fetch).                                | **Usable for 2022 to 2024 and cross-check** |
| API-Football, paid plan                         | All seasons listed (2015 to 2026), current season.                   | Reported at about USD 19/month for 7,500 requests/day (third-party, unconfirmed).                                                                        | Option, needs Diego's decision              |
| Wikipedia                                       | Champions lists and honours (titles). Not match-level.               | CC BY-SA 4.0: credit title, authors, source and license, state changes, share alike. Plain facts may be reused freely. Images are licensed individually. | **Usable for titles**, with attribution     |
| RSSSF                                           | Final tables since 1891 and per-season pages.                        | Each page says it may be copied with acknowledgement and also carries "All rights reserved". Ambiguous.                                                  | **Not usable until permission**             |
| Kaggle `ivanramosctes/liga-argentina-1931-2023` | League results 1931 to 2023 (from its title; columns not verified).  | License not shown; provenance unknown.                                                                                                                   | **Not usable until license is verified**    |
| TheSportsDB                                     | Not assessed: documentation unreachable during the spike (HTTP 522). | Unknown.                                                                                                                                                 | Pending                                     |
| FootyStats CSV downloads                        | Per-season CSVs from about 2014 (from search results).               | No license stated.                                                                                                                                       | Not usable                                  |

## Decision

1. **Full match-level coverage for the local league is 2018-19 to 2024**, from openfootball (CC0), cross-checked against API-Football for 2022 to 2024. Per-club start dates in the `coverage` table are the later of 2018-19 and the club's first season in that range.
2. **2025 is recorded as partial coverage** (until 2025-05-04) and **2026 as not covered**, until a source is approved (see "Open decision"). The UI shows the coverage notice defined in docs/methodology.md; the app never presents an incomplete period as complete.
3. **Titles (honours) go back further**, sourced from Wikipedia lists with CC BY-SA attribution on `/acerca` and a per-record `source` URL, counting only officially recognized titles by default.
4. **Cups and international competitions** come from API-Football (2022 to 2024 on the free plan); other years need a source or a paid plan.
5. **Permission requests** for RSSSF and for the Kaggle dataset author are drafted in `docs/spike/permission-requests.md`. Diego sends them. No data from these sources enters `data/` before a written answer is stored in `docs/spike/replies/`.
6. The API-Football key lives only in server code and in the GitHub secret for the scheduled workflow. The free plan's 100 requests/day is enough for the planned ingestion (one request per competition season).

## Open decision (Diego)

The free plan cannot give the **current season (2026)** nor the second half of 2025, and openfootball stopped updating in May 2025. Options:

- **A. Stay free:** coverage ends at 2025-05-04 and the app says so. Simple, no cost, but the product cannot show anything about the matches played since.
- **B. API-Football Pro (paid, reported about USD 19/month):** covers all seasons from 2015 and the current one, and enables the daily update workflow. Recommended if the app is meant to react to each matchday.
- **C. Look for another free source for the current season** (TheSportsDB to be assessed). No guarantee of quality or license.

## Consequences

- The MVP can launch honestly with 2018-19 to 2024 complete and a visible coverage notice. Historical depth beyond that grows only with permission, and recency depends on the decision above.
- Adapters in `scripts/ingest/` are one per source, and each record carries its `source`.
- If a permission is granted or a plan is upgraded, the extra history is added through a normal PR with data validation, without changing the app.
