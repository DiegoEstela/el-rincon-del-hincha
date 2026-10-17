# openfootball fixtures

Byte-exact copies of `argentina/*_ar1.txt` from
[openfootball/south-america](https://github.com/openfootball/south-america) at commit
`18fcfc41566d30928f6a683b9cdf3973e22c7974` (the last commit touching `argentina/`, checked on
2026-10-17). License: **CC0-1.0** (public domain dedication).

- Do not reformat or normalize these files. Their sha256 hashes are pinned in
  `scripts/ingest/openfootball/config.ts` and checked by a test. They mix CRLF and LF line endings
  on purpose (that is how upstream has them); `.gitattributes` marks them `-text` so Git never
  rewrites them.
- Prettier ignores `*.txt` fixtures (`.prettierignore`).
- `clubs.ts` builds the club list the tests use: the real `data/clubs.json` plus synthetic records
  for the five names that are not in it yet.

## Refresh

1. Find the new commit: `gh api "repos/openfootball/south-america/commits?path=argentina&per_page=1"`.
2. Download each file from
   `https://raw.githubusercontent.com/openfootball/south-america/<sha>/argentina/<file>`.
3. Update the commit and every sha256 in `scripts/ingest/openfootball/config.ts`.
4. Run `pnpm test` and `pnpm data:ingest openfootball --dry-run`; the diff of `data/` shows what
   changed upstream.
