"use client";

import { useMemo, useState } from "react";
import { CoverageNotice } from "@/components/coverage/coverage-notice";
import { useClubDocuments } from "@/components/fan/use-club-documents";
import { useFanChoice } from "@/components/fan/use-fan-choice";
import { RivalsEmpty, RivalsError } from "@/components/rivals/rivals-states";
import { statsDataFromClubData, type ClubData } from "@/domain/club-data";
import { buildStatsIndex } from "@/domain/data";
import { loadClubData } from "@/lib/club-data-client";
import type { ClubOption } from "@/lib/club-options";
import { parseRivalId } from "@/lib/engine-input";
import type { FanChoice } from "@/lib/fan-storage";
import { buildRivalryView } from "@/lib/rivalry-view";
import { FinalsPanel } from "./finals-panel";
import { GoleadasPanel } from "./goleadas-panel";
import { MatchCard } from "./match-card";
import { RecordPanel } from "./record-panel";
import { RivalryHeader } from "./rivalry-header";
import { NeverMet, RivalrySkeleton, SameClub } from "./rivalry-states";
import { StakesPanel } from "./stakes-panel";
import { StreaksPanel } from "./streaks-panel";

/**
 * "[Mi club] vs. [Rival]". The rival is public (it is in the URL); the fan club and the start date
 * come from this device. The browser loads the two club documents (only their ids are requested)
 * and computes everything here (ADR 0018). Before hydration CSS decides between the skeleton and
 * the empty state (`html[data-club]`).
 */
export function RivalryScreen({
  clubs,
  rival,
  loadData = loadClubData,
}: {
  clubs: readonly ClubOption[];
  rival: ClubOption;
  loadData?: (clubId: string) => Promise<ClubData>;
}) {
  const clubIds = useMemo(() => new Set(clubs.map((club) => club.id)), [clubs]);
  const choice = useFanChoice(clubIds);
  const parsed =
    choice === "unknown" || choice === null
      ? null
      : parseRivalId(rival.id, { clubId: choice.clubId, clubIds });
  const ids =
    choice !== "unknown" && choice !== null && parsed?.ok ? [choice.clubId, rival.id] : null;
  const documents = useClubDocuments(ids, loadData);

  if (choice === "unknown") {
    return (
      <div className="grid gap-6">
        <RivalryHeader
          title={`Tu club vs. ${rival.shortName}`}
          subline={null}
          own={null}
          rival={rival}
        />
        <div className="pending-skeleton">
          <RivalrySkeleton />
        </div>
        <div className="pending-empty">
          <RivalsEmpty />
        </div>
      </div>
    );
  }
  if (choice === null) {
    return (
      <div className="grid gap-6">
        <RivalryHeader
          title={`Tu club vs. ${rival.shortName}`}
          subline={null}
          own={null}
          rival={rival}
        />
        <RivalsEmpty />
      </div>
    );
  }
  if (parsed !== null && !parsed.ok) {
    // `unknown_club` cannot happen (the server answered 404), so both codes show a friendly card.
    return <SameClub />;
  }
  const own = clubs.find((club) => club.id === choice.clubId) ?? null;
  const header = (title: string, subline: string | null) => (
    <RivalryHeader title={title} subline={subline} own={own} rival={rival} />
  );
  if (documents.status === "error") return <RivalsError onRetry={documents.retry} />;
  if (documents.status !== "ready") {
    return (
      <div className="grid gap-6">
        {header(`${own?.shortName ?? "Tu club"} vs. ${rival.shortName}`, null)}
        <RivalrySkeleton />
      </div>
    );
  }
  return (
    <RivalryContent
      key={`${choice.clubId}|${rival.id}`}
      choice={choice}
      docs={documents.docs}
      clubs={clubs}
      rivalId={rival.id}
      header={header}
    />
  );
}

function RivalryContent({
  choice,
  docs,
  clubs,
  rivalId,
  header,
}: {
  choice: FanChoice;
  docs: readonly ClubData[];
  clubs: readonly ClubOption[];
  rivalId: string;
  header: (title: string, subline: string | null) => React.ReactNode;
}) {
  // "Today" is taken once the page is in the browser, never while prerendering.
  const [now] = useState(() => new Date());
  const data = useMemo(() => statsDataFromClubData(...docs), [docs]);
  const index = useMemo(() => buildStatsIndex(data), [data]);
  const catalog = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);
  const competitionNames = useMemo(
    () => new Map(data.competitions.map((c) => [c.id, c.name])),
    [data],
  );
  const seasonNames = useMemo(() => new Map(data.seasons.map((s) => [s.id, s.name])), [data]);
  const view = useMemo(
    () =>
      buildRivalryView({
        index,
        clubId: choice.clubId,
        rivalId,
        startDate: choice.startDate,
        startMode: choice.startMode,
        now,
        catalog,
        competitionNames,
        seasonNames,
      }),
    [index, choice, rivalId, now, catalog, competitionNames, seasonNames],
  );
  const own = catalog.get(choice.clubId);
  const rival = catalog.get(rivalId);

  return (
    <div className="grid gap-6">
      {header(view.title, view.neverMet ? null : view.subline)}
      <CoverageNotice copy={view.coverage} included={view.included} />
      {view.neverMet ? (
        <NeverMet club={own?.shortName ?? "tu club"} rival={rival?.shortName ?? rivalId} />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="grid gap-6">
              <RecordPanel record={view.record} />
              <StakesPanel lines={view.stakes} />
            </div>
            <div className="grid gap-6">
              {view.lastMatch === null ? null : (
                <section
                  aria-labelledby="el-ultimo-partido"
                  className="glass grid gap-3 rounded-2xl p-4 lg:rounded-xl"
                >
                  <h2 id="el-ultimo-partido" className="font-display text-3xl">
                    El último partido
                  </h2>
                  <MatchCard match={view.lastMatch} />
                </section>
              )}
              <StreaksPanel streak={view.streak} />
            </div>
          </div>
          <GoleadasPanel
            biggestWin={view.biggestWin}
            biggestLoss={view.biggestLoss}
            noBiggestWin={view.noBiggestWin}
            noBiggestLoss={view.noBiggestLoss}
          />
          <FinalsPanel finals={view.finals} empty={view.noFinals} />
        </>
      )}
    </div>
  );
}
