import type { RivalryView } from "@/lib/rivalry-view";

/** "Rachas": the current run (if there is any match) and the best run of wins. */
export function StreaksPanel({ streak }: { streak: RivalryView["streak"] }) {
  return (
    <section aria-labelledby="rachas" className="glass grid gap-2 rounded-2xl p-4 lg:rounded-xl">
      <h2 id="rachas" className="font-display text-3xl">
        Rachas
      </h2>
      {streak.headline === null ? null : <p className="text-lg font-medium">{streak.headline}</p>}
      <p className="text-muted text-sm">{streak.best}</p>
    </section>
  );
}
