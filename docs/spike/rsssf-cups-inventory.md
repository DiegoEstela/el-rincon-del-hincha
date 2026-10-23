# RSSSF page inventory for the cups (plan 0017, task T2 / T44, issue #70)

Research done on 2026-10-23, after the second written reply (`docs/spike/replies/2026-10-23-rsssf-all-data.md`). Nothing from this inventory is committed as data: only the list of pages and how they look.

## How the pages were read

- Fetched from a temporary directory outside the repository, one request at a time, 6 seconds apart, with a neutral user agent (a generic name and the repository URL, no personal data). About 35 requests in total. `robots.txt` does not exist (404), as noted in plan 0017.
- All pages are `windows-1252`. They were read only to count sections and see layouts; no club names were resolved and nothing was parsed.
- The temporary directory is deleted after this document is written.

## 1. Domestic cups: inside the season pages already in the manifest

The Copa Argentina, the league cups, the Trofeo de Campeones and the Supercopas are sections of the same `arg20YY.html` pages that hold the first division (`https://www.rsssf.org/tablesa/argYYYY.html`), so they add no new page to the manifest, only new excerpts. Author of all of them: Osvaldo José Gorgazzi.

| Page    | Size (KB) | Last updated | Cup anchors (name on the page)                                                                                                                                          |
| ------- | --------: | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| arg2018 |       860 | 21 Feb 2024  | `copa` Copa Argentina 2017/18, `supercopa` Supercopa Argentina 2017/18                                                                                                  |
| arg2019 |       622 | 18 Mar 2021  | `copa` Copa Argentina 2018/19, `copaliga` Copa de la Superliga 2019, `supercopa`, `trofeocampeones`                                                                     |
| arg2020 |       551 | 1 Mar 2023   | `copaliga` Copa de la Superliga 2019/20, `copadam` Copa de la Liga 2020 "Diego Armando Maradona", `leaguesuper` Trofeo de Campeones 2020, `copa` "Copa Total Argentina" |
| arg2021 |       351 | 21 Apr 2022  | `copaliga` Copa LPF 2021, `trofeo` Trofeo de Campeones 2021 (no Copa Argentina section)                                                                                 |
| arg2022 |       586 | 20 Apr 2023  | `copaliga` Copa LPF 2022, `copa` Copa Argentina 2022, `supercup`, `trofeo`, `lpfsuper` Supercopa Internacional                                                          |
| arg2023 |       613 | 7 Mar 2025   | `leaguecup`, `leaguesuper`, `lpfsuper`, `nationalcup` Copa Argentina, `supercup`                                                                                        |
| arg2024 |       749 | 30 Apr 2026  | `leaguecup` Copa de la Liga 2024, `leaguesuper`, `lpfsuper`, `nationalcup`, `supercup`                                                                                  |
| arg2025 |       474 | 7 Oct 2026   | `1champtroph` Trofeo de Campeones 2025, `lpfsuper`, `nationalcup` Copa Argentina 2025 (no league cup, no Supercopa Argentina yet)                                       |

Observations that matter for the parser:

- **Anchors change name from year to year** (`copa`, `nationalcup`, `copaliga`, `leaguecup`, `trofeo`, `trofeocampeones`, `leaguesuper`): the manifest needs one explicit excerpt per page and cup, never a name rule.
- **Two layouts** for the match lines: the 2018 to 2022 pages use the older style already seen for the first division, and the 2023 to 2025 pages use the `full-names-2017` style: `[Jan 22, Wed]` date headers, `home  score  away  venue` rows, `[3] 0- 0 [1]` plus `pso` for penalty shoot-outs. The 2018 to 2022 cup sections still have to be read line by line (task T17).
- **Copa Argentina has a 64-team draw**, so every year brings dozens of lower-division clubs that are not in `data/clubs.json` (CD Argentino, CA Colegiales, CA Nueva Chicago, Real Pilar, Villa Mitre...). Clubs in the cup also appear with short names (`CA Racing`, `Club de Gimnasia y Esgrima LP`) different from the full names of the tables, so each club needs more aliases.
- **2020 and 2021** have no regular Copa Argentina (the 2020 page has a section called "Copa Total Argentina"; its content must be checked before anything is decided).
- Each cup section starts with a table of the cup only and then the rounds; the final tables of the cups are not a title source, the final match is.

## 2. Continental cups: one page per tournament, in `sacups/`

Pages: `https://www.rsssf.org/sacups/copaYYYY.html` (Copa Libertadores) and `https://www.rsssf.org/sacups/sudamcupYYYY.html` (Copa Sudamericana). The overview pages are `copalib.html` and `sudamcup.html`, and `intclub.html` is the index of international club competitions.

| Tournament        | Page         | Size (KB) | Last updated | Author(s) on the page                     |
| ----------------- | ------------ | --------: | ------------ | ----------------------------------------- |
| Libertadores 2018 | copa2018     |        18 | 10 Jan 2020  | Erik Francisco Lugo and Karel Stokkermans |
| Libertadores 2019 | copa2019     |        11 | 25 Mar 2020  | Karel Stokkermans                         |
| Libertadores 2020 | copa2020     |        11 | 12 May 2021  | Karel Stokkermans                         |
| Libertadores 2021 | copa2021     |        11 | 5 Dec 2022   | Karel Stokkermans                         |
| Libertadores 2022 | copa2022     |        11 | 9 Feb 2025   | Karel Stokkermans                         |
| Libertadores 2023 | copa2023     |        11 | 10 Feb 2025  | Osvaldo José Gorgazzi                     |
| Libertadores 2024 | copa2024     |        11 | 10 Feb 2025  | Osvaldo José Gorgazzi                     |
| Sudamericana 2018 | sudamcup2018 |        11 | 7 Mar 2019   | Karel Stokkermans and Erik Francisco Lugo |
| Sudamericana 2019 | sudamcup2019 |         6 | 25 Mar 2020  | Karel Stokkermans                         |
| Sudamericana 2020 | sudamcup2020 |         6 | 12 May 2021  | Karel Stokkermans                         |
| Sudamericana 2021 | sudamcup2021 |        11 | 5 Dec 2022   | Karel Stokkermans                         |
| Sudamericana 2022 | sudamcup2022 |        10 | 6 Jan 2025   | Karel Stokkermans                         |
| Sudamericana 2023 | sudamcup2023 |        12 | 29 Jan 2025  | Osvaldo José Gorgazzi                     |
| Sudamericana 2024 | sudamcup2024 |        13 | 29 Jan 2025  | Osvaldo José Gorgazzi                     |

Older years exist on the same pattern (`copa60` to `copa99`, `copa00` to `copa09`, `copa2010` to `copa2017`, `sudamcup02` to `sudamcup2017`); the 1995 and 2005 pages were sampled and are written by other authors (Juan Pablo Andrés, Pablo Ciullini) in the same style. **2025 does not exist yet** (`copa2025.html` and `sudamcup2025.html` return 404), so the 2025 and 2026 finals have no RSSSF source.

Layout of a continental page (all sampled years, one new layout `continental-ties`):

- A single `<pre>` block: no anchors by stage, headings are plain lines (`Qualifying Round 1`, `Group Phase`, `Final`).
- **Knockout ties** are one line per tie with both legs and the aggregate: `Talleres (Córdoba)  Arg  São Paulo  Bra   2-0  0-0  2-0`, with a date header before it covering both legs (`(Feb 6 & 13)`), penalty shoot-outs as `4-1p`, away goals as `*`, and awarded results as `x` with a footnote. The first club named hosts the first leg.
- **Group matches** are one line each: `Mar  6: Palestino - Internacional  0-1`, followed by a points table.
- **Dates have no year** (the page is the year), the club names are short and carry a city in brackets (`Racing Club (Avellaneda)`) with a country code (`Arg`, `Bra`...) in the ties.
- Qualifying rounds, "best losers" that drop to the Sudamericana and the final (`Final (Nov 9, Asunción)`) are all in the same block; stadiums are not given for the ties.

Effects:

- **Foreign clubs.** Every tournament has about 40 to 60 clubs from the ten CONMEBOL countries. They are not in `data/clubs.json`, and the app only knows 34 Argentine clubs. This needs a decision (see "Questions" below) before any parsing.
- **Two-leg ties are not single matches.** The leg dates come as "Feb 6 & 13" and the scores as `2-0 0-0`, so each leg becomes one match with the date taken from the pair, and a line whose dates do not match its legs must stop the run.
- **Only the matches with an Argentine club matter for the app.** The adapter can keep every match (simplest and complete) or only the ones where an Argentine club plays; this is a decision for Diego.

## 3. What the pages do not give

- Copa Argentina 2020 and 2021 matches (see above), to be confirmed on `arg2020.html`.
- The Libertadores and Sudamericana of 2025 and 2026, and any final of 2026.
- Match venues for the continental ties, and the home and away side for the neutral finals.
- A single list of club names: the same club appears with different names in the tables and in the rounds.

## Questions for Diego (nothing is fetched or parsed until they are answered)

1. **Window.** From which year do the cups load? Recommendation: 2018 (the first year of the openfootball data and of the pages above), then earlier years as separate PRs.
2. **Foreign and lower-division clubs.** Recommendation: new ADR; the clubs outside the 34 of the app are loaded as "rivals" with a generic crest from their colors only when an app club plays them, and the rest of the continental ties are left out. The list of new clubs is produced by a dry run and given to Diego for approval, as agreed.
3. **Which matches.** Recommendation: only the matches where one of the 34 clubs of the app plays (it keeps the data small and the review manageable).
4. **Titles.** Libertadores, Sudamericana, Copa Argentina, Copa de la Liga, Trofeo de Campeones and Supercopas: which of them count as titles in the vitrina? Recommendation: the three official cups of the issue plus the league cups the AFA recognizes, and the rest under "Títulos discutidos" or left out, as in ADR 0021.
5. **Pages for 2018 to 2022 cup sections** need layout work (T17) and are the bulk of the cost; do 2023 to 2025 first? Recommendation: yes, because the layout already exists, and the Copa Argentina 2025 title is the one fans see first.
