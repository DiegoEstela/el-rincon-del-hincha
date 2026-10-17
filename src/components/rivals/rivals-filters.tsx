"use client";

import { useId } from "react";
import type { Competition } from "@/data-model/types";
import type { SortKey, TypeFilter } from "@/lib/engine-input";
import { pluralRivals } from "@/lib/rivals-format";

export type FiltersState = Readonly<{
  fromYear: number;
  toYear: number;
  type: TypeFilter;
  sort: SortKey;
}>;

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "Todos",
  league: "Liga",
  national_cup: "Copas nacionales",
  international: "Internacionales",
  other: "Otros",
};

const SORT_LABELS: [SortKey, string][] = [
  ["balance", "Saldo"],
  ["played", "Partidos"],
  ["name", "Nombre"],
];

const control =
  "border-line-strong bg-raised text-foreground min-h-11 rounded-xl border px-3 text-base";

/** Year range, tournament type and sort. Controlled: the screen owns the state. */
export function RivalsFilters({
  state,
  options,
  count,
  active,
  onChange,
  onReset,
}: {
  state: FiltersState;
  options: Readonly<{ years: readonly number[]; types: readonly Competition["type"][] }>;
  count: number;
  active: boolean;
  onChange: (next: Partial<FiltersState>) => void;
  onReset: () => void;
}) {
  const id = useId();
  const types: TypeFilter[] = ["all", ...options.types];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Desde</span>
          <select
            className={control}
            value={state.fromYear}
            onChange={(e) => {
              const fromYear = Number(e.target.value);
              onChange({ fromYear, toYear: Math.max(state.toYear, fromYear) });
            }}
          >
            {options.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Hasta</span>
          <select
            className={control}
            value={state.toYear}
            onChange={(e) => {
              const toYear = Number(e.target.value);
              onChange({ toYear, fromYear: Math.min(state.fromYear, toYear) });
            }}
          >
            {options.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Ordenar por</span>
          <select
            className={control}
            value={state.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
          >
            {SORT_LABELS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="radiogroup" aria-labelledby={`${id}-type`} className="grid gap-1 text-sm">
        <span id={`${id}-type`} className="text-muted">
          Torneo
        </span>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <label
              key={type}
              className="border-line-strong has-[:checked]:bg-accent has-[:checked]:text-accent-contrast has-[:focus-visible]:outline-accent flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-base has-[:focus-visible]:outline-2"
            >
              <input
                type="radio"
                name={`${id}-type`}
                className="sr-only"
                checked={state.type === type}
                onChange={() => onChange({ type })}
              />
              {TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {active ? (
          <button
            type="button"
            onClick={onReset}
            className="border-line-strong min-h-11 rounded-xl border px-4 text-base"
          >
            Limpiar filtros
          </button>
        ) : null}
        <p role="status" className="sr-only">
          Mostrando {pluralRivals(count)}
        </p>
      </div>
    </div>
  );
}
