// Build-time CSS and the boot script for club theming (ADR 0013, decisions 2 and 3).
// Everything that reaches the <style> or the <script> is validated first: no CSS injection from data.
import { FAN_STORAGE_KEY } from "./fan-storage";

export const CLUB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX6 = /^#[0-9a-f]{6}$/i;

export type ClubThemeRule = { id: string; accent: string; accentContrast: string };

/** One `html[data-club="id"]{--accent:…;--accent-contrast:…}` rule per club, in input order. */
export function clubThemeCss(themes: readonly ClubThemeRule[]): string {
  return themes
    .map(({ id, accent, accentContrast }) => {
      if (!CLUB_SLUG.test(id)) throw new RangeError("Club id is not a slug.");
      if (!HEX6.test(accent) || !HEX6.test(accentContrast)) {
        throw new RangeError(`Club theme colors of ${id} must be 6-digit hex values.`);
      }
      return `html[data-club="${id}"]{--accent:${accent};--accent-contrast:${accentContrast}}`;
    })
    .join("");
}

/**
 * Inline script for <head>: sets `data-club` on <html> while the HTML is parsed, before the first
 * paint. A constant string; the only interpolated value is the storage key. Any failure is silent.
 */
export function themeBootScript(): string {
  const key = JSON.stringify(FAN_STORAGE_KEY);
  const slug = CLUB_SLUG.source;
  return (
    `(function(){try{var r=JSON.parse(localStorage.getItem(${key}));` +
    `if(r&&r.v===1&&typeof r.clubId==="string"&&/${slug}/.test(r.clubId))` +
    `document.documentElement.setAttribute("data-club",r.clubId)}catch(e){}})()`
  );
}
