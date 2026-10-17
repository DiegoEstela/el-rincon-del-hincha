# Review report: plan 0013 (load the openfootball data, issue #8)

## Verdicts

| Auditor                | Verdict  |
| ---------------------- | -------- |
| code-reviewer          | APPROVED |
| security-auditor       | APPROVED |
| data-integrity-auditor | APPROVED |

`ui-designer-auditor` was not needed: no UI, styles or routes changed.

## What the data auditor verified (with web access through curl)

- `pnpm data:validate` ok, and `pnpm data:ingest openfootball --dry-run` reports `+0 -0 =2435`: the committed files are exactly what the adapter produces.
- Six matches different from the builder's five, each checked on es.wikipedia (date and score): 2019-01-27 Newell's 1-1 Boca, 2019-11-10 Newell's 2-0 Defensa y Justicia, 2020-12-04 Banfield 1-1 Rosario Central, 2024-11-10 Racing 2-1 Independiente Rivadavia, 2025-03-07 Vélez 1-0 San Martín (SJ), and the 2021-01-17 Boca 1-1 Banfield final (5-3 on penalties).
- Teams and match totals per season agree with Wikipedia where checked (26, 24, 24, 28, 30 teams; 276 and 135 matches), and the season start and end dates of 2018-19, 2019-20, 2020 and 2024.
- The partial 2025 season ends on 2025-06-01 (final, Platense champion) while the data stops on 2025-05-04.
- No anomaly: ids unique, no match outside its season, no club twice on a day, no negative score, one match with penalties and one title final.

## Notes carried forward

- Wikipedia and openfootball may share upstream sources, so these checks are not a fully independent second source. Every record stays `verified: false`.
- The partial status of 2025 and the "2020 is the Copa Diego Maradona only" fact are not in the data files themselves. Issue #12 (coverage table) must add them before any screen shows a head-to-head record or a 2025 total as complete.
- The auditor did not check the 2021, 2022 and 2023 team counts or dates, and a full home/away swap check needs a second full source (the API-Football cross-check for 2022 to 2024).
- Commit type: the code reviewer suggested `chore(data)` instead of `feat(data)` (the app does not import the data yet, so no user-facing change and no minor release). Applied.
