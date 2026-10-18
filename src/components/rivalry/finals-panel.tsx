import { BEFORE_PERIOD, FINALS_SCOPE } from "@/lib/rivalry-copy";
import type { FinalView } from "@/lib/rivalry-view";
import { MatchCard } from "./match-card";

/** "Finales entre ustedes": one item per series, or the empty line. */
export function FinalsPanel({ finals, empty }: { finals: readonly FinalView[]; empty: string }) {
  return (
    <section aria-labelledby="finales" className="glass grid gap-3 rounded-2xl p-4 lg:rounded-xl">
      <h2 id="finales" className="font-display text-3xl">
        Finales entre ustedes
      </h2>
      {finals.length === 0 ? (
        <p className="text-muted text-sm">{empty}</p>
      ) : (
        <ul className="grid gap-4">
          {finals.map((series, i) => (
            <li key={`${series.season}-${i}`} className="grid gap-2">
              <p className="font-medium">{series.season}</p>
              <p className="text-lg">{series.winner}</p>
              <ul className="grid gap-3">
                {series.legs.map((leg, j) => (
                  <li key={j} className="grid gap-1">
                    <MatchCard match={leg} />
                    {leg.beforePeriod ? (
                      <p className="text-muted text-xs">{BEFORE_PERIOD}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted text-xs">{FINALS_SCOPE}</p>
    </section>
  );
}
