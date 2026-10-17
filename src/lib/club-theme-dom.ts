// Sets the `data-club` attribute that selects the club's accent rule (ADR 0013). Client safe: no
// zod, no contrast code, no dataset. The colors live in the build-time CSS, not here.
import { CLUB_SLUG } from "./club-theme-css";

/** Sets `data-club`, or removes it for `null`. An id that is not a slug is ignored. */
export function applyClubTheme(root: HTMLElement, clubId: string | null): void {
  if (clubId === null) {
    root.removeAttribute("data-club");
  } else if (CLUB_SLUG.test(clubId)) {
    root.setAttribute("data-club", clubId);
  }
}

/** The club id of a raw saved record, or `null` when there is none or it looks wrong. */
export function savedClubId(raw: string | null): string | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { v, clubId } = value as Record<string, unknown>;
  return v === 1 && typeof clubId === "string" && CLUB_SLUG.test(clubId) ? clubId : null;
}
