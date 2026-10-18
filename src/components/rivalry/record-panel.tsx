import { DominanceChip } from "@/components/rivals/dominance-chip";
import { RecordBar } from "@/components/rivals/record-bar";
import type { RivalryView } from "@/lib/rivalry-view";

const STATS = [
  ["PJ", "Partidos jugados", "played"],
  ["PG", "Partidos ganados", "won"],
  ["PE", "Partidos empatados", "drawn"],
  ["PP", "Partidos perdidos", "lost"],
] as const;

/** "El historial": the four numbers, the balance, who dominates, the bar and the goals. */
export function RecordPanel({ record }: { record: RivalryView["record"] }) {
  return (
    <section
      aria-labelledby="el-historial"
      className="glass grid gap-4 rounded-2xl p-4 lg:rounded-xl"
    >
      <h2 id="el-historial" className="font-display text-3xl">
        El historial
      </h2>
      <dl className="grid grid-cols-5 gap-1 text-center">
        {STATS.map(([short, long, key]) => (
          <div key={short}>
            <dt className="text-muted text-xs">
              <abbr title={long} aria-label={long}>
                {short}
              </abbr>
            </dt>
            <dd className="font-display text-4xl tabular-nums">{record[key]}</dd>
          </div>
        ))}
        <div>
          <dt className="text-muted text-xs">Saldo</dt>
          <dd className="font-display text-4xl tabular-nums">{record.balance}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <DominanceChip dominance={record.dominance} />
        <p className="text-muted text-sm">
          Goles: {record.goalsFor} a {record.goalsAgainst}
        </p>
      </div>
      <RecordBar bar={record.bar} />
      {record.administrative > 0 || record.shootouts > 0 ? (
        <p className="text-muted text-xs">
          {record.administrative > 0 ? "Incluye resultados administrativos" : null}
          {record.administrative > 0 && record.shootouts > 0 ? " · " : null}
          {record.shootouts > 0 ? `${record.shootouts} por penales` : null}
        </p>
      ) : null}
    </section>
  );
}
