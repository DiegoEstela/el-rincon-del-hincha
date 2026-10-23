import type { VitrinaView } from "@/lib/vitrina-view";

/** The two numbers of the vitrina. They always carry the caption: they count what is loaded. */
export function Counters({ counters }: { counters: VitrinaView["counters"] }) {
  const card = "glass grid gap-1 rounded-2xl p-4 text-center lg:rounded-xl lg:text-left";
  return (
    <section aria-label="Tus trofeos" className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className={card}>
          <p className="font-display text-gold text-5xl leading-none tabular-nums">
            {counters.won}
          </p>
          <p className="text-sm">{counters.wonLabel}</p>
        </div>
        <div className={card}>
          <p className="font-display text-5xl leading-none tabular-nums">{counters.missing}</p>
          <p className="text-sm">{counters.missingLabel}</p>
        </div>
      </div>
      <p className="text-muted text-xs">{counters.caption}</p>
    </section>
  );
}
