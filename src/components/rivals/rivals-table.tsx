import { Crest } from "@/components/crest";
import type { SortKey } from "@/lib/engine-input";
import { formatBalance } from "@/lib/rivals-format";
import type { RivalRowView } from "@/lib/rivals-view";
import { DominanceChip } from "./dominance-chip";
import { RecordBar } from "./record-bar";
import { RivalLink } from "./rival-link";

/** Only the sorted column says so: "none" is the default and adds noise for a screen reader. */
type Sorted = "ascending" | "descending" | undefined;

const NUMBERS = [
  ["PJ", "Partidos jugados", "played"],
  ["PG", "Partidos ganados", "won"],
  ["PE", "Partidos empatados", "drawn"],
  ["PP", "Partidos perdidos", "lost"],
] as const;

/** The list of rivals on desktop: a real table. Hidden below the desktop breakpoint. */
export function RivalsTable({
  rows,
  sort,
  competitions,
}: {
  rows: readonly RivalRowView[];
  sort: SortKey;
  /** The competitions the numbers include, as a plain list. */
  competitions: string;
}) {
  const sorted = (key: SortKey): Sorted =>
    sort === key ? (key === "name" ? "ascending" : "descending") : undefined;
  const head = "text-muted px-3 py-3 text-left text-xs font-medium";
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="glass w-full rounded-xl text-sm">
        <caption className="text-muted p-3 text-left text-sm">
          Tu historial contra cada rival ({competitions})
        </caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={sorted("name")} className={head}>
              Rival
            </th>
            {NUMBERS.map(([short, long]) => (
              <th
                key={short}
                scope="col"
                aria-sort={short === "PJ" ? sorted("played") : undefined}
                className={`${head} text-right`}
              >
                <abbr title={long}>{short}</abbr>
              </th>
            ))}
            <th scope="col" aria-sort={sorted("balance")} className={`${head} text-right`}>
              Saldo
            </th>
            <th scope="col" className={`${head} w-40`}>
              Balance
            </th>
            <th scope="col" className={head}>
              Dominio
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rivalId} className="border-glass-border h-12 border-t">
              <td className="p-0">
                <RivalLink
                  rivalId={row.rivalId}
                  shortName={row.shortName}
                  className="flex h-12 items-center gap-2 px-3 font-medium"
                >
                  {row.crest ? <Crest spec={row.crest} className="size-6 shrink-0" /> : null}
                  {row.shortName}
                </RivalLink>
              </td>
              {NUMBERS.map(([short, , key]) => (
                <td key={short} className="px-3 text-right tabular-nums">
                  {row[key]}
                </td>
              ))}
              <td className="px-3 text-right font-medium tabular-nums">
                {formatBalance(row.balance)}
              </td>
              <td className="px-3">
                <div className="w-36">
                  <RecordBar bar={row.bar} />
                </div>
              </td>
              <td className="px-3">
                <DominanceChip dominance={row.dominance} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
