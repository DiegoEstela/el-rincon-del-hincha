"use client";

import { useEffect, useState } from "react";
import type { ClubData } from "@/domain/club-data";
import { loadClubData } from "@/lib/club-data-client";

export type ClubDocuments =
  { status: "idle" | "loading" | "error" } | { status: "ready"; docs: readonly ClubData[] };

type Result = { key: string } & (
  { status: "error" } | { status: "ready"; docs: readonly ClubData[] }
);

/**
 * Loads the documents of one or more clubs (only their public ids are requested). A result belongs
 * to the ids it was loaded for: it is dropped when the ids change, so an old answer (an error, say)
 * never shows for another club. It is deliberately NOT dropped when the effect is cleaned up,
 * because React `<Activity>` runs the cleanup when it hides a route and the state must survive
 * until the fan comes back. `retry` loads again; the loader forgets failed requests, so only the
 * failed documents are requested again.
 */
export function useClubDocuments(
  ids: readonly string[] | null,
  loadData: (clubId: string) => Promise<ClubData> = loadClubData,
): ClubDocuments & { retry: () => void } {
  const key = ids === null ? null : ids.join("|");
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    // Other ids: the old result is dropped while rendering, so it never shows for another club.
    setSeenKey(key);
    setResult(null);
  }

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    Promise.all(key.split("|").map((id) => loadData(id))).then(
      (docs) =>
        !cancelled &&
        setResult((prev) =>
          prev?.key === key && prev.status === "ready" ? prev : { key, status: "ready", docs },
        ),
      () => !cancelled && setResult({ key, status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, attempt, loadData]);

  const retry = () => {
    setResult(null);
    setAttempt((n) => n + 1);
  };
  if (key === null) return { status: "idle", retry };
  if (result === null || result.key !== key) return { status: "loading", retry };
  return { ...result, retry };
}
