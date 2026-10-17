// Pure normalization of parsed openfootball files into the data model (plan 0011).
import type { AdapterOutput, FileReport } from "../core/adapter";
import { IngestError } from "../core/errors";
import { createClubResolver } from "../core/club-resolver";
import type { Club, Competition, Match, Season } from "../../../src/data-model/types";
import {
  OPENFOOTBALL_COMPETITIONS,
  OPENFOOTBALL_SEASONS,
  mapStage,
  permalink,
  type OpenfootballSeason,
} from "./config";
import type { ParsedFile } from "./parse";

export type NormalizeConfig = {
  competitions: readonly Competition[];
  seasons: readonly OpenfootballSeason[];
};

const DEFAULT_CONFIG: NormalizeConfig = {
  competitions: OPENFOOTBALL_COMPETITIONS,
  seasons: OPENFOOTBALL_SEASONS,
};

export function normalizeOpenfootball(
  files: readonly ParsedFile[],
  clubs: readonly Club[],
  config: NormalizeConfig = DEFAULT_CONFIG,
): AdapterOutput {
  const resolver = createClubResolver(clubs);
  const matches: Match[] = [];
  const seasons: Season[] = [];
  const reports: FileReport[] = [];
  const problems: string[] = [];

  for (const parsed of files) {
    const season = config.seasons.find((s) => s.file === parsed.file);
    if (!season) {
      problems.push(`${parsed.file}: no season is configured for this file`);
      continue;
    }

    for (const m of parsed.matches) {
      const at = { file: parsed.file, line: m.line, season: season.id };
      const homeId = resolver.resolve(m.home, at);
      const awayId = resolver.resolve(m.away, at);
      if (homeId === null || awayId === null) continue;
      const { stage, is_final } = mapStage(m.heading);
      matches.push({
        id: `${m.date}-${homeId}-${awayId}`,
        season_id: season.id,
        date: m.date,
        home_id: homeId,
        away_id: awayId,
        home_goals: m.homeGoals,
        away_goals: m.awayGoals,
        decision: m.penalties ? "penalties" : null,
        home_penalties: m.penalties?.home ?? null,
        away_penalties: m.penalties?.away ?? null,
        stage,
        is_final,
        status: "played",
        source: permalink(parsed.file, m.line),
        verified: false,
      });
    }

    const end = season.partial?.end ?? parsed.header.last;
    seasons.push({
      id: season.id,
      competition_id: season.competition_id,
      name: season.name,
      start: parsed.header.first,
      end,
      source: season.partial?.source ?? permalink(parsed.file),
    });
    reports.push({
      file: parsed.file,
      parsed: parsed.matches.length,
      header: parsed.header.matches,
      first: parsed.header.first,
      last: parsed.header.last,
      partial: season.partial !== undefined,
      lastSourceDate: parsed.header.last,
      seasonEnd: end,
    });
  }

  problems.push(...resolver.problems());
  if (problems.length > 0) throw new IngestError(problems);

  return { competitions: [...config.competitions], seasons, matches, report: { files: reports } };
}
