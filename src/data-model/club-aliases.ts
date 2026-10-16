// Pure helpers that map a source's team spelling to a club id (ADR 0012).

export type ClubAliases = { readonly id: string; readonly aliases: readonly string[] };

/** Lowercase, no diacritics, collapsed whitespace. Used for the alias-uniqueness check only. */
export function foldName(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Exact match after NFC normalization and trimming. No case, prefix or fuzzy matching:
 * `Huracan (C)` must never resolve to Huracán. Returns null when nothing matches.
 */
export function resolveClubId(clubs: readonly ClubAliases[], sourceName: string): string | null {
  const wanted = sourceName.normalize("NFC").trim();
  const club = clubs.find((c) => c.aliases.some((a) => a.normalize("NFC") === wanted));
  return club?.id ?? null;
}
