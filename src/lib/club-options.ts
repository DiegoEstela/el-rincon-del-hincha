// What the client needs to draw one club in the onboarding grid (plan 0008). Server only: it uses
// contrast.ts and the zod `Club` type, so client modules import just the `ClubOption` type.
import { searchFold } from "./club-search";
import { contrastRatio } from "./contrast";
import type { Club } from "@/data-model/types";

export type CrestSpec = {
  pattern: Club["jersey_pattern"];
  primary: string;
  secondary: string;
  tertiary?: string;
  initials: string;
  initialsInk: string;
};

export type ClubOption = {
  id: string;
  name: string;
  shortName: string;
  searchKeys: string[];
  crest: CrestSpec;
};

const INK_DARK = "#0a1a00";
const INK_LIGHT = "#ffffff";
const SKIPPED_WORDS = new Set(["de", "del", "y"]);

/** Names of 2+ words: first letter of each word but de/del/y (max 4). One word: first 3 letters. */
export function clubInitials(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{M}|['’]/gu, "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3);
  return words
    .filter((word) => !SKIPPED_WORDS.has(word.toLowerCase()))
    .map((word) => word[0])
    .join("")
    .slice(0, 4);
}

/** Dark or white ink, whichever contrasts more on the crest's top band. */
export function initialsInk(primary: string): string {
  return contrastRatio(INK_DARK, primary) >= contrastRatio(INK_LIGHT, primary)
    ? INK_DARK
    : INK_LIGHT;
}

// Some aliases exist only to read a source: the legal form in front ("CA Boca Juniors", "Club
// Atlético Tucumán") or the headquarters after ("Club Estudiantes de La Plata (La Plata, B)").
// Nobody types those, and they would make "ca" match every club, so they are not search keys.
const SOURCE_ONLY_ALIAS = /^(?:CA|CD|CS|CSD|CSyD|AA|Cd|Club) |\s\([^()]*,\s*[A-Z]\)$/;

export function toClubOption(club: Club): ClubOption {
  const seen = new Set<string>();
  const aliases = club.aliases.filter((alias) => !SOURCE_ONLY_ALIAS.test(alias));
  const searchKeys = [club.name, club.short_name, ...aliases].filter((key) => {
    const folded = searchFold(key);
    if (seen.has(folded)) return false;
    seen.add(folded);
    return true;
  });
  const { primary, secondary, tertiary } = club.colors;
  return {
    id: club.id,
    name: club.name,
    shortName: club.short_name,
    searchKeys,
    crest: {
      pattern: club.jersey_pattern,
      primary,
      secondary,
      ...(tertiary ? { tertiary } : {}),
      initials: clubInitials(club.name),
      initialsInk: initialsInk(primary),
    },
  };
}
