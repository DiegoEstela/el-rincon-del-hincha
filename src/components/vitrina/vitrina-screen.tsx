"use client";

import { useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { CoverageNotice } from "@/components/coverage/coverage-notice";
import { useClubDocuments } from "@/components/fan/use-club-documents";
import { useFanChoice } from "@/components/fan/use-fan-choice";
import { statsDataFromClubData, type ClubData } from "@/domain/club-data";
import { buildStatsIndex } from "@/domain/data";
import { loadClubData } from "@/lib/club-data-client";
import type { ClubOption } from "@/lib/club-options";
import type { FanChoice } from "@/lib/fan-storage";
import { buildVitrinaView } from "@/lib/vitrina-view";
import { BeforePeriod, Disputed } from "./before-period";
import { Checklist } from "./checklist";
import { Counters } from "./counters";
import { Shelf } from "./shelf";
import { TrophyDetail } from "./trophy-detail";
import {
  EmptyPeriod,
  NoTitlesLoaded,
  VitrinaEmpty,
  VitrinaError,
  VitrinaSkeleton,
} from "./vitrina-states";

const TITLE = "font-display text-4xl leading-none lg:text-6xl";

/**
 * "Mi vitrina". The club and the start date come from this device; the browser fetches the
 * document of the club (only its id is requested) and computes everything here (ADR 0018). Before
 * hydration CSS decides between the skeleton and the empty state (`html[data-club]`).
 */
export function VitrinaScreen({
  clubs,
  loadData = loadClubData,
}: {
  clubs: readonly ClubOption[];
  loadData?: (clubId: string) => Promise<ClubData>;
}) {
  const clubIds = useMemo(() => new Set(clubs.map((club) => club.id)), [clubs]);
  const choice = useFanChoice(clubIds);
  const clubId = choice === "unknown" || choice === null ? null : choice.clubId;
  const documents = useClubDocuments(clubId === null ? null : [clubId], loadData);

  if (choice === "unknown") {
    return (
      <div>
        <div className="pending-skeleton grid gap-4">
          <h1 className={TITLE}>Mi vitrina</h1>
          <VitrinaSkeleton />
        </div>
        <div className="pending-empty">
          <VitrinaEmpty />
        </div>
      </div>
    );
  }
  if (choice === null) return <VitrinaEmpty />;
  if (documents.status === "error") return <VitrinaError onRetry={documents.retry} />;
  if (documents.status !== "ready") {
    return (
      <div className="grid gap-4">
        <h1 className={TITLE}>Mi vitrina</h1>
        <VitrinaSkeleton />
      </div>
    );
  }
  return (
    <VitrinaContent key={choice.clubId} choice={choice} data={documents.docs[0]} clubs={clubs} />
  );
}

function VitrinaContent({
  choice,
  data,
  clubs,
}: {
  choice: FanChoice;
  data: ClubData;
  clubs: readonly ClubOption[];
}) {
  // "Today" is taken once the page is in the browser, never while prerendering.
  const [now] = useState(() => new Date());
  const [openId, setOpenId] = useState<string | null>(null);
  const index = useMemo(() => buildStatsIndex(statsDataFromClubData(data)), [data]);
  const catalog = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);
  const competitionNames = useMemo(
    () => new Map(data.competitions.map((c) => [c.id, c.name])),
    [data],
  );
  const seasonNames = useMemo(() => new Map(data.seasons.map((s) => [s.id, s.name])), [data]);
  const view = useMemo(
    () =>
      buildVitrinaView({
        index,
        clubId: choice.clubId,
        startDate: choice.startDate,
        startMode: choice.startMode,
        now,
        catalog,
        competitionNames,
        seasonNames,
      }),
    [index, choice, now, catalog, competitionNames, seasonNames],
  );
  const own = catalog.get(choice.clubId);
  const open =
    openId === null
      ? null
      : ([...view.shelves.flatMap((s) => s.trophies), ...view.before, ...view.disputed].find(
          (t) => t.id === openId,
        ) ?? null);

  const header = (
    <header className="flex items-center gap-4">
      {own ? <Crest spec={own.crest} className="size-14 shrink-0" /> : null}
      <div className="min-w-0">
        <h1 className={TITLE}>Mi vitrina</h1>
        <p className="text-muted mt-1 text-sm">
          {own?.shortName ?? "Tu club"} · desde {view.since}
        </p>
      </div>
    </header>
  );

  if (!view.hasAnyTitles) {
    return (
      <div className="grid gap-6">
        {header}
        <CoverageNotice copy={view.notice} included={view.included} />
        <NoTitlesLoaded />
      </div>
    );
  }
  if (view.emptyPeriod) {
    return (
      <div className="grid gap-6">
        {header}
        <EmptyPeriod />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      <div className="lg:col-span-3">{header}</div>
      <div className="lg:col-start-3 lg:row-start-2">
        <Counters counters={view.counters} />
      </div>
      <div className="lg:col-start-3 lg:row-start-3">
        <CoverageNotice copy={view.notice} included={view.included} />
      </div>
      <div className="grid gap-4 lg:col-span-2 lg:col-start-1 lg:row-span-4 lg:row-start-2">
        {view.emptyLine === null ? null : <p className="text-muted">{view.emptyLine}</p>}
        {view.shelves.map((shelf) => (
          <Shelf key={shelf.key} shelf={shelf} onOpen={setOpenId} />
        ))}
      </div>
      <div className="lg:col-start-3 lg:row-start-4">
        <Checklist rows={view.checklist} />
      </div>
      <div className="grid gap-4 lg:col-start-3 lg:row-start-5">
        <BeforePeriod trophies={view.before} onOpen={setOpenId} />
        <Disputed trophies={view.disputed} onOpen={setOpenId} />
      </div>
      <TrophyDetail trophy={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
