import { BEFORE_PERIOD, DISPUTED, NOT_COUNTED } from "@/lib/vitrina-copy";
import type { TrophyView } from "@/lib/vitrina-view";
import { TrophyButton } from "./shelf";

/** Titles from before the fan arrived: closed, muted and never counted. Hidden when there are none. */
export function BeforePeriod({
  trophies,
  onOpen,
}: {
  trophies: readonly TrophyView[];
  onOpen: (id: string) => void;
}) {
  if (trophies.length === 0) return null;
  return (
    <details className="glass rounded-2xl p-4 lg:rounded-xl">
      <summary className="font-display focus-visible:outline-accent min-h-11 cursor-pointer text-2xl focus-visible:outline-2">
        {BEFORE_PERIOD.title(trophies.length)}
      </summary>
      <p className="text-muted mt-2 text-sm">{BEFORE_PERIOD.text}</p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {trophies.map((trophy) => (
          <li key={trophy.id}>
            <TrophyButton trophy={trophy} onOpen={onOpen} muted />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Titles of competitions the AFA does not recognize: shown with their criterion, never counted. */
export function Disputed({
  trophies,
  onOpen,
}: {
  trophies: readonly TrophyView[];
  onOpen: (id: string) => void;
}) {
  if (trophies.length === 0) return null;
  return (
    <section aria-labelledby="titulos-discutidos" className="glass grid gap-2 rounded-2xl p-4">
      <h2 id="titulos-discutidos" className="font-display text-2xl">
        {DISPUTED.title}
      </h2>
      <p className="text-muted text-sm">{DISPUTED.text}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {trophies.map((trophy) => (
          <li key={trophy.id}>
            <TrophyButton trophy={trophy} onOpen={onOpen} muted tag={NOT_COUNTED} />
          </li>
        ))}
      </ul>
    </section>
  );
}
