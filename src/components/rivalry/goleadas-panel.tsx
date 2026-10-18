import type { MatchCardView } from "@/lib/rivalry-view";
import { MatchCard } from "./match-card";

function Slot({
  id,
  title,
  match,
  empty,
}: {
  id: string;
  title: string;
  match: MatchCardView | null;
  empty: string;
}) {
  return (
    <div
      className="glass grid gap-2 rounded-2xl p-4 lg:rounded-xl"
      aria-labelledby={id}
      role="group"
    >
      <h3 id={id} className="font-display text-2xl">
        {title}
      </h3>
      {match === null ? <p className="text-muted text-sm">{empty}</p> : <MatchCard match={match} />}
    </div>
  );
}

/** "Goleadas": the biggest win and the biggest loss, each with its empty line. */
export function GoleadasPanel({
  biggestWin,
  biggestLoss,
  noBiggestWin,
  noBiggestLoss,
}: {
  biggestWin: MatchCardView | null;
  biggestLoss: MatchCardView | null;
  noBiggestWin: string;
  noBiggestLoss: string;
}) {
  return (
    <section aria-labelledby="goleadas" className="grid gap-3">
      <h2 id="goleadas" className="font-display text-3xl">
        Goleadas
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <Slot id="la-mejor" title="La mejor" match={biggestWin} empty={noBiggestWin} />
        <Slot
          id="la-que-mas-dolio"
          title="La que más dolió"
          match={biggestLoss}
          empty={noBiggestLoss}
        />
      </div>
    </section>
  );
}
