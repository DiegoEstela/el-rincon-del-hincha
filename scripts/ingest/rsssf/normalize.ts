// Pure normalization of parsed RSSSF tournaments into the data model (plan 0017, ADR 0020). It
// resolves club names exactly (never guessed), merges an abandoned match with the line that
// completes it, checks every final table against the parsed matches, and writes standings. Every
// problem of a run is collected and reported at once.
import type { AdapterOutput, FileReport } from "../core/adapter";
import { resolveClubId } from "../../../src/data-model/club-aliases";
import { createClubResolver } from "../core/club-resolver";
import { IngestError } from "../core/errors";
import { isSelectable } from "../../../src/data-model/club";
import type {
  Club,
  Competition,
  Match,
  Season,
  Standing,
  Title,
} from "../../../src/data-model/types";
import { RSSSF_COMPETITIONS, RSSSF_SOURCE_PREFIX, type TournamentConfig } from "./config";
import { resolveDate, type DateWindow } from "./dates";
import type { ParsedChampions } from "./layouts/champions-list";
import type { ManifestPage } from "./manifest";
import { buildTitles } from "./titles";
import type { ParsedMatch, ParsedTableRow, ParsedTournament, TitleSeason } from "./types";

export type RawTournament = {
  tournament: TournamentConfig;
  page: ManifestPage;
  parsed: ParsedTournament;
};

type Tally = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

const tallyOf = (): Tally => ({
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
});

function addResult(tally: Tally, goalsFor: number, goalsAgainst: number): void {
  tally.played += 1;
  tally.goalsFor += goalsFor;
  tally.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) {
    tally.won += 1;
    tally.points += 3;
  } else if (goalsFor === goalsAgainst) {
    tally.drawn += 1;
    tally.points += 1;
  } else {
    tally.lost += 1;
  }
}

const KEYS: (keyof Tally)[] = [
  "played",
  "won",
  "drawn",
  "lost",
  "goalsFor",
  "goalsAgainst",
  "points",
];

function sourceOf(t: TournamentConfig): string {
  return `${RSSSF_SOURCE_PREFIX}${t.page}.html#${t.excerpt}`;
}

/** Joins an abandoned line with the line that completes it; one record per fixture (D6). */
function mergeAbandoned(
  parsed: ParsedTournament,
  window: DateWindow,
  problems: string[],
): { match: ParsedMatch; suspended: boolean }[] {
  const out: { match: ParsedMatch; suspended: boolean }[] = [];
  const open = new Map<string, number>();
  for (const m of parsed.matches) {
    const key = `${m.home}\u0000${m.away}`;
    const where = `${parsed.excerpt}:${m.line}`;
    if (m.abandoned !== null && m.resumed !== null) {
      // One line with the final score and the day it was completed: "remaining time on 24 Oct".
      const on = /\bon (\d{1,2}) ([A-Z][a-z]{2})$/.exec(m.resumed);
      if (on === null || m.homeGoals === null) {
        problems.push(`${where}: cannot read when the abandoned match was completed`);
        continue;
      }
      try {
        const date = resolveDate(on[2], Number(on[1]), undefined, window, where);
        out.push({ match: { ...m, date }, suspended: false });
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    } else if (m.abandoned !== null) {
      if (m.homeGoals !== null) {
        problems.push(`${where}: an abandoned match with a score is not supported`);
        continue;
      }
      if (open.has(key)) {
        problems.push(`${where}: the same fixture is abandoned twice before it is completed`);
        continue;
      }
      open.set(key, out.length);
      out.push({ match: m, suspended: true });
    } else if (m.resumed !== null) {
      const index = open.get(key);
      if (index === undefined) {
        problems.push(`${where}: resumes a match that was not abandoned before`);
        continue;
      }
      if (m.date < out[index].match.date) {
        problems.push(`${where}: completes a match before the day it was abandoned`);
        continue;
      }
      open.delete(key);
      out[index] = { match: m, suspended: false };
    } else {
      out.push({ match: m, suspended: false });
    }
  }
  return out;
}

/** What the titles need besides the tournaments: the list of champions and the data already held. */
export type TitlesSource = {
  champions: ParsedChampions;
  titleSeasons: readonly TitleSeason[];
  existing: Readonly<Record<string, unknown[]>>;
};

export function normalizeRsssf(
  raws: readonly RawTournament[],
  clubs: readonly Club[],
  competitions: readonly Competition[] = RSSSF_COMPETITIONS,
  titlesSource?: TitlesSource,
): AdapterOutput {
  const problems: string[] = [];
  const resolver = createClubResolver(clubs, {
    variants: raws.flatMap((r) => r.page.variants),
  });
  const matches: Match[] = [];
  const seasons: Season[] = [];
  const standings: Standing[] = [];
  const reports: FileReport[] = [];
  const ids = new Set<string>();
  const cupTitles: Title[] = [];
  const appClubs = new Set(clubs.filter(isSelectable).map((club) => club.id));

  for (const { tournament: t, page, parsed } of raws) {
    const excerpt = `${t.page}.${t.excerpt}`;
    const source = sourceOf(t);
    const records: Match[] = [];
    const tallies = new Map<string, Tally>();
    const droppedUnknown = new Set<string>();
    const merged = mergeAbandoned(parsed, t.window, problems);

    for (const { match: m, suspended } of merged) {
      if (t.appClubsOnly) {
        const sides = [m.home, m.away].map((name) => ({ name, id: resolveClubId(clubs, name) }));
        if (!sides.some(({ id }) => id !== null && appClubs.has(id))) {
          for (const { name, id } of sides) if (id === null) droppedUnknown.add(name);
          continue;
        }
      }
      const at = { file: excerpt, line: m.line, season: t.id, context: "matches" };
      const homeId = resolver.resolve(m.home, at);
      const awayId = resolver.resolve(m.away, at);
      if (homeId === null || awayId === null) continue;
      if (t.mode.kind === "extends" && m.date <= t.mode.after) continue;
      const id = `${m.date}-${homeId}-${awayId}`;
      if (ids.has(id)) {
        problems.push(`${excerpt}:${m.line}: the match ${id} appears twice`);
        continue;
      }
      ids.add(id);
      records.push({
        id,
        season_id: t.id,
        date: m.date,
        home_id: homeId,
        away_id: awayId,
        home_goals: m.homeGoals,
        away_goals: m.awayGoals,
        decision: m.penalties !== null ? "penalties" : m.extraTime ? "extra_time" : null,
        home_penalties: m.penalties?.home ?? null,
        away_penalties: m.penalties?.away ?? null,
        stage: m.stage,
        is_final: m.stage === "Final",
        status: suspended ? "suspended" : "played",
        source,
        verified: false,
      });
      if (!suspended) {
        if (m.homeGoals === null || m.awayGoals === null) {
          problems.push(`${excerpt}:${m.line}: a played match has no score`);
          continue;
        }
        const home = tallies.get(homeId) ?? tallyOf();
        const away = tallies.get(awayId) ?? tallyOf();
        addResult(home, m.homeGoals, m.awayGoals);
        addResult(away, m.awayGoals, m.homeGoals);
        tallies.set(homeId, home);
        tallies.set(awayId, away);
      }
    }
    matches.push(...records);

    if (t.titleFromFinal) {
      const title = titleFromFinal(t, excerpt, merged, records, appClubs, problems);
      if (title !== null) cupTitles.push(title);
    }

    if (t.mode.kind === "own") {
      const dates = (
        t.appClubsOnly ? merged.map((x) => x.match.date) : records.map((r) => r.date)
      ).sort();
      if (dates.length === 0) {
        problems.push(`${excerpt}: no match was read, so the season has no dates`);
      } else {
        seasons.push({
          id: t.id,
          competition_id: t.competition_id,
          name: t.name,
          start: dates[0],
          end: dates[dates.length - 1],
          source,
        });
      }
    }

    if (t.tableCoversSeason) {
      const table = parsed.tables.find((x) => x.kind === "full");
      if (table === undefined) {
        problems.push(`${excerpt}: the season has no final table with full names`);
      } else {
        const used = new Set<string>();
        for (const row of table.rows) {
          const name = row.suffix === null ? row.name : `${row.name} ${row.suffix}`;
          const clubId = resolver.resolve(name, {
            file: excerpt,
            line: row.line,
            season: t.id,
            context: "table",
          });
          if (clubId === null) continue;
          const tally = tallies.get(clubId) ?? tallyOf();
          const wrong = mismatches(row, tally);
          const exception = page.tableExceptions.find(
            (e) => e.excerpt === t.excerpt && e.club === row.name,
          );
          if (wrong.length > 0 && exception !== undefined) used.add(row.name);
          else if (wrong.length > 0) {
            problems.push(`${excerpt}:${row.line}: ${row.name}: ${wrong.join("; ")}`);
          }
          tallies.delete(clubId);
          standings.push({
            club_id: clubId,
            season_id: t.id,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            source,
          });
        }
        for (const [clubId] of tallies) {
          problems.push(`${excerpt}: ${clubId} has matches but is not in the final table`);
        }
        for (const e of page.tableExceptions.filter((x) => x.excerpt === t.excerpt)) {
          if (!used.has(e.club))
            problems.push(`${excerpt}: the table exception for ${e.club} is unused`);
        }
      }
    }

    if (!t.tableCoversSeason) {
      for (const e of page.tableExceptions.filter((x) => x.excerpt === t.excerpt)) {
        problems.push(
          `${excerpt}: the table exception for ${e.club} is unused (no table is checked)`,
        );
      }
    }

    const dates = records.map((r) => r.date).sort();
    reports.push({
      file: excerpt,
      parsed: records.length,
      header: records.length,
      first: dates[0] ?? "",
      last: dates[dates.length - 1] ?? "",
      partial: false,
      lastSourceDate: dates[dates.length - 1] ?? "",
      seasonEnd: dates[dates.length - 1] ?? "",
      ...(t.appClubsOnly ? { droppedUnknown: [...droppedUnknown].sort() } : {}),
    });
  }

  let titles: Title[] | undefined;
  if (titlesSource !== undefined) {
    // The data as it will be after this run: the seasons held and added, and the matches of the
    // other sources plus the ones this run writes. The matches of this adapter that are in
    // data/ now are replaced by this run, so they must not date a title.
    const facts = new Map<string, { last: string | null; finals: string[] }>();
    for (const s of [...((titlesSource.existing["seasons.json"] ?? []) as Season[]), ...seasons]) {
      facts.set(s.id, { last: null, finals: [] });
    }
    const held = ((titlesSource.existing["matches.json"] ?? []) as Match[]).filter(
      (m) => !m.source.startsWith(RSSSF_SOURCE_PREFIX),
    );
    for (const m of [...held, ...matches]) {
      const season = facts.get(m.season_id);
      if (season === undefined) continue;
      if (season.last === null || m.date > season.last) season.last = m.date;
      if (m.is_final) season.finals.push(m.date);
    }
    // The champion marked in the final table of a tournament we read, to check the list against.
    const tableChampions = new Map<string, string>();
    for (const { tournament: t, parsed } of raws) {
      const row = parsed.tables
        .find((x) => x.kind === "full")
        ?.rows.find((r) => r.mark === "Champion");
      if (row === undefined) continue;
      const name = row.suffix === null ? row.name : `${row.name} ${row.suffix}`;
      const id = resolver.resolve(name, {
        file: `${t.page}.${t.excerpt}`,
        line: row.line,
        season: t.id,
        context: "table",
      });
      if (id !== null) tableChampions.set(t.id, id);
    }
    titles = buildTitles({
      champions: titlesSource.champions,
      titleSeasons: titlesSource.titleSeasons,
      resolve: (name, line) =>
        resolver.resolve(name, {
          file: titlesSource.champions.excerpt,
          line,
          season: "champions",
          context: "champions",
        }),
      seasons: facts,
      tableChampions,
      problems,
    });
  }

  problems.push(...resolver.problems());
  if (problems.length > 0) throw new IngestError(problems);
  return {
    // Only the competitions the tournaments of this run belong to: adapters add what they use.
    competitions: competitions.filter((c) =>
      raws.some((r) => r.tournament.competition_id === c.id),
    ),
    seasons,
    matches,
    standings,
    ...(titles === undefined && cupTitles.length === 0
      ? {}
      : { titles: [...(titles ?? []), ...cupTitles] }),
    report: { files: reports },
  };
}

function mismatches(row: ParsedTableRow, tally: Tally): string[] {
  const names: Record<keyof Tally, string> = {
    played: "MP",
    won: "W",
    drawn: "D",
    lost: "L",
    goalsFor: "Gf",
    goalsAgainst: "Ga",
    points: "P",
  };
  return KEYS.filter((k) => row[k] !== tally[k]).map(
    (k) => `the table says ${names[k]}=${row[k]} but the matches give ${tally[k]}`,
  );
}

/**
 * The title of a cup decided in one final: the winner on goals, else on penalties (D-B4 of plan
 * 0017). A champion that is not an app club has no title row: the final is not even written when
 * neither side is an app club.
 */
function titleFromFinal(
  t: TournamentConfig,
  excerpt: string,
  merged: readonly { match: ParsedMatch }[],
  records: readonly Match[],
  appClubs: ReadonlySet<string>,
  problems: string[],
): Title | null {
  const finals = merged.filter(({ match }) => match.stage === "Final");
  if (finals.length !== 1) {
    problems.push(
      finals.length === 0
        ? `${t.id}: no final in ${excerpt} to name the champion`
        : `${t.id}: ${finals.length} finals in ${excerpt}, expected one to name the champion`,
    );
    return null;
  }
  const final = records.find((r) => r.is_final);
  if (final === undefined) return null;
  const home =
    (final.home_goals ?? 0) - (final.away_goals ?? 0) ||
    (final.home_penalties ?? 0) - (final.away_penalties ?? 0);
  if (home === 0) {
    problems.push(`${t.id}: the final ${final.id} has no winner on goals or penalties`);
    return null;
  }
  const clubId = home > 0 ? final.home_id : final.away_id;
  if (!appClubs.has(clubId)) return null;
  return {
    id: `${t.id}-${clubId}`,
    club_id: clubId,
    competition_id: t.competition_id,
    season_id: t.id,
    awarded_on: final.date,
    shared: false,
    source: final.source,
    verified: false,
  };
}
