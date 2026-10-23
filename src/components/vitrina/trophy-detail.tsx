"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { MatchCard } from "@/components/rivalry/match-card";
import { nextFocusIndex } from "@/lib/focus-trap";
import type { TrophyView } from "@/lib/vitrina-view";

/**
 * The detail of one trophy, in a native modal <dialog> like the info menu (bottom sheet on phones,
 * side panel from 1024px). The URL does not change. Escape and "Cerrar" close it; focus goes to
 * the heading on open and back to the trophy on close.
 */
export function TrophyDetail({
  trophy,
  onClose,
}: {
  trophy: TrophyView | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (trophy !== null && !dialog.hasAttribute("open")) {
      openerRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      headingRef.current?.focus();
    }
    if (trophy === null && dialog.hasAttribute("open")) dialog.close();
  }, [trophy]);

  function trapTab(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    );
    const index = nextFocusIndex(
      focusables.indexOf(document.activeElement as HTMLElement),
      focusables.length,
      event.shiftKey,
    );
    if (index < 0) return;
    event.preventDefault();
    focusables[index].focus();
  }

  const detail = trophy?.detail;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="detalle-trofeo"
      aria-modal="true"
      onKeyDown={trapTab}
      onClose={() => {
        openerRef.current?.focus();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="info-sheet bg-raised border-line-strong text-foreground fixed inset-x-3 top-auto bottom-3 m-0 mx-auto max-h-[85vh] w-auto max-w-md overflow-y-auto rounded-2xl border p-4 lg:inset-y-3 lg:right-3 lg:left-auto lg:mx-0 lg:max-h-none lg:w-96"
    >
      {trophy === null || detail === undefined ? null : (
        <div className="grid gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2
                id="detalle-trofeo"
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-3xl outline-none"
              >
                {trophy.seasonName}
              </h2>
              <p className="text-muted text-sm">{trophy.competitionName}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dialogRef.current?.close()}
              className="text-muted hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
            >
              <X aria-hidden size={20} />
            </button>
          </div>
          <p className="text-lg">Campeón el {detail.awardedOn}</p>
          <section aria-label={detail.matchHeading} className="grid gap-2">
            <h3 className="font-display text-2xl">{detail.matchHeading}</h3>
            {detail.match === null ? (
              <p className="text-muted text-sm">{detail.noMatchLine}</p>
            ) : (
              <MatchCard match={detail.match} />
            )}
          </section>
          {detail.sharedWith === null ? null : <p>{detail.sharedWith}</p>}
          <p className="text-muted text-sm">
            {detail.sourceHost === null ? (
              <>Fuente: {detail.sourceUrl}</>
            ) : (
              <>
                Fuente:{" "}
                <a
                  href={detail.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent underline"
                >
                  {detail.sourceHost}
                </a>
              </>
            )}
          </p>
          <p className="text-muted text-xs">{detail.criterion}</p>
        </div>
      )}
    </dialog>
  );
}
