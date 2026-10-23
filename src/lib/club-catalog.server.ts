import "server-only";
// The club list for the onboarding, built once at module load from data/clubs.json (plan 0008).
// zod and the contrast code stay here: the client gets plain `ClubOption`s and a `data-club` rule.
import clubsJson from "../../data/clubs.json";
import { isSelectable } from "@/data-model/club";
import { clubSchema } from "@/data-model/schemas";
import { toClubOption, type ClubOption } from "./club-options";
import { deriveClubTheme } from "./club-theme";
import { clubThemeCss } from "./club-theme-css";

// Opponents (ADR 0022) only appear in matches: they are not in the onboarding or the theme CSS.
const clubs = clubSchema.array().parse(clubsJson).filter(isSelectable);

export const CLUB_OPTIONS: ClubOption[] = clubs.map(toClubOption);

export const CLUB_THEME_CSS: string = clubThemeCss(
  clubs.map(({ id, colors }) => ({ id, ...deriveClubTheme(colors) })),
);
