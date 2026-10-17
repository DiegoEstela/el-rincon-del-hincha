import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { pluralRivals } from "@/lib/rivals-format";

const CARDS = [
  {
    key: "favorable",
    title: "Historial favorable",
    href: "#los-tenes-de-hijos",
    Icon: ArrowUp,
    color: "text-win",
  },
  {
    key: "even",
    title: "Historial igualado",
    href: "#historia-pareja",
    Icon: Equal,
    color: "text-even",
  },
  {
    key: "unfavorable",
    title: "Historial desfavorable",
    href: "#te-tienen-de-hijo",
    Icon: ArrowDown,
    color: "text-loss",
  },
] as const;

/** The three summary cards; each one jumps to its humor section. */
export function RivalsSummary({
  summary,
}: {
  summary: Readonly<{ favorable: number; even: number; unfavorable: number }>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 lg:gap-4">
      {CARDS.map(({ key, title, href, Icon, color }) => (
        <a
          key={key}
          href={href}
          className="glass flex min-h-11 flex-col gap-1 rounded-2xl p-3 text-left lg:rounded-xl lg:p-4"
        >
          <Icon aria-hidden size={18} className={color} />
          <span className="text-muted text-xs leading-tight lg:text-sm">{title}</span>
          <span className={`font-display text-2xl leading-none lg:text-3xl ${color}`}>
            {pluralRivals(summary[key])}
          </span>
        </a>
      ))}
    </div>
  );
}
