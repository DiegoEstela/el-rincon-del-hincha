"use client";

import { useId, useState, useSyncExternalStore, type RefObject } from "react";
import { todayInBuenosAires } from "@/data-model/dates";
import { START_DATE_MIN, validateStartDate, type StartDateError } from "@/domain/start-date";
import type { StartMode } from "@/lib/fan-storage";
import { START_DATE_MESSAGES } from "./copy";

type StartDateStepProps = {
  mode: StartMode;
  onModeChange: (mode: StartMode) => void;
  value: string;
  onValueChange: (value: string) => void;
  /** The error found when the fan pressed "Ver mi historia". */
  submitError: StartDateError | null;
  inputRef: RefObject<HTMLInputElement | null>;
};

const subscribeNever = () => () => {};
const currentDay = () => todayInBuenosAires(new Date());
const serverDay = (): string | undefined => undefined;

const MODES: { mode: StartMode; label: string; hint: string }[] = [
  {
    mode: "birth",
    label: "Desde que nací",
    hint: "Contamos tu historia desde el día que naciste.",
  },
  {
    mode: "other",
    label: "Desde otra fecha",
    hint: "El día que te hiciste hincha, tu primera vez en la cancha o la fecha que quieras.",
  },
];

/**
 * Step 2. The date lives in React state only: the input has no `name`, so it can never end up in a
 * form post or a URL (PRIVACY: it can be a birth date).
 */
export function StartDateStep({
  mode,
  onModeChange,
  value,
  onValueChange,
  submitError,
  inputRef,
}: StartDateStepProps) {
  const errorId = useId();
  const [blurError, setBlurError] = useState<StartDateError | null>(null);
  // `new Date()` only on the client snapshot: Cache Components rejects it while prerendering.
  const max = useSyncExternalStore(subscribeNever, currentDay, serverDay);

  const error = blurError ?? submitError;

  return (
    <div className="min-w-0">
      <p className="text-muted text-sm">Paso 2 de 2</p>
      <fieldset>
        <legend className="font-display text-3xl">¿Desde cuándo sos hincha?</legend>

        <div className="mt-4 grid gap-2">
          {MODES.map((option) => (
            <label
              key={option.mode}
              className="border-glass-border bg-raised has-[:checked]:border-accent has-[:checked]:bg-accent/12 has-[:focus-visible]:outline-accent flex min-h-11 cursor-pointer flex-col justify-center rounded-2xl border px-4 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 motion-safe:transition-colors"
            >
              <input
                type="radio"
                name="start-mode"
                value={option.mode}
                checked={mode === option.mode}
                onChange={() => onModeChange(option.mode)}
                className="sr-only"
              />
              <span>{option.label}</span>
              <span className="text-muted text-sm">{option.hint}</span>
            </label>
          ))}
        </div>

        <label htmlFor="start-date" className="text-muted mt-4 block text-sm">
          {mode === "birth" ? "Tu fecha de nacimiento" : "¿Desde qué fecha?"}
        </label>
        <input
          ref={inputRef}
          id="start-date"
          type="date"
          min={START_DATE_MIN}
          max={max}
          value={value}
          onChange={(event) => {
            setBlurError(null);
            onValueChange(event.target.value);
          }}
          onBlur={() => {
            const result = validateStartDate(value, new Date());
            setBlurError(!result.ok && result.error !== "empty" ? result.error : null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="border-line-strong bg-raised text-foreground focus-visible:outline-accent mt-1 min-h-11 w-full rounded-xl border px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {error ? (
          <p id={errorId} className="text-loss mt-2 text-sm">
            {START_DATE_MESSAGES[error]}
          </p>
        ) : null}
        <p className="text-muted mt-3 text-sm">
          Tu fecha se guarda solo en este dispositivo. No viaja en ningún link ni se comparte.
        </p>
      </fieldset>
    </div>
  );
}
