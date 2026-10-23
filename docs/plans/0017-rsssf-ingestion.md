---
issue: 70
status: pending
date: 2026-10-19
---

# Plan 0017: RSSSF ingestion (Argentine first division history, then the cups)

Related issues: #70 (this plan), #7 (ingestion adapters), #12 (coverage table, plan 0014 Phase 2), #38 (ADR 0011 season precision), #50 (About page credits), #67 (vitrina). Related ADRs: [0003](../adr/0003-data-sources.md) (sources; decision 6 is the RSSSF permission), [0011](../adr/0011-match-date-precision.md) (date precision), [0012](../adr/0012-club-identity-aliases-colors.md) (aliases), [0015](../adr/0015-ingestion-adapter-contract.md) (adapter contract), [0016](../adr/0016-club-dataset-scope-and-single-color-clubs.md) (club scope), [0017](../adr/0017-derived-coverage-table.md) (derived coverage), [0018](../adr/0018-stats-screens-compute-in-the-browser.md) (per-club documents), **[0020](../adr/0020-rsssf-pinned-excerpts-and-layouts.md)** (new, Proposed: pinned excerpts, layout profiles, season ownership). Model: plan 0011 (openfootball adapter) and plan 0013 (its data load).

## Goal

Load the history of the Argentine first division from RSSSF through an adapter that follows ADR 0015, so that a fan's history, rivalries and league titles no longer start in 2018. Then, **only after a new written reply from RSSSF**, load the Copa Argentina, the Copa Libertadores and the Copa Sudamericana under the same rules.

The work has two phases:

- **Phase A, the league (permitted, ships alone).** Matches, final tables (standings) and, if Diego approves D5, league titles of the first division. It ships in three PRs: A1 code and fixtures (no `data/` change), A2 club records and aliases, A3 the data, the coverage table and the credit.
- **Phase B, the cups (BLOCKED).** Nothing from the cups is fetched, parsed, committed or shown until Diego has sent the request (task T1 drafts it) and the written reply is stored in `docs/spike/replies/`. Phase B is re-planned then.

## Acceptance criteria (copied from issue #70)

Phase A (league, permitted)

- Given the RSSSF pages of the Argentine first division, when `pnpm data:ingest rsssf` runs, then it writes seasons, matches and final tables through an adapter in `scripts/ingest` following ADR 0015.
- Given the adapter input, when it runs, then the input is pinned with its sha256 and a changed hash stops the run.
- Given records already loaded from other sources, when the adapter runs, then it only writes records it owns (ownership by source prefix) and never edits the others.
- Given a record that conflicts with an existing one, when the adapter runs, then the run stops and reports the conflict; it never overwrites silently.
- Given a club name on an RSSSF page, when it is resolved, then the club resolver matches only exact aliases; an unknown name stops the run instead of being guessed.
- Given any ingested record, when it is read, then `source` holds the RSSSF page URL it came from.
- Given the loaded data, when `pnpm data:validate` runs, then it passes.
- Given the new seasons, when `pnpm data:coverage` runs, then the coverage table is regenerated in the same commit, with real gaps declared and sourced, never invented, and `pnpm data:coverage --check` passes.
- Given the About page (#50), when it is viewed, then it credits RSSSF and names the page author, as the reply requires.
- Given the adapter code, when it is written, then tests come first and cover the parser, the resolver and the conflict path.
- Given the PR, when it is reviewed, then the data auditor approves it.

Phase B (cups, blocked on permission)

- Given a stored written RSSSF reply that covers the cups, when the adapter is extended, then Copa Argentina, Copa Libertadores and Copa Sudamericana load under the same rules as Phase A.
- Given the cups are loaded, when the coverage table is regenerated, then the "cups not loaded" notice from plan 0014 Phase 2 is removed or narrowed to the cups still missing, and the vitrina (#67) can read cup titles.
- Given no such reply yet, when Phase A ships, then no cup data is present in the repo.

Out of scope (from the issue): any competition or country outside the first division and the three cups; asking RSSSF ourselves (Diego sends the request); `verified: true` on matches; UI changes beyond the About credit and the coverage notice text. Also out of scope here: wiring `titles.json` into the per-club documents and the vitrina screen (#67), the Kaggle adapter (#38), the plan 0014 Phase 2 competition records (#12).

## Answers to the open questions of the issue

- **Which seasons does Phase A load?** Diego decides (D1). Recommendation: from the 1985-86 Campeonato to the 2017-18 Superliga, plus the seasons after openfootball's last match (D2). Earlier eras follow as their own issues, one era per PR.
- **Do the final tables also feed titles in Phase A?** Diego decides (D5). Recommendation: yes for first-division seasons, from the champion marked on each season page and checked against RSSSF's list of champions; the vitrina (#67) only reads them.
- **Does the reply allow storing the parsed data in the repo, or only displaying it?** Storing. Point 1 of the request was "store the match results and final tables of the Argentine first division in the public repository of the project, with a per-record source field", and the reply says "yes, 1, 2 and 3 are all okay". Display of derived statistics is point 2, credit is point 3. Each page also says "You are free to copy this document in whole or part provided that proper acknowledgement is given to the author". What the reply does **not** cover: other competitions, other countries and commercial use.

## What exists today

- **Ingestion core** (`scripts/ingest/core/`): the `Adapter<Raw>` contract (`id`, `sourcePrefix`, `load(loader)`, pure `normalize`), `runAdapter` (merge, derive coverage, validate, atomic write), `mergeDataset` (owns matches by prefix; competitions and seasons upserted by id, a difference is a conflict), `createClubResolver` (exact aliases, unknown names collected, same-season spelling check), `fetchPinned` (https only, **host fixed to `raw.githubusercontent.com`**, 1 MB cap, redirects refused, sha256), `directoryLoader` (**strict UTF-8 decode**), the CLI `pnpm data:ingest <adapter> [--dry-run] [--out] [--from]`.
- **openfootball adapter**: owns `https://github.com/openfootball/south-america/`; seasons `primera-division-2018-19` to `primera-division-2024`, `copa-de-la-liga-profesional-2020`, `primera-division-2025-apertura` (group stage only, last match 2025-05-04, end 2025-06-01 from a Wikipedia oldid). Competition `primera-division` is defined in its config with a Wikipedia oldid source.
- **Data**: 34 clubs, 2 competitions, 8 seasons, 2,435 matches, 232 coverage rows. No `titles.json`, no `standings.json`. Declared gaps: Copa de la Liga 2021 to 2024 and `primera-division` from 2025-05-05 to open.
- **Validator** already has `standings-mismatch`, `control-totals`, `title-without-support` and `unshared-co-champions`; they have never run on real records.
- **App**: `/acerca` has no source credits yet (#50 open); the per-club documents load `titles: []` (#67 will change that); the club picker has a search box.

## Research log: the real RSSSF pages (2026-10-19)

Fetched from a temporary directory outside the repository, one request at a time with 3 to 5 seconds between requests, 10 requests in total. `https://www.rsssf.org/robots.txt` returns 404 (no crawl rules). Nothing was saved in the repository.

| Page                    | Bytes   | Declared charset | Content (first division in **bold**)                                                                                                                                                                                                                                  | Author shown                                    | Last updated |
| ----------------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------ |
| `arghist.html`          | 6,520   | windows-1252     | Index of the decade pages of final tables (`arghist-pro1970s.html` and so on) and the association names.                                                                                                                                                              | Osvaldo José Gorgazzi                           | 13 Jan 2022  |
| `arghist-pro1970s.html` | 72,673  | iso-8859-1       | **Final tables only**, 1971 to 1980, with the city after the points (`Huracán ... (Comodoro Rivadavia)`); notes such as ". Boca Juniors - Huracán (Ingeniero White) was not played, awarded 1-0."                                                                     | not read                                        | not read     |
| `argchamp.html`         | 38,767  | "UTFs-8" (wrong) | List of champions and runners-up 1891 to the **2026 Apertura** (Belgrano), with the 2025 "Anual LPF" note (Rosario Central proclaimed by the AFA on 20 Nov 2025). Links to every season page.                                                                         | Osvaldo José Gorgazzi and Héctor Villa Martínez | 25 May 2026  |
| `arg50.html`            | 24,482  | iso-8859-1       | **1950**: full table with headquarters, playoffs for second place and relegation, rounds as `Round 1 [Apr 2]:` with scores `3:3`, notes `[at Boca Juniors]`.                                                                                                          | Osvaldo José Gorgazzi                           | 2 Sep 2015   |
| `arg71.html`            | 139,848 | none             | **Metropolitano and Nacional 1971**: tab-separated match lines, `[Mar 5, Fri]` dates, scorers on the next line, `bye`, `[Suspended at 88']`, home and away tables.                                                                                                    | Pablo Ciullini                                  | 1 Oct 2025   |
| `arg2010.html`          | 28,263  | none             | **Apertura 2009 and Clausura 2010** only: `[Aug 21]` dates, `abd` with `[remaining 83']` on a later date, notes that wrap onto the next match line, `Racing` and `Racing Club` in one tournament; relegation table and promotion playoffs against second-level clubs. | Juan Pablo Andrés                               | 14 Sep 2010  |
| `arg2019.html`          | 622,197 | windows-1252     | **Superliga 2018-19** (full legal names, headquarters column, stadium on every match line), plus the Copa Argentina, Copa de la Superliga, Supercopa, Trofeo de Campeones, second to fifth levels, national teams and friendlies.                                     | Osvaldo José Gorgazzi                           | 18 Mar 2021  |
| `arg2025.html`          | 473,930 | windows-1252     | **Apertura 2025** (groups and knockouts to the final on 1 Jun 2025), **Clausura 2025** (final Racing 1-1 Estudiantes, Estudiantes on penalties), the annual table, plus Trofeo de Campeones, Supercopa Internacional, Copa Argentina and the lower levels.            | Osvaldo José Gorgazzi                           | 7 Oct 2026   |

None of the bytes is valid UTF-8. Findings that shape the design:

1. **Matches and tables both exist** for the seasons sampled (1950, 1971, 2009-10, 2018-19, 2025). The decade pages have tables only. Whether every season of the chosen window has matches is checked by the inventory (T2).
2. **At least four layouts** (the 1950, 1971, 2009-10 and 2017-onward styles above). Each needs its own strict parser (ADR 0020, decision 3).
3. **The fields available.** Matches: date (month and day, sometimes the weekday; the year is implied), home, away, score, extra time (`aet`), shoot-outs (`[4] 0- 0 [2] ... pso`), abandoned, resumed and awarded matches, neutral venue, round or knockout stage, sometimes scorers, stadium and line-ups (ignored). Tables: position, name, P, W, D, L, GF, GA, points, headquarters (some layouts), champion and relegation marks, points deductions in notes. Tables are sometimes labelled "Non official table" (computed by the author) and are not always sorted by points (the 2025 Clausura champion is listed above a club with more points).
4. **A page mixes competitions.** The first division is one or more anchored sections (`#primera`, `#1apertura`, `#1clausura`); the rest of the page is out of scope and, for the cups, forbidden until Phase B. That is why the repository can store excerpts, never whole pages (D4).
5. **Overlap and the 2025 gap.** RSSSF has 2018-19 to the 2025 Apertura (openfootball's seasons) and also what openfootball lacks: the 2025 Apertura knockout stage, the 2025 Clausura and the 2026 Apertura.
6. **Credit.** The author changes from page to page (four different authors in seven pages). Author e-mail addresses are in the "About this document" block, which no excerpt includes.

## Approach (Phase A)

### Input: pinned excerpts (ADR 0020, decisions 1 and 2)

- `sources/rsssf/manifest.json` (reviewed, schema-checked) lists every page used: `url`, `retrieved_on`, `sha256` and `bytes` of the whole page, `encoding` (`windows-1252` for every page seen; ISO-8859-1 pages decode the same way under WHATWG), `authors`, `last_updated` (the text on the page), `layout`, and `excerpts[]` with `name`, `start` and `end` markers (exact byte strings such as `<a name="1apertura">`), `sha256`, and the page's reviewed `ignore`, `variants` and `tableExceptions` lists.
- `sources/rsssf/<page>.<anchor>.txt`: the excerpt bytes, cut from the page bytes, never edited. `.gitattributes` marks them `-text`; `.prettierignore` skips them; a README holds the credit lines and the refresh steps.
- `pnpm data:snapshot rsssf [--check]` (`scripts/rsssf-snapshot.ts`) is the only code that requests rsssf.org: one page at a time, at least 5 seconds apart, neutral user agent without personal data (a test asserts it has no `@`), https only, no redirects, 2 MB cap. It writes the excerpts and updates the manifest; `--check` only lists changed pages. Never run in CI (the existing `no-network` test is extended).
- `pnpm data:ingest rsssf` reads `sources/rsssf/` by default (the adapter declares a default input directory); `--network` fetches the live page, checks the pinned page sha256, cuts the excerpt and checks its sha256. A changed page or excerpt stops the run (AC 2).

### Parsing (pure, `scripts/ingest/rsssf/`)

1. **Text pre-pass**: decode windows-1252 (reject C1 control characters, which mean a wrong encoding), strip tags, decode entities (`&eacute;`, `&nbsp;`, `&amp;`), keep a map from text line to excerpt line for error messages and the run report. Caps on excerpt size and line length.
2. **Layout parser** chosen by the manifest's `layout` (`round-colon-1950s`, `tabbed-scorers-1970s`, `plain-2000s`, `full-names-2017`, plus whatever the inventory finds). Each is an exhaustive, anchored, linear-time line grammar (no nested quantifiers): headings, round and stage headers, date headers, match lines, table rows, recognized notes, ignored lines. An unrecognized line stops the run with `<excerpt>:<line>: unrecognized line "<text>"` (AC "fail loudly").
3. **Notes that wrap** (`[abandoned at 0-0` on one match line, `in 7' due to rain]` on the next) are joined by bracket balance before the next line is read.
4. **Dates** (ADR 0020, decision 4): each tournament has `window: { firstYear, lastYear, splitMonth }` in the config. `[Mon DD]`, `[Mon DD, Wkd]` and `Round n [Mon DD]:` resolve to the single year of the window; the weekday, when present, must match. Out-of-order dates are legal (Estudiantes' matches were advanced in Nov 2009 for the Club World Cup).

### Normalization

- **Matches**: id `<date>-<home>-<away>` (ADR 0015, decision 7). `stage` from an exhaustive per-layout table (`Fecha n`, `Zona A`, `Octavos de final`, `Cuartos de final`, `Semifinal`, `Final`, `Desempate`). `is_final` only for the match that decides a title (D7). `decision`: `penalties` (with both counts) or `extra_time` or `null`; `status`: `played`, `suspended` (abandoned, never completed) or `administrative_result` (awarded). One record per fixture for abandoned-and-resumed matches, dated on the day it was completed (D6). `verified: false`. `source`: page URL plus the tournament anchor.
- **Seasons**: from the config (D7 ids and names), `start` and `end` = first and last match date of the excerpt (complete tournaments), `source` = page URL plus anchor.
- **Competition**: reuses `primera-division` deep-equal to the existing record (the config imports the openfootball record so they can never drift; a test checks it).
- **Table check** (ADR 0020, decision 6): for each tournament with `tableCoversSeason: true`, tallied P, W, D, L, GF, GA per club and the total number of matches must equal the table; a difference stops the run unless listed in `tableExceptions` with a reason.
- **Standings**: one row per club for those tournaments (`played`, `won`, `drawn`, `lost`, `source`).
- **Titles** (if D5 is yes): the champion marked on the season page (`Champions`, `[Champion]`, the `Champion` heading), which must equal the champion listed in the committed excerpt of `argchamp.html` for that season; id `<season_id>-<club_id>`, `awarded_on` per D5, `shared: false` unless the page says so, `verified: false`.

### Clubs (ADR 0012, ADR 0016, ADR 0020 decision 7)

- Match lines resolve the exact page spelling (`CA Boca Juniors`, `Boca Juniors`, `Estudiantes LP`, `Atl. Tucumán`). Table rows resolve `<name> (<headquarters>)` where the layout has a headquarters column (`Club Atlético San Martín (San Juan, J)`), else the bare table name (`Colón (Santa Fe)` already carries the city).
- The same-season spelling check runs per context (matches, table); real variants inside one context must be listed in the page's `variants`.
- Every alias goes into `data/clubs.json` through a normal data PR (A2), with the alias uniqueness rule after folding. New clubs follow ADR 0012 and ADR 0016 (colors from the palette, contrast, Wikipedia oldid, two sources for a trim). The exact list comes from a dry run on the real excerpts (T24). For the 1985-86 to 2017-18 window the order of magnitude is 25 to 30 new clubs (for example Ferro Carril Oeste, Deportivo Español, Quilmes, Chacarita Juniors, Nueva Chicago, Olimpo, Atlético de Rafaela, Temperley, All Boys, Gimnasia y Esgrima de Jujuy); the 1967 to 1985 Nacional would add dozens of provincial clubs with one or two seasons each (the 1971 Nacional alone has Kimberley, Juventud Antoniana, Don Orione, Guaraní Antonio Franco and two other Huracán).

### Overlap with openfootball (ADR 0020, decision 5; D3)

- RSSSF writes **no match** in `primera-division-2018-19` to `primera-division-2024`, `copa-de-la-liga-profesional-2020` or the group stage of `primera-division-2025-apertura`. One source per season; openfootball keeps them.
- The 2025 Apertura is the one `extends` entry: RSSSF adds only the matches dated after 2025-05-04 (round of 16 to the final, 15 matches), with the season record deep-equal to openfootball's (`end` 2025-06-01 already). The season then reads complete in the coverage table.
- The overlapping seasons are parsed for a **read-only cross-check report** (`--cross-check`): matches missing on either side, different scores, dates, home and away or shoot-outs. It writes nothing. The report is attached to the A3 PR for the data auditor; differences are reported to Diego (human checkpoint: a data conflict without a source), never fixed by the adapter.
- A conflict that stops the run (AC 4): a season record with the same id and different fields, a match in a season owned by another source outside the `extends` rule, a standings or title key already owned by another prefix, or a `duplicate-id`/`duplicate-match` from the validator. The run prints every conflict and leaves `data/` byte-for-byte unchanged.

### Coverage table consequences (ADR 0017)

- No generator change. New seasons are complete tournaments (last match = `end`), so each club's `primera-division` stretch now starts at the first loaded season it played (for a club present since 1985-86, the first match date of that season) and splits at every relegation, as D1 of plan 0014 decided.
- The `primera-division` gap from 2025-05-05 to open moves to the day after the last loaded match (D2: after the 2026 Apertura final, if approved) with a new sourced reason. A season in the window that RSSSF does not cover with matches becomes a declared gap with a source (T2 finds them; none is invented).
- The row count and the per-club stretch table of `tests/integration/coverage-data.test.ts` change; T35 updates them with independently recomputed values.
- Cups stay unloaded and, until plan 0014 Phase 2 registers them, unlisted. The "Todavía no cargamos Copa Argentina, Libertadores, Sudamericana ni otras copas." line and the "no complete badge" rule stay exactly as they are (issue: no UI change beyond the credit).
- Promotion playoffs against lower-level clubs (the Promoción, for example Rosario Central v All Boys in 2010) are not part of `primera-division` and are not loaded (D7). The methodology says so, so a complete row never claims them.

### Credit (AC "About page", ADR 0020 decision 9)

`/acerca` gets a "Fuentes" block whose RSSSF part is generated from the manifest: "Muchas gracias a {autores} y a la RSSSF (Rec.Sport.Soccer Statistics Foundation) por proveer esta información." with every author once, a link to `https://www.rsssf.org/` and the list of pages used (D8). It does not implement the rest of #50 (Wikipedia, openfootball, Kaggle credits), which stays open.

### Discarded alternatives

- **Commit whole pages.** Simplest and fully reproducible, but `arg2019.html` and `arg2025.html` contain Copa Argentina, Copa de la Superliga and super cup results, which breaks the Phase B criterion "no cup data is present in the repo", and lower-division and national-team results outside the permission. Rejected.
- **Commit nothing, keep only hashes.** RSSSF pages change in place and have no revisions, so after the next edit nobody could re-run the adapter or check a record against its text. Rejected (D4 alternative).
- **Use the Wayback Machine URL as `source`.** The issue requires the RSSSF page URL in `source`. An archive URL may be added to the manifest as extra provenance when one exists, but it is not the pin.
- **Parse the decade pages of final tables (`arghist-pro*.html`).** One page per decade and a single layout, but tables only: no matches, so no rivalries. Kept only as an optional cross-check source.
- **One generic "RSSSF text" parser with heuristics.** Four layouts with different separators, score formats and notes would need guessing, which the project forbids. Rejected in favor of strict per-layout grammars.
- **Let RSSSF take over the 2018-19 to 2025 seasons.** One source for the whole history is attractive, but it rewrites 2,435 reviewed matches and their ids and changes every golden test, for no new information. Rejected (D3 alternative). Taking over only the 2025 Apertura is described in D3.
- **Fuzzy or city-aware name matching.** Breaks ADR 0012. Rejected; the table key `<name> (<headquarters>)` keeps matching exact.

## Phase B: the cups (BLOCKED)

**Nothing from the cups is fetched, parsed, committed or shown before the written reply is stored in `docs/spike/replies/`.** In Phase A the excerpts are cut before any cup section, a manifest test fails if an excerpt contains an anchor that is not listed, and an integration test fails if any record with the RSSSF prefix belongs to a competition other than `primera-division`. The research of this plan read two season pages that contain cup sections, in a temporary directory outside the repository; no cup data was used or kept.

### Request draft (task T1 adds it to `docs/spike/permission-requests.md` as section 3; Diego sends it, in the same thread as the first request)

> Subject: Follow-up: Argentine cups and Argentine clubs in CONMEBOL competitions
>
> Hello,
>
> Thank you again for your reply of 16 October 2026 about the Argentine first division. Rincón del Hincha now uses those pages, with the credit you suggested and a link to every page used.
>
> Fans have asked for the cups too, so I would like to ask before using anything else. Under the same conditions as before (a free, non-commercial web app with no ads and no betting content, a source field with the URL of the page on every record, and credit to RSSSF and the author of each page), could you confirm in writing whether I may:
>
> 1. Store the match results and final tables of the **Copa Argentina** in the public repository of the project.
> 2. Store the results of the matches played by **Argentine clubs in the Copa Libertadores and the Copa Sudamericana**, and the tables of the groups they played in.
> 3. Store the results of the cups that the Argentine league organizes for first-division clubs and that appear on the Argentina season pages: the Copa de la Liga Profesional (2020 to 2024), the Copa de la Superliga (2019), the Supercopa Argentina, the Trofeo de Campeones and the Supercopa Internacional. If you consider these already covered by your first reply, please just say so.
> 4. Keep in the same repository byte-exact copies of only the sections of each page that we use (never whole pages), so that anyone can check every record against the text it came from. This applies to the first-division sections we already use as well.
> 5. Show statistics derived from all of the above in the app, as with the league.
>
> If the pages of the international cups are maintained by other authors, please tell me how they would like to be credited. As before, I am happy to remove any content on request.
>
> Thank you very much,
> Diego Estela Lopez

### When the reply arrives (re-plan, outline only)

- Store it in `docs/spike/replies/`, update ADR 0003 decision 6 and ADR 0020 with the exact scope, and re-plan Phase B in this file before any code.
- **Foreign clubs need an ADR first.** Libertadores and Sudamericana matches are against clubs from other countries, which ADR 0016 does not allow in `clubs.json` (crest colors, contrast, sources, onboarding). Options: foreign clubs as records that are not selectable, or a separate `opponents` list. This is a product and data-model decision for Diego.
- Competitions: `copa-argentina`, `copa-libertadores`, `copa-sudamericana` (plan 0014 Phase 2, T17, may already add them with declared gaps); their seasons, stages and finals (`is_final` per leg; two-legged finals use the existing final-series rules).
- New layouts for the cup sections and the CONMEBOL pages; the same excerpt, table-check and ownership rules.
- Coverage: the declared gaps of the three cups narrow to the editions still missing; the cups line of the notice is narrowed by the UI issue that owns that copy; the vitrina (#67) reads cup titles.

### Alternatives to evaluate for the cups (options only, nothing ingested)

| Option                                                                                        | What it would give                                                                                                                              | Open questions                                                                                                         |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| openfootball `south-america/copa-libertadores/` (CC0-1.0; file list only, checked 2026-10-19) | Files `2012_copal.txt` to `2026_copal.txt` (Libertadores) and `2012_copas.txt` to `2025_copas.txt` (Sudamericana), last auto-update 2026-07-11. | Content, completeness and grammar not read; no Copa Argentina; only from 2012; foreign clubs still need the ADR above. |
| API-Football free plan (ADR 0003 decision 5)                                                  | Copa Argentina, Libertadores and Sudamericana for 2022 to 2024.                                                                                 | Vendor terms to re-read; key server-only; responses not redistributable, so synthetic fixtures; three seasons only.    |
| Wikipedia lists of champions (CC BY-SA, ADR 0003 decision 4)                                  | Cup **titles** (not matches) for the vitrina, independent of match coverage (methodology: title lists do not depend on match coverage).         | Per-record oldid and attribution; recognition of each title; does not feed rivalries.                                  |
| Wikipedia edition articles                                                                    | Finals and knockout results.                                                                                                                    | Share-alike reading for a data compilation; uneven completeness; a second source per fact.                             |

Evaluating any of these is a separate issue (D10, changed by Diego: the vitrina is fed by RSSSF and by every permitted source we have, and it does not wait for any single one).

## Decisions for Diego (NEEDS DIEGO)

Tasks T1 to T23 (A1) do not depend on these answers except D6 and D7, which only change rule tables. One line each, with the recommendation.

- **D1. Start of Phase A.** Load from the 1985-86 Campeonato to the 2017-18 Superliga (about 58 tournaments and 25 to 30 new clubs), and add 1967 to 1985 (Metropolitano and Nacional, dozens of provincial clubs) and 1931 to 1967 later, one era per issue? **Recommended: yes, 1985-86 first.** Alternatives: from 1967 (covers fans born since 1967, much more club work), or everything RSSSF has (amateur era, dissident leagues, disputed titles).
- **D2. Fill the gap after openfootball.** Load from RSSSF the 2025 Apertura knockout stage, the 2025 Clausura and the 2026 Apertura (finished tournaments only; the 2026 Clausura when it ends), so coverage reaches mid-2026? **Recommended: yes.** It does not give live updates; each new tournament is a manual data PR (ADR 0003, open decision, stays open for the current season).
- **D3. Overlap with openfootball.** openfootball keeps 2018-19 to 2024 and the 2025 Apertura group stage; RSSSF only adds the 2025 Apertura knockouts (`extends`) and produces a read-only cross-check report of the overlap for the data auditor? **Recommended: yes.** Alternatives: RSSSF takes over the whole 2025 Apertura (removes 240 openfootball matches and changes their season record by hand), or takes over 2018-19 to 2025 entirely (rejected above).
- **D4. Source copies in the repo.** Commit byte-exact excerpts of only the first-division sections, plus the manifest with the whole-page sha256 and retrieval date? **Recommended: yes.** The page notice allows copying "in whole or part" with acknowledgement and the reply allows storing results and tables; item 4 of the Phase B request asks RSSSF to confirm it explicitly. Alternative: no copies (runs not reproducible once a page changes).
- **D5. Standings and titles in Phase A.** Write `standings.json` for tournaments whose table covers every match, and `titles.json` for every first-division season with a champion on an RSSSF page (including 2018-19 to 2025), checked against `argchamp.html`, with `awarded_on` = the date of the deciding final when there is one, otherwise the date of the tournament's last match? **Recommended: yes**; this amends ADR 0003 decision 4 (titles from Wikipedia) for the first division only, and keeps `verified: false`. The 2025 "Anual LPF" title proclaimed for Rosario Central is **not** loaded until Diego decides whether and how it counts.
- **D6. Abandoned and awarded matches.** An abandoned match completed later is one record with the final score dated on the day it ended; abandoned and never completed is `suspended`; awarded is `administrative_result` on its scheduled date; awarded with no date on the page stops the run? **Recommended: yes** (methodology rule).
- **D7. Taxonomy of the older tournaments.** Every title-awarding tournament is a `primera-division` season: `primera-division-1985-86`, `primera-division-1991-apertura`, `primera-division-1992-clausura`, `primera-division-2012-inicial`, `primera-division-2013-final`, `primera-division-2012-13-campeonato` (the one-match final of 2013), `primera-division-2014`; names in Spanish as on the pages ("Torneo Apertura 1991"); title playoffs between first-division clubs are loaded with stage "Desempate" (and `is_final` only when one match decides the title); the Promoción against lower-level clubs is not loaded and is not part of the competition; the 2014 Copa Campeonato is a cup and waits for Phase B? **Recommended: yes.** Exact ids are fixed by the inventory (T2) and recorded in ADR 0015 decision 8.
- **D8. Credit wording.** On `/acerca`, in Spanish: "Muchas gracias a {autores} y a la RSSSF (Rec.Sport.Soccer Statistics Foundation) por proveer esta información.", every author once, a link to the RSSSF main page and the list of pages used, generated from the manifest? **Recommended: yes** (the reply says "something like" the English line).
- **D9. Breadth of the Phase B request.** Ask in one message for the three cups, the league-organized cups (Copa de la Liga, Copa de la Superliga, super cups) and the excerpt copies, as in the draft? **Recommended: yes**; Phase B still loads only the three cups of the issue.
- **D10. Cup alternatives.** Open a separate issue to evaluate openfootball's CC0 Libertadores and Sudamericana files and Wikipedia cup titles for the vitrina, without waiting for RSSSF? **Recommended: yes.**

## Tasks

Test first in every task: write the failing test, then the code. One hour or less each. `pnpm test` before checking a task off; 100% branch coverage stays in `src/domain`, `src/data-model` and `src/lib`, and the new adapter keeps the coverage level of `scripts/ingest/openfootball`.

### Group 0: before any code

- [ ] **T1 Phase B request draft (docs only).** Add section "3. RSSSF, second request (cups)" to `docs/spike/permission-requests.md` with the draft above, and change the header paragraph to say that the first-division permission was granted and a second request about cups is drafted and not sent. Check with `pnpm lint` (Prettier). This task can ship on its own before A1. Diego sends the message.
- [ ] **T2 Page inventory (research, no code, outside the repo).** For the window of D1 and D2, list every season page from the links of `argchamp.html`; fetch each once with the snapshot rules (one at a time, at least 5 s apart, neutral user agent, a temporary directory outside the repository, deleted afterwards). Record in "Verification log: page inventory": page, tournaments and their anchors, layout (one of the four or new), encoding, authors, last updated, size, whether matches or only tables, cup anchors to exclude. Stop and ask Diego if a tournament in the window has no matches on RSSSF (it becomes a declared gap) or if the page to season mapping is unclear.

### Group A (PR A1): ingestion core

- [ ] **T3 Encodings in the loaders.** Tests first in `tests/unit/scripts/ingest/pinned-fetch.test.ts` and `adapter.test.ts`: `SourceFile.encoding` defaults to `utf-8` (openfootball tests unchanged); `windows-1252` decodes `0xE9` to "é" and `0x93`/`0x94` to curly quotes; a decoded C1 control character (bytes `0x81`, `0x8D`, `0x8F`, `0x90`, `0x9D`) fails with the file name; the sha256 is checked on the bytes before decoding. Then the code.
- [ ] **T4 Per-adapter hosts and size cap.** Tests first: `fetchPinned` accepts a host listed for the adapter and rejects others; `www.rsssf.org` allowed only for the RSSSF adapter; http rejected; a 3xx is an error; the cap is per adapter (2 MB for RSSSF, 1 MB default); openfootball behavior unchanged. Then the code.
- [ ] **T5 Ownership of standings and titles.** Tests first in `merge.test.ts`: an adapter's standings and titles replace those with its prefix; records of other prefixes are kept untouched; an incoming standings key (`club_id/season_id`) or title id owned by another prefix is a conflict; matches behavior unchanged. Then extend `mergeDataset` and `AdapterRecords`.
- [ ] **T6 One source per season and `extends`.** Tests first: an incoming match in a season that has matches of another prefix is a conflict naming the season and both prefixes; with an `extends` entry, matches dated strictly after the other source's last match pass and one on or before that date is a conflict; the extended season record must be deep-equal, else the existing conflict fires; openfootball runs unaffected. Then the guard in the merge.
- [ ] **T7 Scoped spelling check and variants.** Tests first in `club-resolver.test.ts`: `resolve(name, { ..., context })`; two spellings of one club in one season and one context fail; the same pair in different contexts passes; a pair listed in `variants` passes; an unlisted third spelling still fails; existing tests (no context) behave as today. Then the resolver.
- [ ] **T8 Contract and CLI.** Tests first: `AdapterOutput` may carry `standings` and `titles`; `runAdapter` writes `standings.json` and `titles.json` only when present and validates them with the rest; an adapter `defaultInputDir` is used when `--from` is absent; `--network` forces the network loader; `--cross-check` calls the adapter's report hook and writes nothing (`tests/integration/ingest-cli.test.ts`). Then the code and the usage text.

### Group B (PR A1): manifest and snapshot

- [ ] **T9 Manifest schema and checks.** Tests first in `tests/unit/scripts/ingest/rsssf/manifest.test.ts`: Zod schema (URL matches `^https://www\.rsssf\.org/tablesa/[a-z0-9-]+\.html$`, ISO date, 64-hex sha256, known layout, non-empty authors, excerpts with markers and sha256); every excerpt file exists and matches its hash; no excerpt contains `mailto:` or "About this document"; no excerpt contains an `<a name=` anchor that is not one of its own markers; manifest sorted by URL. Then `scripts/ingest/rsssf/manifest.ts`.
- [ ] **T10 Slicer.** Tests first: bytes plus markers give the bytes from the start marker to just before the end marker; a missing or repeated start marker fails; an end marker before the start fails; output is a byte-exact subarray (no decoding). Then the pure slicer.
- [ ] **T11 Snapshot script.** Tests first with an injected fetch and clock and a temporary directory: requests are sequential with the configured delay; the user agent has no `@`; changed pages are rewritten with new hashes and `retrieved_on`; `--check` writes nothing and exits 1 when a page changed; a fetch error leaves every file unchanged; authors and "Last updated" are read from the page and a missing author fails. Extend `no-network.test.ts` so tests never reach rsssf.org. Then `scripts/rsssf-snapshot.ts` and `pnpm data:snapshot`.

### Group C (PR A1): parsing

Fixtures in `tests/fixtures/ingest/rsssf/`: reduced byte-exact excerpts of first-division sections (a few rounds plus the table, windows-1252, `-text`) and synthetic files for each edge case. No cup or lower-division text.

- [ ] **T12 Text pre-pass.** Tests first: tags stripped, entities decoded, `<pre>` content preserved with its spacing, tabs preserved, the line map points at excerpt lines, oversized input or line fails. Then `scripts/ingest/rsssf/text.ts`.
- [ ] **T13 Date resolver.** Tests first: `[Aug 10, Fri]` in a 2018-19 window gives 2018-08-10 and a wrong weekday fails; `[Jan 29]` with split month July gives the second year; `Round 1 [Apr 2]:` in 1950; `[Feb 29]` only in a leap year; a month outside the window fails; a window over 12 months is rejected by the config check. Then `dates.ts`.
- [ ] **T14 Layout `full-names-2017`, part 1.** Tests first on a reduced 2018-19 excerpt: table rows with full names, headquarters, `MP W D L Gf- Ga P`; round and date headers; plain match lines with the stadium column; notes on points deductions recognized; any other line fails with excerpt and line. Then the parser.
- [ ] **T15 Layout `full-names-2017`, part 2.** Tests first on a reduced 2025 excerpt: knockout headings (`Round of 16 – Octavos de Final:` and the others); `[4] 0- 0 [2] ... pso`; `aet` and `aet, pso`; `-` with `abandoned at 0-0 in 45m HT` then `remaining 45m` (one fixture); `remaining time on 24 Oct`; awarded; the "Champion" and "Runner-up" headings in an unsorted table. Then the parser.
- [ ] **T16 Layout `plain-2000s`.** Tests first on a reduced 2009-10 excerpt: `[Aug 21]` headers; `[at Lanús]`; `abd` with a note that wraps onto the next match line; the resumed match on a later date (`[remaining 83']`); `Racing` and `Racing Club` reported as a variant; table with `(Rosario)` suffixes; the relegation table and promotion playoffs outside the excerpt. Then the parser.
- [ ] **T17 Other layouts found by T2.** One task per layout (T17a, T17b, ...), each with its reduced fixture and the same test shape (tables, dates, matches, notes, failures). Expected at least one for the late 1980s and 1990s pages. Added to this plan after T2.

### Group D (PR A1): normalization, checks, wiring

- [ ] **T18 Matches and stages.** Tests first in `normalize.test.ts`: ids, home and away as listed at neutral venues, the stage table per layout (exhaustive; an unknown stage fails), `is_final` only for the title-deciding match (D7), shoot-out and extra-time fields, `suspended` and `administrative_result` (D6), one record for an abandoned-and-resumed fixture, `source` = page URL plus anchor, `verified: false`. Then the code.
- [ ] **T19 Table check.** Tests first: equal tallies pass; a missing match, an extra match or a wrong score fails with the club and the six numbers on both sides; a listed `tableExceptions` entry passes and an unused one fails (stale exceptions are errors); tournaments without `tableCoversSeason` are skipped and reported. Then `table-check.ts`.
- [ ] **T20 Standings and titles (D5).** Tests first: standings rows only for `tableCoversSeason` tournaments; title per season from the page's champion mark, equal to the `argchamp` excerpt (a mismatch fails); `awarded_on` rule; no title for a season without a champion mark; the Anual LPF table is never a title. Then the code.
- [ ] **T21 Config.** Tests first in `config.test.ts`: the competition equals the openfootball `primera-division` record; every season has an id (D7 pattern), a Spanish name, a window, an anchor present in the manifest, and no id owned by openfootball except the 2025 Apertura `extends` entry (dated after 2025-05-04); seasons sorted. Then `scripts/ingest/rsssf/config.ts` (fixture-sized at this stage; the real list lands in A3).
- [ ] **T22 Cross-check report.** Tests first: for an overlap season the report lists matches only in one source, different scores, different dates for the same pair and round, home and away swapped and shoot-out differences; identical data gives an empty report; nothing is written. Then the report.
- [ ] **T23 Adapter and integration on fixtures.** Tests first in `tests/integration/ingest-rsssf.test.ts` (temporary data directory seeded with the real openfootball data and fixture clubs): a run writes seasons, matches, standings, titles and `coverage.json` that pass `validate()`; a second run gives identical bytes; a changed excerpt byte stops the run with the hash message and leaves the directory unchanged; an unknown club lists every unknown name with excerpt and line; a pre-seeded season with different fields stops with the conflict; openfootball matches are never touched; no output record belongs to a competition other than `primera-division`. Then `scripts/ingest/rsssf/index.ts` and the registry entry.

### Group E (PR A2): clubs and aliases

- [ ] **T24 Unknown-name inventory.** Run `pnpm data:ingest rsssf --dry-run` on the real excerpts (from T32's snapshot, kept local until A3) and record in the verification log every unresolved spelling, split into aliases of the 34 existing clubs and new clubs, with the seasons each appears in. Stop and ask Diego if the new-club count is far from the D1 estimate.
- [ ] **T25 Aliases of existing clubs.** Tests first in the clubs and alias tests: each new spelling resolves to the expected id; alias uniqueness after folding still holds. Then the aliases in `data/clubs.json` and `pnpm data:validate`.
- [ ] **T26 to T31 New clubs, five per task.** For each batch: tests first (slug, palette colors, contrast rules, unique short name, aliases), then the records with a Wikipedia oldid each and the verification log entries (ADR 0012, ADR 0016). If T24 finds more than 30 new clubs, stop and propose a separate issue for them, as plan 0012 did.

### Group F (PR A3): the data, coverage and credit

- [ ] **T32 Snapshot and commit the excerpts.** Run `pnpm data:snapshot rsssf` for the approved pages; commit `sources/rsssf/` with the manifest, the README (credits and refresh steps), `.gitattributes` (`-text`) and `.prettierignore`. The T9 checks pass on the real files.
- [ ] **T33 Real config.** Tests first (the T21 checks on the real list, and the season list of the inventory): every tournament of the window has a season entry or a declared gap. Then the real `config.ts`.
- [ ] **T34 Coverage gaps (D2).** Tests first in the gap list tests: the `primera-division` tail gap starts the day after the last loaded match with a sourced reason; any tournament without match data in the window has a gap with a source and a reason; T5 checks of plan 0014 stay green. Then `src/data-model/coverage-gaps.ts`.
- [ ] **T35 Real ingestion.** Test first `tests/integration/rsssf-data.test.ts`: every RSSSF record's `source` matches the manifest URL plus an anchor; each season's match count equals its table total; standings only for flagged tournaments; titles equal the `argchamp` excerpt for the window; no RSSSF record outside `primera-division`; no RSSSF match in an openfootball season except the 2025 knockouts. It fails. Then `pnpm data:ingest rsssf`, `pnpm data:validate`, `pnpm data:coverage --check`, `pnpm lint`.
- [ ] **T36 Real-data tests that change.** Update with values recomputed independently (the data auditor recomputes them; every changed number is explained in the PR): `coverage-data.test.ts` (row count, per-club stretches), the plan 0014 T14 engine statuses, `rivalry-golden.test.ts` (River v Boca from 1990-05-20 grows from 8 matches), the rivals golden values and the club-data equivalence test (record its runtime; keep it under 10 s).
- [ ] **T37 Spot checks against a second source.** Twelve matches across the window (at least one per layout, one shoot-out, one abandoned-and-resumed, one awarded) and every champion of the window, against Wikipedia oldids or press. Record them in the verification log; any disagreement stops the work and goes to Diego.
- [ ] **T38 Cross-check report.** Run `pnpm data:ingest rsssf --cross-check`; attach the report to the A3 PR; summarize it in the verification log; send any difference to Diego (nothing is changed in the data).
- [ ] **T39 Size and performance.** Measure the gzip size of `/api/clubs/<id>` for River, Boca and the smallest club before and after, the `pnpm build` route budgets and the equivalence test runtime; record them. If a document exceeds 50 KB gzip or a route budget breaks, stop and propose an ADR 0018 follow-up instead of shipping.
- [ ] **T40 RSSSF credit on `/acerca` (D8).** Tests first: a component test that the credit lists every manifest author once, in Spanish, with links to `https://www.rsssf.org/` and to each page used (links validated against the manifest URL pattern); an e2e check on `/acerca` (three projects) that the credit and the footer show. Then the component, built from the manifest at build time.
- [ ] **T41 Docs.** `docs/methodology.md`: an "RSSSF (Argentine first division)" section (excerpts and refresh, layouts, date resolution, one source per season and `extends`, abandoned, resumed and awarded matches, standings, titles and `awarded_on`, Promoción excluded, home and away at neutral venues, the table check), the known gaps table, the attribution. ADR 0020 to Accepted with Diego's answers; pointers in ADR 0003 (decisions 2, 3, 4 and the attribution section), ADR 0012 (decision 3) and ADR 0015 (decisions 2, 3, 8). This plan: "Decisions recorded", verification logs, status.
- [ ] **T42 Gates.** `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm data:validate`, `pnpm data:coverage --check`, `pnpm build`, `pnpm e2e`.

### Phase B (BLOCKED until the written reply is stored)

- [ ] **T43 (Diego) Send the request** of T1 and store the reply in `docs/spike/replies/`. Not a builder task.
- [ ] **T44 Re-plan Phase B** in this file with the real scope of the reply, the foreign-clubs ADR, the competitions and gaps, the layouts and the tasks; get Diego's answers before any code.
- [ ] **T45 onward** are written by T44.

## Tests to write (summary)

- **Unit, ingest core:** encodings, per-adapter hosts and caps, ownership of standings and titles, one source per season and `extends`, scoped spelling check and variants, contract and CLI flags.
- **Unit, RSSSF adapter:** manifest schema and checks, slicer, snapshot script (injected fetch and clock), text pre-pass, date resolver, one test file per layout, stage tables, normalization, table check, standings and titles, config, cross-check report.
- **Integration:** `ingest-rsssf.test.ts` on fixtures (write, determinism, hash change, unknown club, conflict, openfootball untouched, scope guard); `ingest-cli.test.ts` flags; `rsssf-data.test.ts` on the real data; updated `coverage-data`, engine-on-coverage, rivalry and rivals golden and equivalence tests.
- **E2E:** `/acerca` credit and footer on the three projects; existing specs green.
- **Edge cases:** wrong declared charset; C1 bytes; a page edited after the pin (network path stops); an excerpt marker missing or repeated; a cup anchor inside an excerpt; `[Feb 29]`; a date that belongs to the other year of the window; a wrong weekday; out-of-order (advanced or postponed) dates; a note that wraps onto the next match line; abandoned at 0-0 then resumed on another day; abandoned then resumed on the same day (one record, no `duplicate-id`); abandoned and never completed; awarded without a date (stops); shoot-outs in league matches (1988-89 awarded an extra point for them; still a draw for us); `aet` without shoot-out; a two-match title playoff; a triangular playoff (stage "Desempate", `is_final` false, the title from the page); the 2013 one-match "Campeonato" final; a table not sorted by points; a "Non official table"; points deductions; a table that disagrees with the matches (stops unless listed); a stale `tableExceptions` entry; `Racing` and `Racing Club` in one tournament; three clubs named Huracán in one tournament; two Club Atlético San Martín in one table; a club whose name changed (id stays, ADR 0012); a club relegated and promoted inside the window (two stretches); a season that RSSSF has without matches (declared gap); a 2025 knockout match dated on or before 2025-05-04 (conflict); an RSSSF season id equal to an openfootball one (conflict); the author block with e-mail addresses never in an excerpt.

## Impact

- **Data:** new `sources/rsssf/` (excerpts plus manifest; several MB at most, text only); `data/matches.json` grows by roughly 10,000 to 12,000 matches for D1 (about 5 times today); new `data/standings.json` and `data/titles.json`; `data/seasons.json` gains about 60 seasons; `data/clubs.json` gains the A2 clubs and aliases; `data/coverage.json` regenerated (more rows, the 2025 tail gap moved). openfootball records are unchanged. Supabase seeding gets more rows and its first standings and titles; the seed script must accept them (checked in T42).
- **Design:** only the RSSSF credit on `/acerca`. The club picker grows with the A2 clubs (it already has search; ADR 0016 warned about this). The coverage notice copy does not change.
- **Security:** one new outbound host (`www.rsssf.org`), only from the snapshot script run by a person: https, no redirects, size cap, timeout, a neutral user agent with no personal data, never in CI. Excerpts are untrusted text: parsed with anchored linear-time patterns and size and line caps, never rendered as HTML, never executed. Record `source` URLs are validated against the manifest pattern before they can be shown as links. No secrets, no `.env`. Author e-mail addresses are not copied into the repository.
- **Performance:** per-club documents (ADR 0018) grow with the history (River from about 240 to about 1,300 matches); T39 measures them and the route budgets, with a stop rule at 50 KB gzip per document. Ingestion and coverage generation stay linear and run in seconds. The validator's `duplicate-match` and table rules run on 5 times the matches; CI time is recorded.

## Risks and mitigation

- **Layout drift inside an era** (one author changes style between pages). Mitigation: the inventory (T2) assigns a layout per page; strict grammars fail loudly; a new layout is a reviewed task (T17).
- **RSSSF pages change after the pin.** Mitigation: committed excerpts make runs reproducible; `--check` and the network path show the change; a refresh is a normal data PR.
- **Real disagreements** between RSSSF tables and matches, between RSSSF and openfootball, or with Wikipedia champions. Mitigation: the table check and the cross-check report surface them; nothing is resolved automatically; Diego decides with a third source (human checkpoint).
- **Club work dominates** (ADR 0012 and 0016 records for 25 to 30 clubs). Mitigation: D1 limits the window; A2 is its own PR; more than 30 clubs becomes its own issue.
- **Permission scope creep** (scorers, line-ups and notes inside the excerpts; cup sections next door). Mitigation: only results, tables and titles become records; excerpts exclude every other competition; the Phase B request asks RSSSF to confirm the excerpts.
- **Golden tests change a lot.** Mitigation: T36 recomputes every value independently and the PR explains each change; the data auditor signs off.
- **Bundle and runtime growth** of the per-club documents. Mitigation: T39 stop rule and an ADR 0018 follow-up if needed.
- **Titles source change** (ADR 0003 decision 4). Mitigation: D5 and ADR 0020 decision 8; the champion is double-checked inside RSSSF and spot-checked against Wikipedia (T37).
- **A season with no match data in the window.** Mitigation: declared gap with a source, never invented matches (T2, T34).
- **Accidental cup ingestion.** Mitigation: manifest anchor test, scope guard in the integration tests, no cup layout exists in Phase A.

## How to verify it is finished

- Phase A acceptance criteria map to tests: ingestion through the adapter (T23, T35); pinned input and hash stop (T3, T9, T11, T23); ownership by prefix (T5, T6, T23); conflicts stop the run (T5, T6, T23); exact aliases and unknown names stop (T7, T23, T24); `source` is the RSSSF page URL (T18, T35); `pnpm data:validate` passes (T35, T42); coverage regenerated with sourced gaps and `--check` green (T34, T35, T42); the credit with the page authors (T40); tests first for parser, resolver and conflict path (Groups A to D); data auditor approval (T36 to T38 evidence in the PR).
- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm data:validate`, `pnpm data:coverage --check`, `pnpm build` and `pnpm e2e` green; `pnpm data:ingest rsssf` twice gives no diff.
- `git grep -i -E "copa argentina|libertadores|sudamericana" -- sources/rsssf data` finds nothing in Phase A except the notes that the table check allowlists (for example "qualified for the 2020 Copa Sudamericana"), and no record of a cup exists.
- D1 to D10 recorded below; ADR 0020 accepted; the request draft is in `docs/spike/permission-requests.md`.
- Phase B is done only after T43 to T45 and its own acceptance criteria.

## Decisions recorded

Diego answered on 2026-10-19: D1 to D9 approved as recommended. On 2026-10-23 he approved the 59 club aliases of the 2025 pages (his rule: club names that are missing are asked to him, never searched on the web).

**D10, changed by Diego.** The vitrina (#67) is fed by RSSSF **and by everything else we have**, not by a separate cups evaluation that it waits for. Consequences for this plan: the vitrina reads `titles.json` as soon as Phase A writes the first-division titles (D5); cup titles join it from whichever permitted source lands first (RSSSF after a written reply, or the openfootball CC0 files and Wikipedia titles evaluated in their own issue); every shelf shows what is loaded and its coverage, never an invented total. The evaluation issue of the alternative sources stays, but as an input to the vitrina, not as a condition for it.

## Verification log: unknown-name inventory (T24, 2026-10-23, page `arg2025`)

A dry run of `pnpm data:ingest rsssf --dry-run` on the real excerpts `arg2025.1apertura` and `arg2025.1clausura` (258 and 255 match lines, all read; the final tables read) stops only on club names. All 59 spellings are spellings of the 30 clubs of the 2025 season that are already in `data/clubs.json`; **no club is new**. Nothing was searched on the web: the table lists what the page says and the club it appears to be. **Waiting for Diego to approve this list** (his rule: names that are missing are asked, never researched) before it is added to the `aliases` of `data/clubs.json` in the A2 data PR.

**Spellings in match lines** (29)

| Spelling on RSSSF                 | Club                      |
| --------------------------------- | ------------------------- |
| CA Aldosivi                       | `aldosivi`                |
| AA Argentinos Juniors             | `argentinos-juniors`      |
| Club Atlético Tucumán             | `atletico-tucuman`        |
| CA Banfield                       | `banfield`                |
| CA Barracas Central               | `barracas-central`        |
| CA Belgrano                       | `belgrano`                |
| CA Boca Juniors                   | `boca-juniors`            |
| CA Central Córdoba (Sant. Estero) | `central-cordoba-sde`     |
| CSD Defensa y Justicia            | `defensa-y-justicia`      |
| Deportivo Riestra AFBC            | `deportivo-riestra`       |
| Club Estudiantes de La Plata      | `estudiantes-la-plata`    |
| Club de Gimnasia y Esgrima LP     | `gimnasia-la-plata`       |
| CD Godoy Cruz Antonio Tomba       | `godoy-cruz`              |
| CA Huracán                        | `huracan`                 |
| CA Independiente                  | `independiente`           |
| CS Independiente Rivadavia        | `independiente-rivadavia` |
| Instituto ACC                     | `instituto`               |
| CA Lanús                          | `lanus`                   |
| CA Newell's Old Boys              | `newells-old-boys`        |
| CA Platense                       | `platense`                |
| CA River Plate                    | `river-plate`             |
| CA Rosario Central                | `rosario-central`         |
| CA San Lorenzo de Almagro         | `san-lorenzo`             |
| CA San Martín (San Juan)          | `san-martin-san-juan`     |
| CA Sarmiento (Junín)              | `sarmiento-junin`         |
| CA Talleres                       | `talleres-cordoba`        |
| CA Tigre                          | `tigre`                   |
| CA Unión                          | `union`                   |
| CA Vélez Sarsfield                | `velez-sarsfield`         |

**Spellings in the final tables (legal name and headquarters)** (30)

| Spelling on RSSSF                                                       | Club                      |
| ----------------------------------------------------------------------- | ------------------------- |
| Club Atlético Aldosivi (Mar del Plata, B)                               | `aldosivi`                |
| Asociación Atlética Argentinos Juniors (La Paternal, C)                 | `argentinos-juniors`      |
| Club Atlético Tucumán Soc. Civil (San Miguel de Tucumán, T)             | `atletico-tucuman`        |
| Club Atlético Banfield Sociedad Civil (Banfield, B)                     | `banfield`                |
| Club Atlético Barracas Central (Barracas, C)                            | `barracas-central`        |
| Club Atlético Belgrano (Córdoba, X)                                     | `belgrano`                |
| Club Atlético Boca Juniors Asociación Civil (La Boca, C)                | `boca-juniors`            |
| Club Atlético Central Córdoba Soc. Civil (Santiago del Estero, G)       | `central-cordoba-sde`     |
| Club Social y Deportivo Defensa y Justicia (Florencio Varela, B)        | `defensa-y-justicia`      |
| Deportivo Riestra Asociación de Fomento Barrio Colón (Nueva Pompeya, C) | `deportivo-riestra`       |
| Club Estudiantes de La Plata (La Plata, B)                              | `estudiantes-la-plata`    |
| Club de Gimnasia y Esgrima La Plata (La Plata, B)                       | `gimnasia-la-plata`       |
| Club Deportivo Godoy Cruz Antonio Tomba (Godoy Cruz, M)                 | `godoy-cruz`              |
| Club Atlético Huracán (Parque de los Patricios, C)                      | `huracan`                 |
| Club Atlético Independiente (Avellaneda, B)                             | `independiente`           |
| Club Sportivo Independiente Rivadavia (Mendoza, M)                      | `independiente-rivadavia` |
| Instituto Atlético Central Córdoba (Córdoba, X)                         | `instituto`               |
| Club Atlético Lanús (Lanús Este, B)                                     | `lanus`                   |
| Club Atlético Newell's Old Boys (Rosario, S)                            | `newells-old-boys`        |
| Club Atlético Platense Asociación Civil (Florida, B)                    | `platense`                |
| Racing Club Asociación Civil (Avellaneda, B)                            | `racing-club`             |
| Club Atlético River Plate Asoc. Civil (Belgrano, C)                     | `river-plate`             |
| Club Atlético Rosario Central (Rosario, S)                              | `rosario-central`         |
| Club Atlético San Lorenzo de Almagro (Flores, C)                        | `san-lorenzo`             |
| Club Atlético San Martín (San Juan, J)                                  | `san-martin-san-juan`     |
| Club Atlético Sarmiento (Junín, B)                                      | `sarmiento-junin`         |
| Club Atlético Talleres (Córdoba, X)                                     | `talleres-cordoba`        |
| Club Atlético Tigre Sociedad Civil (Victoria, B)                        | `tigre`                   |
| Club Atlético Unión (Santa Fe, S)                                       | `union`                   |
| Club Atlético Vélez Sarsfield Asociación Civil (Liniers, C)             | `velez-sarsfield`         |

## Verification log: page inventory (T2)

(Filled by T2.)

## Verification log: data (T24, T37, T38, T39)

(Filled by the build.)
