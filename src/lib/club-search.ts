// Club search for the onboarding grid (plan 0008). Pure; works on the minimal `searchKeys` list.
import { foldName } from "@/data-model/club-aliases";

export type SearchableClub = { id: string; searchKeys: readonly string[] };

/** `foldName` (case, accents, spaces) and also without dots and apostrophes: "Atl. Tucumán". */
export function searchFold(text: string): string {
  return foldName(text.replace(/[.'’]/g, ""));
}

const WORD_START = /(?:^|[\s\-(])(?=[^\s\-()])/g;

/** 0 exact, 1 starts with, 2 a word starts with, 3 contains, `null` no match. */
function scoreKey(key: string, query: string): number | null {
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  for (const match of key.matchAll(WORD_START)) {
    if (key.startsWith(query, match.index + match[0].length)) return 2;
  }
  return key.includes(query) ? 3 : null;
}

/** Clubs matching the query, best first; ties keep the input order. Blank returns all. */
export function searchClubs<T extends SearchableClub>(clubs: readonly T[], query: string): T[] {
  const wanted = searchFold(query);
  if (wanted === "") return [...clubs];
  const scored: { club: T; score: number; index: number }[] = [];
  clubs.forEach((club, index) => {
    let best: number | null = null;
    for (const key of club.searchKeys) {
      const score = scoreKey(searchFold(key), wanted);
      if (score !== null && (best === null || score < best)) best = score;
    }
    if (best !== null) scored.push({ club, score: best, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.club);
}
