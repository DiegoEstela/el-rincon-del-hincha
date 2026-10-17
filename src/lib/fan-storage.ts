// The one place that touches the saved fan choice (ADR 0013, decision 5). Never throws: reading
// the storage object, getItem, setItem and removeItem are all wrapped. When a write fails the
// choice stays in memory for the session and the app goes on.
//
// PRIVACY: `startDate` can be a birth date. It is stored only here, never logged, never put in a
// URL, a cookie, a request or an analytics event, and never echoed in an error.
import { validateStartDate } from "@/domain/start-date";

export const FAN_STORAGE_KEY = "rincon-del-hincha:fan";

export type StartMode = "birth" | "other";
export type FanChoice = { v: 1; clubId: string; startDate: string; startMode: StartMode };
export type ParseOptions = { clubIds: ReadonlySet<string>; now: () => Date };

let memory: string | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** `window.localStorage`, or `null` when the browser blocks it (the getter itself can throw). */
export function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The raw saved record: the in-memory copy if a write failed, else the stored string. */
export function readFanChoiceRaw(storage: Storage | null): string | null {
  if (memory !== undefined) return memory;
  try {
    return storage ? storage.getItem(FAN_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

/** Parses a raw record. Anything unexpected (shape, version, unknown club, bad date) is `null`. */
export function parseFanChoice(raw: string | null, options: ParseOptions): FanChoice | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { clubId, startDate, startMode } = record;
  if (record.v !== 1) return null;
  if (typeof clubId !== "string" || !options.clubIds.has(clubId)) return null;
  if (startMode !== "birth" && startMode !== "other") return null;
  if (typeof startDate !== "string") return null;
  const checked = validateStartDate(startDate, options.now());
  if (!checked.ok || checked.date !== startDate) return null;
  return { v: 1, clubId, startDate, startMode };
}

export function readFanChoice(storage: Storage | null, options: ParseOptions): FanChoice | null {
  return parseFanChoice(readFanChoiceRaw(storage), options);
}

/** Saves the choice. Returns `false` when the browser refused (the choice stays in memory). */
export function writeFanChoice(storage: Storage | null, choice: FanChoice): boolean {
  const raw = JSON.stringify({
    v: 1,
    clubId: choice.clubId,
    startDate: choice.startDate,
    startMode: choice.startMode,
  });
  let saved = false;
  try {
    if (storage) {
      storage.setItem(FAN_STORAGE_KEY, raw);
      saved = true;
    }
  } catch {
    saved = false;
  }
  memory = saved ? undefined : raw;
  notify();
  return saved;
}

export function clearFanChoice(storage: Storage | null): void {
  memory = undefined;
  try {
    storage?.removeItem(FAN_STORAGE_KEY);
  } catch {
    // Nothing to do: the choice is already forgotten for this session.
  }
  notify();
}

/** Subscribes to changes made in this tab (the `storage` event only fires in other tabs). */
export function subscribeFanChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
