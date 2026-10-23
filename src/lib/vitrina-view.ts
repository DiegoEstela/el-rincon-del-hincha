// View model of the vitrina (plan 0018, ADR 0021). Pure: everything the screen shows is computed
// here from the engine and the copy helpers, so the components stay dumb. The fan start date goes
// in and only a month and year (`since`) comes out; title and match dates are public facts and are
// shown in full.
import {
  coChampions,
  pendingTitles,
  titleCoverage,
  titlesBeforePeriod,
  titlesInPeriod,
  trophyShelf,
  isRecognized,
  type Shelf,
  type TitleInPeriod,
} from "@/domain/titles";
import { fanPeriod } from "@/domain/period";
import type { Competition } from "@/data-model/types";
import type { StatsIndex } from "@/domain/types";
import type { ClubOption } from "./club-options";
import { formatMatchDate } from "./rivalry-copy";
import { formatMonthYear, type CoverageCopy } from "./coverage-copy";
import type { StartMode } from "./fan-storage";
import { buildMatchCard, type MatchCardView } from "./match-card-view";
import {
  COUNTER_CAPTION,
  COUNTER_MISSING,
  CRITERION,
  NO_DECIDING_MATCH,
  SHELF_TITLES,
  UNDER_CONSTRUCTION,
  checklistLabel,
  matchHeading,
  sharedWith,
  silhouetteCaption,
  sourceHost,
  titleCoverageCopy,
  titlesIncludedLine,
  trophyButtonLabel,
  wonLabel,
  zeroTitlesLine,
  type ChecklistStatus,
  type NoticeRow,
} from "./vitrina-copy";

export type VitrinaViewInput = Readonly<{
  /** Built once from the club document by the caller. */
  index: StatsIndex;
  clubId: string;
  /** The fan start date. It is used to compute and never copied into the result. */
  startDate: string;
  startMode: StartMode;
  now: Date;
  catalog: ReadonlyMap<string, ClubOption>;
  competitionNames: ReadonlyMap<string, string>;
  seasonNames: ReadonlyMap<string, string>;
}>;

export type TrophyKind = "league" | "cup" | "international" | "other";

export type TrophyDetail = Readonly<{
  /** "7 de abril de 2019" */
  awardedOn: string;
  /** "La final" or "La última fecha". */
  matchHeading: string;
  match: MatchCardView | null;
  /** Said when there is no match to show. */
  noMatchLine: string | null;
  /** "Compartido con Boca." */
  sharedWith: string | null;
  /** The host of the source when it is an https link, else null (the source is then plain text). */
  sourceHost: string | null;
  sourceUrl: string;
  criterion: string;
  recognized: boolean;
}>;

export type TrophyView = Readonly<{
  id: string;
  /** The year of `awarded_on`. */
  year: string;
  seasonName: string;
  competitionName: string;
  kind: TrophyKind;
  shared: boolean;
  buttonLabel: string;
  detail: TrophyDetail;
}>;

export type SilhouetteView = Readonly<{
  competitionId: string;
  name: string;
  kind: TrophyKind;
  caption: string;
}>;

export type ShelfView = Readonly<{
  key: Shelf;
  title: string;
  trophies: readonly TrophyView[];
  silhouettes: readonly SilhouetteView[];
  /** Said instead of silhouettes when no competition of the shelf is loaded. */
  underConstruction: string | null;
}>;

export type ChecklistRow = Readonly<{
  competitionId: string;
  name: string;
  status: ChecklistStatus;
  label: string;
}>;

export type VitrinaView = Readonly<{
  /** Month and year the counted period starts in, such as "mayo de 1990". */
  since: string;
  /** False when the dataset has no title at all: the screen says so instead of showing zeros. */
  hasAnyTitles: boolean;
  /** The fan starts after today. */
  emptyPeriod: boolean;
  counters: Readonly<{
    wonLabel: string;
    won: number;
    missingLabel: string;
    missing: number;
    caption: string;
  }>;
  shelves: readonly ShelfView[];
  checklist: readonly ChecklistRow[];
  /** Titles of the club before the fan arrived: shown apart, never counted. */
  before: readonly TrophyView[];
  /** Titles of competitions the AFA does not recognize: shown apart, never counted. */
  disputed: readonly TrophyView[];
  notice: CoverageCopy;
  included: string;
  /** The humor line when titles are loaded and the club has none in the period. */
  emptyLine: string | null;
}>;

const SHELF_ORDER: readonly Shelf[] = ["international", "domestic", "other"];

function kindOf(competition: Competition): TrophyKind {
  if (trophyShelf(competition) === "international") return "international";
  if (competition.type === "league") return "league";
  return competition.type === "national_cup" ? "cup" : "other";
}

export function buildVitrinaView(input: VitrinaViewInput): VitrinaView {
  const { index, clubId, catalog, competitionNames, seasonNames } = input;
  const fan = fanPeriod(input.startDate, input.now);
  const shortName = (id: string) => catalog.get(id)?.shortName ?? id;
  const competitionName = (id: string) => competitionNames.get(id) ?? id;
  const seasonName = (id: string) => seasonNames.get(id) ?? id;
  const names = { shortName, competitionNames, seasonNames };

  const inPeriod = titlesInPeriod(index, clubId, fan, { includeUnrecognized: true });
  const won = inPeriod.filter((t) => t.recognized);
  const disputed = inPeriod.filter((t) => !t.recognized);
  const before = titlesBeforePeriod(index, clubId, fan);
  const pending = pendingTitles(index, clubId, fan);
  const windows = titleCoverage(index, fan.end);

  const trophy = (t: TitleInPeriod): TrophyView => {
    const record = index.data.titles.find((title) => title.id === t.id)!;
    const others = coChampions(index, record).map(shortName);
    const url = t.source;
    return {
      id: t.id,
      year: t.awardedOn.slice(0, 4),
      seasonName: seasonName(t.season.id),
      competitionName: competitionName(t.competition.id),
      kind: kindOf(t.competition),
      shared: t.shared,
      buttonLabel: trophyButtonLabel(seasonName(t.season.id), t.awardedOn),
      detail: {
        awardedOn: formatMatchDate(t.awardedOn),
        matchHeading: matchHeading(t.decidingMatch?.is_final ?? false),
        match: t.decidingView === null ? null : buildMatchCard(t.decidingView, names),
        noMatchLine: t.decidingView === null ? NO_DECIDING_MATCH : null,
        sharedWith: sharedWith(others),
        sourceHost: sourceHost(url),
        sourceUrl: url,
        criterion: CRITERION,
        recognized: t.recognized,
      },
    };
  };

  const silhouettes = pending
    .filter((p) => p.status === "pending")
    .map((p) => ({
      shelf: p.shelf,
      view: {
        competitionId: p.competition.id,
        name: competitionName(p.competition.id),
        kind: kindOf(p.competition),
        caption: silhouetteCaption(
          seasonName(p.windowFirstSeasonId!),
          seasonName(p.windowLastSeasonId!),
        ),
      } satisfies SilhouetteView,
    }));

  const recognized = index.data.competitions.filter(isRecognized);
  const shelves = SHELF_ORDER.map((key): ShelfView => {
    const loaded = recognized.some((c) => trophyShelf(c) === key);
    return {
      key,
      title: SHELF_TITLES[key],
      trophies: won.filter((t) => t.shelf === key).map(trophy),
      silhouettes: silhouettes
        .filter((s) => s.shelf === key)
        .map((s) => s.view)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
      underConstruction: loaded || key === "domestic" ? null : UNDER_CONSTRUCTION[key],
    };
  });

  const checklist = recognized
    .map((competition): ChecklistRow | null => {
      const wonCount = won.filter((t) => t.competition.id === competition.id).length;
      const entry = pending.find((p) => p.competition.id === competition.id);
      if (wonCount === 0 && entry === undefined) return null;
      const status: ChecklistStatus =
        wonCount > 0 ? "won" : entry!.status === "pending" ? "missing" : "unknown";
      return {
        competitionId: competition.id,
        name: competitionName(competition.id),
        status,
        label: checklistLabel(status, wonCount),
      };
    })
    .filter((row): row is ChecklistRow => row !== null)
    .sort(
      (a, b) =>
        SHELF_ORDER.indexOf(shelfOf(index, a.competitionId)) -
          SHELF_ORDER.indexOf(shelfOf(index, b.competitionId)) ||
        a.name.localeCompare(b.name, "es"),
    );

  const noticeRows = windows
    .filter((w) =>
      index.data.seasons.some(
        (s) => s.competition_id === w.competitionId && s.start <= fan.end && s.end >= fan.start,
      ),
    )
    .map((window): NoticeRow => {
      const inFan =
        window.windowStart !== null &&
        window.windowEnd !== null &&
        window.windowStart <= fan.end &&
        window.windowEnd >= fan.start;
      return {
        competitionName: competitionName(window.competitionId),
        window,
        firstSeasonName: window.firstSeasonId === null ? null : seasonName(window.firstSeasonId),
        lastSeasonName: window.lastSeasonId === null ? null : seasonName(window.lastSeasonId),
        windowInPeriod: inFan,
        missingSeasonNames: window.missingSeasonIds
          .map((id) => index.data.seasons.find((s) => s.id === id)!)
          // Missing seasons have ended, so only their end can fall before the period.
          .filter((s) => s.end >= fan.start)
          .map((s) => seasonName(s.id)),
      };
    });

  const hasAnyTitles = index.data.titles.length > 0;
  return {
    since: formatMonthYear(fan.start),
    hasAnyTitles,
    emptyPeriod: fan.isEmpty,
    counters: {
      wonLabel: wonLabel(input.startMode),
      won: won.length,
      missingLabel: COUNTER_MISSING,
      missing: silhouettes.length,
      caption: COUNTER_CAPTION,
    },
    shelves,
    checklist,
    before: before.map(trophy),
    disputed: disputed.map(trophy),
    notice: titleCoverageCopy(noticeRows, fan.isEmpty),
    included: titlesIncludedLine(
      noticeRows.filter((r) => r.windowInPeriod).map((r) => r.competitionName),
    ),
    emptyLine:
      hasAnyTitles && !fan.isEmpty && won.length === 0 ? zeroTitlesLine(input.startMode) : null,
  };
}

function shelfOf(index: StatsIndex, competitionId: string): Shelf {
  return trophyShelf(index.data.competitions.find((c) => c.id === competitionId)!);
}
