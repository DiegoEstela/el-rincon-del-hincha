# 0003 — Data sources

Status: **Proposed.** Measured on 2026-10-16. One product decision about current-season data (2026) is open (see "Open decision"). The Kaggle dataset is usable under the PDDL; its provenance question is still open and does not block use.

## Context

No free API covers decades of Argentine football. The product promises each fan their history since the date they started following their club, so we must know what we can back up, and where the app has to say "coverage is partial". The master prompt (section 3.1) fixes the strategy: a versioned curated dataset in `data/` as source of truth, plus API-Football for recent seasons and updates.

## Measurements

### API-Football, free plan (measured with Diego's key, `docs/spike/api-football-probe.json`)

- **Quota:** 100 requests per day (`limit_day: 100`), 10 per minute. The probe made 16 calls, of which 7 returned data. The quota headers were inconsistent (remaining values 98, 98, 97, 96, 98, 97, 96 in call order, and none on plan-rejected calls), so the exact quota cost was not established. It cost at least 7 (the calls that returned data) and at most 16 of the 100 daily requests; the exact figure was not established.
- **Seasons readable on the free plan: 2022, 2023 and 2024 only.** Every other season probed (2010, 2014, 2016, 2018 to 2021 and 2025) returned `Free plans do not have access to this season, try from 2022 to 2024.` **2026** was not probed; it is inferred to be denied from that message.
- The API lists the Liga Profesional (id 128) for 2015 to 2026 with events and statistics coverage, so the data exists but is behind a paid plan.
- **Cost of an ingestion:** one request returns a whole competition season (`/fixtures?league=128&season=2024` gave 378 matches in one call). A season of a competition costs 1 request.
- **A league id is not a single clean competition.** `league=128&season=2022` returned **581** fixtures, while openfootball's 2022 file has 378 matches (2023 and 2024 match exactly at 378). The extra 203 fixtures are consistent with the Copa de la Liga Profesional 2022, which the Kaggle dataset lists with exactly 203 matches (see the Kaggle analysis below); that the fixtures are the same matches was not checked one by one. The adapter must therefore filter by round or stage, and "1 request per competition season" holds for the request count but not for a 1:1 match with openfootball.
- **2025 and 2026 are inferred, not probed on 2026:** the 2025 call returned the plan error; 2026 was not called and the "2022 to 2024 only" limit is taken from that error message.
- **Cups and international competitions open on the free plan for 2024:** Copa Argentina (id 130, 63 matches), Copa Libertadores (id 13, 155), Copa Sudamericana (id 11, 157).
- Consequence: the free plan can **cross-check 2022 to 2024** and supply cups for those years, but it **cannot supply the current season** nor fill the gap after May 2025.

### openfootball `south-america` (CC0-1.0, verified with the GitHub API)

- Argentine Primera División files: 2018-19, 2019-20, 2020, 2021, 2022, 2023, 2024 and 2025.
- Header match counts equal the number of scored lines in every file from 2018-19 to 2024 (325, 276, 135, 325, 378, 378, 378). This proves the files are internally consistent, **not** that they contain every match of the calendar year: each file covers **one tournament per year** (checked against English Wikipedia season articles: 2022 is the league played 3 Jun to 25 Oct, 2023 runs 27 Jan to 30 Jul, 2024 runs 10 May to 16 Dec). The Copa de la Liga and other tournaments of the same year do not appear in the files. This is consistent with the 581 fixtures API-Football returns for 2022 (378 league plus 203 Copa de la Liga, see the Kaggle analysis below).
- Spot checks passed against Wikipedia: Boca's 2022 title-clinching day (Boca 2-2 Independiente, Racing 1-2 River on 23 Oct 2022) and River 3-1 Estudiantes on 15 Jul 2023 both match the files.
- **2025 is partial:** 240 matches, from 2025-01-23 to 2025-05-04 (first semester only).
- **No 2026 file**, and the last **data** update of `argentina/` is from 2025-05-05 ("auto-update week 19"). A later commit on 2026-05-28 ("up format") only reformatted files (equal additions and deletions), so automatic updates have stopped.
- The 2020 file has only 135 matches; that season had special formats, so full coverage of 2020 must be checked when building the dataset.
- Local league only: no cups.

## Evaluated sources

| Source                                          | Coverage                                                                                                                                                                                         | License / terms                                                                                                                                             | Status                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| openfootball `south-america`                    | One tournament per year: 2018-19 to 2024, plus 2025 until 4 May. No cups, no other tournaments of the year.                                                                                      | CC0-1.0                                                                                                                                                     | **Usable**                                                      |
| API-Football, free plan                         | League and cups 2022 to 2024. Nothing for 2018 to 2021, 2025, 2026.                                                                                                                              | Free plan: 100 requests/day. Vendor terms of use to be re-read from the account (pricing page returned 403 to our fetch).                                   | **Usable for 2022 to 2024 and cross-check**                     |
| API-Football, paid plan                         | All seasons listed (2015 to 2026), current season.                                                                                                                                               | Reported at about USD 19/month for 7,500 requests/day (third-party, unconfirmed).                                                                           | Option, needs Diego's decision                                  |
| Wikipedia                                       | Champions list page reports champions from 1891 onward (the page itself; individual seasons still to be verified per record). Not match-level.                                                   | CC BY-SA 4.0: credit title, authors, source and license, state changes, share alike. Plain facts may be reused freely. Images are licensed individually.    | **Usable for titles**, with attribution                         |
| RSSSF                                           | Final tables since 1891 and per-season pages.                                                                                                                                                    | Each page says it may be copied with acknowledgement and also carries "All rights reserved". Ambiguous.                                                     | **Not usable until permission**                                 |
| Kaggle `ivanramosctes/liga-argentina-1931-2023` | Local league 1931 to 2023 (34,356 matches, 96 teams, 138 tournaments), including the Copa de la Liga 2020 to 2023. Tournament and year only: **no match date**, no round, no penalties, no cups. | ODC Public Domain Dedication and Licence (PDDL), as shown on the dataset page (read by Diego on 2026-10-16). Original provenance of the data is not stated. | **Usable** (public domain dedication), provenance question open |
| TheSportsDB                                     | **Not assessed.** Its documentation returned HTTP 522 on two attempts; follow-up issue #29 retries it.                                                                                           | Unknown.                                                                                                                                                    | Pending                                                         |
| FootyStats CSV downloads                        | Per-season CSVs from about 2014 (from search results).                                                                                                                                           | No license stated.                                                                                                                                          | Not usable                                                      |

## Decision

1. **Match-level data for the main league tournament of each year from 2018-19 to 2024** comes from openfootball (CC0), cross-checked against API-Football for 2022 to 2024. This is **not** every official match of those years: other tournaments of the same year (for example the Copa de la Liga) are absent from openfootball. Coverage is therefore recorded **per competition** in the `coverage` table, and head-to-head records must say which competitions they include. The exact per-club coverage, now extendable back to 1931 with season precision (Decision 2), is **deferred to issue #12** (coverage table), because it needs the club list and the dataset (#8). Day-precision coverage from openfootball starts, for each club, at the later of 2018-19 and the club's first season in the dataset.
2. **History before 2018 and the Copa de la Liga 2020 to 2023** come from the Kaggle dataset (PDDL) at season precision (tournament and year, no match date), as defined in ADR 0011.
3. **2025 is recorded as partial coverage** (until 2025-05-04) and **2026 as not covered**, until a source is approved (see "Open decision"). The UI shows the coverage notice defined in docs/methodology.md; the app never presents an incomplete period as complete.
4. **Titles (honours) go back further**, sourced from Wikipedia lists with CC BY-SA attribution on `/acerca` and a per-record `source` URL, counting only officially recognized titles by default.
5. **Cups and international competitions** come from API-Football (2022 to 2024 on the free plan); other years need a source or a paid plan.
6. **Permission requests.** RSSSF still needs a written answer before any use (draft in `docs/spike/permission-requests.md`). For the Kaggle dataset the license question is answered (PDDL); the message to its author is reduced to one question: where the data comes from. No data from RSSSF enters `data/` before a written answer is stored in `docs/spike/replies/`.
7. The API-Football key lives only in server code and in the GitHub secret for the scheduled workflow. The free plan's 100 requests/day is enough for the planned ingestion of the seasons the free plan can read (one request per competition season).

## Kaggle dataset analysis (2026-10-16)

The file `liga_2023.csv` was downloaded by Diego and analyzed locally; it is not stored in the repository.

- 34,356 rows, 7 columns (`date_name`, `local_team_id`, `local_team`, `local_result`, `visitor_result`, `visitor_team`, `visitor_team_id`), no malformed row, 96 distinct team ids, 138 tournaments from Campeonato 1931 to Copa de la Liga 2023.
- **It explains the 581 fixtures of API-Football for 2022:** Liga Profesional 2022 has 378 matches and Copa de la Liga Profesional 2022 has 203; 378 + 203 = 581. The counts are consistent with the earlier hypothesis; only the sum was checked, not that API-Football and the Kaggle file list the same 203 matches.
- Cross-check against openfootball: 2019-20 (276), 2021 (325), 2022 (378) and 2023 (378) match exactly. 2018-19 has 324 matches against 325 in openfootball, and the 2020 Copa de la Liga has 134 against 135. The data-integrity audit identified them in a local analysis of the CSV on 2026-10-16 (the CSV is not stored in the repository): in 2018-19 the match Huracan 0-0 Argentinos Juniors (matchday 8) is absent from the Kaggle file; the 2020 difference is the Copa Sudamericana final of 31 Mar 2021 (Velez 2-3 Banfield), which the openfootball 2020 file includes and the Kaggle file counts apart, so that comparison is not like for like. The same comparison found two matches of the 2020 Copa with home and away swapped between sources, among them the final Boca v Banfield (1-1, decided on penalties): home and away statistics and the penalties record must be taken from a single source per match.
- Gaps: no match date, no round or stage, no penalties or suspended flags, no cups (Libertadores, Sudamericana, Copa Argentina), the dataset page says it was updated until September 2023 and the file ends with the Copa de la Liga 2023, irregular tournament names (`Liga Profesional  2015` with two spaces, `2016/2017`, `Campeonato 1985/86`) that need normalization.
- Nothing from this dataset is loaded yet. Tournament start and end dates have to come from a sourced reference (for example Wikipedia season articles, CC BY-SA, with attribution).

### Product decision on pre-2018 matches (Diego, 2026-10-16)

Matches before 2018 only carry a tournament and a year. A tournament that was already in progress on the fan's start date is **excluded** from their record, and the app tells them (for example: your start date falls in the middle of tournament X, so it is not counted). Only tournaments that started on or after the fan's start date count. This never inflates a fan's history. See ADR 0011 for the data model change.

## Open decision (Diego)

The free plan cannot give the **current season (2026)** nor the second half of 2025, and openfootball stopped updating in May 2025. Options:

- **A. Stay free:** coverage ends at 2025-05-04 and the app says so. Simple, no cost, but the product cannot show anything about the matches played since.
- **B. API-Football Pro (paid, reported about USD 19/month):** covers all seasons from 2015 and the current one, and enables the daily update workflow. Recommended if the app is meant to react to each matchday.
- **C. Look for another free source for the current season** (TheSportsDB to be assessed). No guarantee of quality or license.

## Consequences

- The MVP can launch honestly with the main league tournament of 2018-19 to 2024 and a visible coverage notice that lists which competitions are included. Filling the missing tournaments of those years needs API-Football data for 2022 to 2024 (free) or a paid plan or another source for 2018 to 2021. Depth before 2018 comes from the Kaggle dataset (tournament and year only, per ADR 0011) and from permitted sources such as RSSSF, and recency depends on the decision above.
- Adapters in `scripts/ingest/` are one per source, and each record carries its `source`.
- The Kaggle dataset needs no permission (PDDL); attribution is given as a courtesy. Only RSSSF needs a written answer. If that permission is granted or a plan is upgraded, the extra history is added through a normal PR with data validation, without changing the app.
