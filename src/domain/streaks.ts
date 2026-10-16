// Methodology: "Streaks". Input must be sorted by date then id (calculateHistory does that).
import type { Outcome } from "./match-outcome";
import type { IsoDate, MatchView } from "./types";

export type Streak = Readonly<{
  outcome: Outcome;
  length: number;
  /** Date of the first and of the last match of the run. */
  from: IsoDate;
  to: IsoDate;
}>;

export type Streaks = Readonly<{
  /** The run of identical outcomes that ends at the latest match. */
  current: Streak | null;
  /** The longest run of wins; on a tie in length the earliest run is kept. */
  bestWin: Streak | null;
}>;

export function computeStreaks(views: readonly MatchView[]): Streaks {
  const runs: Streak[] = [];
  for (const view of views) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last.outcome === view.outcome) {
      runs[runs.length - 1] = { ...last, length: last.length + 1, to: view.match.date };
    } else {
      runs.push({
        outcome: view.outcome,
        length: 1,
        from: view.match.date,
        to: view.match.date,
      });
    }
  }
  const bestWin = runs
    .filter((run) => run.outcome === "W")
    .reduce<Streak | null>(
      (best, run) => (best === null || run.length > best.length ? run : best),
      null,
    );
  return { current: runs[runs.length - 1] ?? null, bestWin };
}
