"use client";

import { useEffect, useMemo, useState } from "react";
import { Crest } from "@/components/crest";
import { CoverageNotice } from "@/components/coverage/coverage-notice";
import { useFanChoice } from "@/components/fan/use-fan-choice";
import { statsDataFromClubData, type ClubData } from "@/domain/club-data";
import { buildStatsIndex } from "@/domain/data";
import type { FanChoice } from "@/lib/fan-storage";
import { loadClubData } from "@/lib/club-data-client";
import type { ClubOption } from "@/lib/club-options";
import type { SortKey, TypeFilter } from "@/lib/engine-input";
import { matchesLine } from "@/lib/rivals-format";
import { buildRivalsView } from "@/lib/rivals-view";
import { HumorSections } from "./humor-sections";
import { RivalCardList } from "./rival-card-list";
import { RivalsFilters, type FiltersState } from "./rivals-filters";
import { RivalsSummary } from "./rivals-summary";
import { RivalsTable } from "./rivals-table";
import { RivalsEmpty, RivalsError, RivalsNoMatches, RivalsSkeleton } from "./rivals-states";

type Load =
  { clubId: string; status: "ready"; data: ClubData } | { clubId: string; status: "error" };
type RawFilters = { fromYear?: number; toYear?: number; type?: TypeFilter; sort: SortKey };

/**
 * "[Mi club] vs. Todos". The club and start date come from this device; the browser fetches the
 * document of the club (only its id is requested) and computes everything here (ADR 0018).
 * Before hydration CSS decides between the skeleton and the empty state (`html[data-club]`).
 */
export function RivalsScreen({
  clubs,
  loadData = loadClubData,
}: {
  clubs: readonly ClubOption[];
  loadData?: (clubId: string) => Promise<ClubData>;
}) {
  const clubIds = useMemo(() => new Set(clubs.map((club) => club.id)), [clubs]);
  const choice = useFanChoice(clubIds);
  const [load, setLoad] = useState<Load | null>(null);
  const [attempt, setAttempt] = useState(0);
  const clubId = choice === "unknown" || choice === null ? null : choice.clubId;

  useEffect(() => {
    if (clubId === null) return;
    let cancelled = false;
    loadData(clubId).then(
      (data) => !cancelled && setLoad({ clubId, status: "ready", data }),
      () => !cancelled && setLoad({ clubId, status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [clubId, attempt, loadData]);

  if (choice === "unknown") {
    return (
      <div>
        <div className="pending-skeleton">
          <RivalsSkeleton />
        </div>
        <div className="pending-empty">
          <RivalsEmpty />
        </div>
      </div>
    );
  }
  if (choice === null) return <RivalsEmpty />;

  const current = load !== null && load.clubId === choice.clubId ? load : null;
  if (current === null) return <RivalsSkeleton />;
  if (current.status === "error") {
    return (
      <RivalsError
        onRetry={() => {
          setLoad(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <RivalsContent key={choice.clubId} choice={choice} data={current.data} clubs={clubs} />;
}

function RivalsContent({
  choice,
  data,
  clubs,
}: {
  choice: FanChoice;
  data: ClubData;
  clubs: readonly ClubOption[];
}) {
  const [raw, setRaw] = useState<RawFilters>({ sort: "balance" });
  // "Today" is taken once the page is in the browser, never while prerendering.
  const [now] = useState(() => new Date());
  const index = useMemo(() => buildStatsIndex(statsDataFromClubData(data)), [data]);
  const catalog = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);
  const competitionNames = useMemo(
    () => new Map(data.competitions.map((c) => [c.id, c.name])),
    [data],
  );
  const view = useMemo(
    () =>
      buildRivalsView({
        index,
        clubId: choice.clubId,
        startDate: choice.startDate,
        now,
        filter: raw,
        sort: raw.sort,
        catalog,
        competitionNames,
      }),
    [index, choice.clubId, choice.startDate, now, raw, catalog, competitionNames],
  );

  const own = catalog.get(choice.clubId);
  const state: FiltersState = { ...view.filter, sort: raw.sort };
  const reset = () => setRaw((r) => ({ sort: r.sort }));

  return (
    <div className="grid gap-6">
      <header className="flex items-center gap-4">
        {own ? <Crest spec={own.crest} className="size-14 shrink-0" /> : null}
        <div>
          <h1 className="font-display text-4xl leading-none lg:text-6xl">
            {own?.shortName ?? "Tu club"} vs. todos
          </h1>
          {view.noMatches ? null : (
            <p className="text-muted mt-1 text-sm">
              Desde {view.since} · {matchesLine(view.totals.matches, view.totals.rivals)}
            </p>
          )}
        </div>
      </header>

      <CoverageNotice copy={view.coverage} included={view.included} />

      {view.options.years.length > 0 ? (
        <RivalsFilters
          state={state}
          options={view.options}
          count={view.totals.rivals}
          active={view.filtersActive}
          onChange={(next) => setRaw((r) => ({ ...r, ...next }))}
          onReset={reset}
        />
      ) : null}

      {view.noMatches ? (
        <RivalsNoMatches filtersActive={view.filtersActive} onReset={reset} />
      ) : (
        <>
          <RivalsSummary summary={view.summary} />
          <HumorSections sections={view.sections} />
          <section aria-labelledby="todos-los-rivales" className="grid gap-3">
            <h2 id="todos-los-rivales" className="font-display text-3xl">
              Todos los rivales
            </h2>
            <RivalCardList rows={view.rows} />
            <RivalsTable rows={view.rows} sort={raw.sort} competitions={view.competitionsLabel} />
          </section>
        </>
      )}
    </div>
  );
}
