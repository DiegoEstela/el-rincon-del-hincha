import { Check, Circle, HelpCircle } from "lucide-react";
import type { ChecklistRow } from "@/lib/vitrina-view";

const ICONS = { won: Check, missing: Circle, unknown: HelpCircle } as const;
const COLORS = { won: "text-win", missing: "text-even", unknown: "text-muted" } as const;

/** One row per loaded competition. The status is text plus an icon, never color alone. */
export function Checklist({ rows }: { rows: readonly ChecklistRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section
      aria-labelledby="tu-checklist"
      className="glass grid gap-3 rounded-2xl p-4 lg:rounded-xl"
    >
      <h2 id="tu-checklist" className="font-display text-3xl">
        Tu checklist
      </h2>
      <ul className="grid gap-2">
        {rows.map((row) => {
          const Icon = ICONS[row.status];
          return (
            <li
              key={row.competitionId}
              data-status={row.status}
              className="flex min-h-11 items-center gap-3"
            >
              <Icon aria-hidden size={20} className={`${COLORS[row.status]} shrink-0`} />
              <span className="flex-1">{row.name}</span>
              <span className="text-muted text-sm">{row.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
