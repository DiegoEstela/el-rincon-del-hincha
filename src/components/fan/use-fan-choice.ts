"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getBrowserStorage,
  parseFanChoice,
  readFanChoiceRaw,
  subscribeFanChoice,
  type FanChoice,
} from "@/lib/fan-storage";

/** What the server (and the hydration pass) sees, so both render the same pending markup. */
const ON_SERVER = "\u0000server";

const readRaw = () => readFanChoiceRaw(getBrowserStorage());
const readRawOnServer = (): string => ON_SERVER;

/**
 * The club and start date saved on this device (ADR 0013).
 * - `"unknown"`: on the server and while hydrating. The caller shows the pending markup.
 * - `null`: nothing valid is saved (or the browser blocks storage).
 * - a `FanChoice`: parsed and validated against the known clubs.
 * PRIVACY: the start date never leaves this hook's caller; it is never logged or sent.
 */
export function useFanChoice(clubIds: ReadonlySet<string>): FanChoice | null | "unknown" {
  const raw = useSyncExternalStore(subscribeFanChoice, readRaw, readRawOnServer);
  return useMemo(
    () => (raw === ON_SERVER ? "unknown" : parseFanChoice(raw, { clubIds, now: () => new Date() })),
    [raw, clubIds],
  );
}
