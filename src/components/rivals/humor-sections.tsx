import { Crest } from "@/components/crest";
import { formatBalance } from "@/lib/rivals-format";
import type { RivalRowView, RivalsView } from "@/lib/rivals-view";

const SECTIONS = [
  {
    key: "favorable",
    id: "los-tenes-de-hijos",
    title: "Los tenés de hijos",
    line: "Desde que llegaste, contra estos la historia es tuya.",
    empty: "Todavía no tenés hijos futboleros. Paciencia, que la tuya se sigue jugando.",
  },
  {
    key: "even",
    id: "historia-pareja",
    title: "Historia pareja",
    line: "Acá no se ríe nadie: un partido inclina la balanza.",
    empty: "Acá no hay medias tintas: o los tenés de hijos o te tienen de hijo.",
  },
  {
    key: "unfavorable",
    id: "te-tienen-de-hijo",
    title: "Te tienen de hijo",
    line: "Duele, pero hay revancha: el próximo partido puede cambiarlo.",
    empty: "Nadie te tiene de hijo. Mirá vos.",
  },
] as const;

function Row({ row }: { row: RivalRowView }) {
  return (
    <li className="flex min-h-11 items-center gap-3">
      {row.crest ? <Crest spec={row.crest} className="size-8 shrink-0" /> : null}
      <span className="flex-1 truncate font-medium">{row.shortName}</span>
      <span className="text-muted text-sm tabular-nums">Saldo {formatBalance(row.balance)}</span>
    </li>
  );
}

/** The best three of each group, with a joke. The full list is below the screen's filters. */
export function HumorSections({ sections }: { sections: RivalsView["sections"] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
      {SECTIONS.map(({ key, id, title, line, empty }) => {
        const rows = sections[key];
        return (
          <section
            key={key}
            aria-labelledby={id}
            className="glass scroll-mt-4 rounded-2xl p-4 lg:rounded-xl"
          >
            <h2 id={id} className="font-display text-2xl">
              {title}
            </h2>
            {rows.length > 0 ? (
              <>
                <p className="text-muted mt-1 text-sm">{line}</p>
                <ul className="mt-2">
                  {rows.map((row) => (
                    <Row key={row.rivalId} row={row} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-muted mt-1 text-sm">{empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
