"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Crest } from "@/components/crest";
import { validateStartDate, type StartDateError } from "@/domain/start-date";
import type { ClubOption } from "@/lib/club-options";
import { applyClubTheme } from "@/lib/club-theme-dom";
import {
  getBrowserStorage,
  parseFanChoice,
  readFanChoiceRaw,
  subscribeFanChoice,
  writeFanChoice,
  type StartMode,
} from "@/lib/fan-storage";
import { ClubPicker } from "./club-picker";
import { NO_CLUB_MESSAGE } from "./copy";
import { StartDateStep } from "./start-date-step";

const readRaw = () => readFanChoiceRaw(getBrowserStorage());
const readRawOnServer = (): string | null => null;

/**
 * The first screen after the hero: pick the club, say since when, go to the history.
 * PRIVACY: the start date lives in state until it is saved on this device. It is never put in a
 * URL, a log or an analytics event, and `router.push` gets a bare path.
 */
export function Onboarding({ clubs }: { clubs: readonly ClubOption[] }) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

  const [clubId, setClubId] = useState<string | null>(null);
  const [mode, setMode] = useState<StartMode>("birth");
  const [date, setDate] = useState("");
  const [clubError, setClubError] = useState(false);
  const [dateError, setDateError] = useState<StartDateError | null>(null);

  // Server snapshot is `null`, so hydration matches; a returning visitor shows right after it.
  const raw = useSyncExternalStore(subscribeFanChoice, readRaw, readRawOnServer);
  const savedChoice = useMemo(
    () =>
      parseFanChoice(raw, {
        clubIds: new Set(clubs.map((club) => club.id)),
        now: () => new Date(),
      }),
    [raw, clubs],
  );
  const savedClubId = savedChoice?.clubId ?? null;
  const savedClub = clubs.find((club) => club.id === savedClubId);

  // Live preview of the accent; leaving without saving goes back to the saved club (or lime).
  useEffect(() => {
    applyClubTheme(document.documentElement, clubId ?? savedClubId);
    return () => applyClubTheme(document.documentElement, savedClubId);
  }, [clubId, savedClubId]);

  function changeChoice() {
    if (savedChoice) {
      setClubId(savedChoice.clubId);
      setMode(savedChoice.startMode);
      setDate(savedChoice.startDate);
    }
    searchRef.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clubId) {
      setClubError(true);
      (groupRef.current ?? searchRef.current)?.focus();
      return;
    }
    const result = validateStartDate(date, new Date());
    if (!result.ok) {
      setDateError(result.error);
      dateRef.current?.focus();
      return;
    }
    // A refused write is not an error for the fan: the choice stays in memory and we go on.
    writeFanChoice(getBrowserStorage(), {
      v: 1,
      clubId,
      startDate: result.date,
      startMode: mode,
    });
    router.push("/vitrina");
  }

  return (
    <div id="elegi-tu-club" className="scroll-mt-6">
      <div className="returning-slot">
        {savedClub ? (
          <section className="glass rise mb-6 flex flex-wrap items-center gap-4 rounded-3xl p-5">
            <Crest spec={savedClub.crest} className="h-16 w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-3xl">¡Volviste!</h2>
              <p className="text-muted">Sos de {savedClub.name}. Tu historia te está esperando.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/vitrina"
                className="bg-accent text-accent-contrast focus-visible:outline-accent inline-flex min-h-11 items-center rounded-xl px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Ver mi historia
              </Link>
              <button
                type="button"
                onClick={changeChoice}
                className="border-line-strong focus-visible:outline-accent min-h-11 rounded-xl border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Cambiar club o fecha
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="grid gap-8 lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-10"
      >
        <ClubPicker
          clubs={clubs}
          selectedId={clubId}
          onSelect={(id) => {
            setClubId(id);
            setClubError(false);
          }}
          searchRef={searchRef}
          groupRef={groupRef}
        />
        <div className="grid gap-4 lg:sticky lg:top-6">
          <StartDateStep
            mode={mode}
            onModeChange={setMode}
            value={date}
            onValueChange={(value) => {
              setDate(value);
              setDateError(null);
            }}
            submitError={dateError}
            inputRef={dateRef}
          />
          {clubError ? (
            <p role="alert" className="text-loss text-sm">
              {NO_CLUB_MESSAGE}
            </p>
          ) : null}
          <button
            type="submit"
            className="bg-accent text-accent-contrast focus-visible:outline-accent min-h-12 rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Ver mi historia
          </button>
        </div>
      </form>
    </div>
  );
}
