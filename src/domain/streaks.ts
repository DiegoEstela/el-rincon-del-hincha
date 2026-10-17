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

/** A run of matches by a rule other than identical results (unbeaten, winless). */
export type Run = Readonly<{ length: number; from: IsoDate; to: IsoDate }>;

export type Streaks = Readonly<{
  /** The run of identical outcomes that ends at the latest match. */
  current: Streak | null;
  /** The longest run of wins; on a tie in length the earliest run is kept. */
  bestWin: Streak | null;
  /** The trailing matches without a loss; null when the latest match is a loss. */
  currentUnbeaten: Run | null;
  /** The trailing matches without a win; null when the latest match is a win. */
  currentWinless: Run | null;
}>;

/** The run of matches at the end of `views` whose outcome is not `breaker`, or null. */
function trailingRun(views: readonly MatchView[], breaker: Outcome): Run | null {
  let start = views.length;
  while (start > 0 && views[start - 1].outcome !== breaker) start -= 1;
  if (start === views.length) return null;
  return {
    length: views.length - start,
    from: views[start].match.date,
    to: views[views.length - 1].match.date,
  };
}

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
  return {
    current: runs[runs.length - 1] ?? null,
    bestWin,
    currentUnbeaten: trailingRun(views, "L"),
    currentWinless: trailingRun(views, "W"),
  };
}
