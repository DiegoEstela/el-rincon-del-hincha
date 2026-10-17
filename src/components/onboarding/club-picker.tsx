"use client";

import { Check, Search } from "lucide-react";
import { useId, useMemo, useState, type RefObject } from "react";
import { Crest } from "@/components/crest";
import type { ClubOption } from "@/lib/club-options";
import { searchClubs } from "@/lib/club-search";

type ClubPickerProps = {
  clubs: readonly ClubOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Lets the container focus the search box ("Cambiar club o fecha"). */
  searchRef: RefObject<HTMLInputElement | null>;
  /** Lets the container focus the group when no club was picked. */
  groupRef: RefObject<HTMLDivElement | null>;
};

function countLabel(n: number): string {
  if (n === 0) return "Ningún club";
  return n === 1 ? "1 club" : `${n} clubes`;
}

export function ClubPicker({ clubs, selectedId, onSelect, searchRef, groupRef }: ClubPickerProps) {
  const [query, setQuery] = useState("");
  const legendId = useId();
  const visible = useMemo(() => searchClubs(clubs, query), [clubs, query]);
  const selected = clubs.find((club) => club.id === selectedId);

  return (
    <div className="min-w-0">
      <p className="text-muted text-sm">Paso 1 de 2</p>
      <fieldset>
        <legend id={legendId} className="font-display text-3xl">
          Elegí tu club
        </legend>

        <label htmlFor="club-search" className="text-muted mt-4 block text-sm">
          Buscá tu club
        </label>
        <div className="relative mt-1">
          <Search
            aria-hidden
            size={18}
            className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            ref={searchRef}
            id="club-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej.: Racing, Lanús, Newell's"
            className="border-line-strong bg-raised text-foreground placeholder:text-muted focus-visible:outline-accent min-h-11 w-full rounded-xl border py-2 pr-3 pl-10 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>

        <p role="status" className="text-muted mt-2 text-sm">
          {countLabel(visible.length)}
        </p>
        {selected ? (
          <p className="text-accent mt-1 text-sm">Elegiste a {selected.shortName}</p>
        ) : null}

        {visible.length === 0 ? (
          <div className="glass mt-4 rounded-2xl p-6 text-center">
            <p className="font-display text-2xl">No encontramos ese club</p>
            <p className="text-muted mt-1">
              Probá con otro nombre. Por ahora están los clubes de la Primera División.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="border-line-strong hover:bg-accent/12 focus-visible:outline-accent mt-4 min-h-11 rounded-xl border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Ver todos los clubes
            </button>
          </div>
        ) : (
          <div
            ref={groupRef}
            role="radiogroup"
            aria-labelledby={legendId}
            tabIndex={-1}
            className="mt-4 grid grid-cols-3 gap-2 outline-none sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {visible.map((club) => {
              const checked = club.id === selectedId;
              return (
                <label
                  key={club.id}
                  className="border-glass-border bg-raised has-[:checked]:border-accent has-[:checked]:bg-accent/12 has-[:focus-visible]:outline-accent relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 motion-safe:transition-colors"
                >
                  <input
                    type="radio"
                    name="club"
                    value={club.id}
                    checked={checked}
                    aria-label={
                      club.name === club.shortName ? undefined : `${club.shortName}, ${club.name}`
                    }
                    onChange={() => onSelect(club.id)}
                    className="sr-only"
                  />
                  <Crest spec={club.crest} className="h-14 w-12" />
                  <span className="leading-tight">{club.shortName}</span>
                  {checked ? (
                    <Check
                      aria-hidden
                      size={16}
                      className="bg-accent text-accent-contrast absolute top-1.5 right-1.5 rounded-full p-0.5"
                    />
                  ) : null}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}
