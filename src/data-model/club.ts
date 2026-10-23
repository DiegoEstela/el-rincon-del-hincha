import type { Club } from "./types";

/** A club a fan can pick: it has the kit data the crest and the theme need (ADR 0022). */
export type SelectableClub = Club &
  Required<Pick<Club, "colors" | "jersey_pattern" | "founded" | "city">>;

/** Clubs are selectable unless the record says otherwise; the rest are opponents. */
export function isSelectable(club: Club): club is SelectableClub {
  return club.selectable !== false;
}
