import { Crest } from "@/components/crest";
import { formatBalance } from "@/lib/rivals-format";
import type { RivalRowView } from "@/lib/rivals-view";
import { DominanceChip } from "./dominance-chip";
import { RecordBar } from "./record-bar";

const STATS = [
  ["PJ", "played"],
  ["PG", "won"],
  ["PE", "drawn"],
  ["PP", "lost"],
] as const;

/** The list of rivals on a phone: one card each. Hidden from the desktop breakpoint up. */
export function RivalCardList({ rows }: { rows: readonly RivalRowView[] }) {
  return (
    <ul aria-label="Rivales" className="grid gap-2 lg:hidden">
      {rows.map((row) => (
        <li key={row.rivalId} className="glass rounded-2xl p-3">
          <div className="flex items-center gap-3">
            {row.crest ? <Crest spec={row.crest} className="size-9 shrink-0" /> : null}
            <span className="flex-1 truncate text-base font-medium">{row.shortName}</span>
            <DominanceChip dominance={row.dominance} />
          </div>
          <dl className="mt-3 grid grid-cols-5 gap-1 text-center">
            {STATS.map(([label, key]) => (
              <div key={label}>
                <dt className="text-muted text-xs">{label}</dt>
                <dd className="text-lg font-medium tabular-nums">{row[key]}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted text-xs">Saldo</dt>
              <dd className="text-lg font-medium tabular-nums">{formatBalance(row.balance)}</dd>
            </div>
          </dl>
          <div className="mt-2">
            <RecordBar bar={row.bar} />
          </div>
          {row.administrative > 0 || row.shootouts > 0 ? (
            <p className="text-muted mt-2 text-xs">
              {row.administrative > 0 ? "Incluye resultados administrativos" : null}
              {row.administrative > 0 && row.shootouts > 0 ? " · " : null}
              {row.shootouts > 0 ? `${row.shootouts} por penales` : null}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
