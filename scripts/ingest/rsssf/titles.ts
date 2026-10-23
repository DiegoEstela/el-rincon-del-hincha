// First division titles from the RSSSF list of champions (plan 0017, D5). A title is written for
// each season listed in the config, never for a tournament the AFA proclaimed outside the
// regulations (the 2025 "Anual LPF" is not a title we load). The champion of the list must be the
// champion marked in the final table of the same tournament when we read one. The date is the day
// of the final when the season has one, else the last match of the season.
import type { Title } from "../../../src/data-model/types";
import { RSSSF_TABLES } from "./config";
import type { ParsedChampions } from "./layouts/champions-list";
import type { TitleSeason } from "./types";

export const CHAMPIONS_SOURCE = `${RSSSF_TABLES}argchamp.html#champions`;

/** The date of the last match of the season (null if it has none) and of its final matches. */
type SeasonFacts = { last: string | null; finals: string[] };

export type TitlesInput = {
  champions: ParsedChampions;
  titleSeasons: readonly TitleSeason[];
  /** Club id for a champion name of the list, or null (already reported as unknown). */
  resolve: (name: string, line: number) => string | null;
  /** Season id -> its last match date and its final dates (the data as it will be after this run). */
  seasons: ReadonlyMap<string, SeasonFacts>;
  /** Season id -> the club id marked "Champion" in the final table we read, when we read one. */
  tableChampions: ReadonlyMap<string, string>;
  problems: string[];
};

export function buildTitles(input: TitlesInput): Title[] {
  const { champions, titleSeasons, problems } = input;
  const titles: Title[] = [];
  for (const t of titleSeasons) {
    const row = champions.rows.find(
      (r) => r.season === t.row.season && r.tournament === t.row.tournament,
    );
    if (row === undefined) {
      problems.push(
        `${champions.excerpt}: no champion row for ${t.row.season} ${t.row.tournament}`,
      );
      continue;
    }
    const facts = input.seasons.get(t.seasonId);
    if (facts === undefined) {
      problems.push(
        `${champions.excerpt}:${row.line}: the season ${t.seasonId} is not in the data`,
      );
      continue;
    }
    const clubId = input.resolve(row.champion, row.line);
    if (clubId === null) continue;
    const marked = input.tableChampions.get(t.seasonId);
    if (marked !== undefined && marked !== clubId) {
      problems.push(
        `${champions.excerpt}:${row.line}: the list says ${clubId} won ${t.seasonId}, the final table says ${marked}`,
      );
      continue;
    }
    const finals = [...facts.finals].sort();
    const awardedOn = finals.length > 0 ? finals[finals.length - 1] : facts.last;
    if (awardedOn === null) {
      problems.push(
        `${champions.excerpt}:${row.line}: the season ${t.seasonId} has no match to date its title`,
      );
      continue;
    }
    titles.push({
      id: `${t.seasonId}-${clubId}`,
      club_id: clubId,
      competition_id: t.competition_id,
      season_id: t.seasonId,
      awarded_on: awardedOn,
      shared: false,
      source: CHAMPIONS_SOURCE,
      verified: false,
    });
  }
  return titles;
}
