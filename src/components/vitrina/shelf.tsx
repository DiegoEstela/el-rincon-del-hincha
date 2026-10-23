import type { ShelfView, TrophyView } from "@/lib/vitrina-view";
import { TrophyArt } from "./trophy-art";

/** One lit trophy: a button (44 px at least) that opens its detail. */
export function TrophyButton({
  trophy,
  onOpen,
  muted = false,
}: {
  trophy: TrophyView;
  onOpen: (id: string) => void;
  /** Titles from before the fan arrived are shown without the gold. */
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={trophy.buttonLabel}
      onClick={() => onOpen(trophy.id)}
      className="focus-visible:outline-accent hover:bg-glass flex min-h-11 w-full flex-col items-center gap-1 rounded-xl p-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <TrophyArt kind={trophy.kind} lit={!muted} className="size-14" />
      <span className="font-display text-2xl leading-none tabular-nums">{trophy.year}</span>
      <span className="text-muted text-xs">{trophy.seasonName}</span>
      {trophy.shared ? (
        <span className="border-gold/50 text-gold rounded-full border px-2 text-xs">
          Compartido
        </span>
      ) : null}
    </button>
  );
}

/** A shelf: lit trophies in date order, then the silhouettes of what the club is still missing. */
export function Shelf({ shelf, onOpen }: { shelf: ShelfView; onOpen: (id: string) => void }) {
  const headingId = `estante-${shelf.key}`;
  return (
    <section
      aria-labelledby={headingId}
      className="glass border-t-gold/30 grid gap-3 rounded-2xl border-t-2 p-4 lg:rounded-xl"
    >
      <h2 id={headingId} className="font-display text-3xl">
        {shelf.title}
      </h2>
      {shelf.underConstruction === null ? null : (
        <p className="text-muted text-sm">{shelf.underConstruction}</p>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shelf.trophies.map((trophy) => (
          <li key={trophy.id}>
            <TrophyButton trophy={trophy} onOpen={onOpen} />
          </li>
        ))}
        {shelf.silhouettes.map((silhouette) => (
          <li
            key={silhouette.competitionId}
            className="flex flex-col items-center gap-1 p-2 text-center"
          >
            <TrophyArt kind={silhouette.kind} lit={false} className="size-14" />
            <span className="text-sm font-medium">{silhouette.name}</span>
            <span className="text-even text-xs font-medium">Te falta</span>
            <span className="text-muted text-xs">{silhouette.caption}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
