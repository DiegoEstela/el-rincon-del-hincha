import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { Dominance } from "@/domain/dominance";

const CHIPS = {
  [Dominance.Dominates]: {
    label: "Dominás",
    Icon: ArrowUp,
    classes: "text-win bg-win/5 border-win/40",
  },
  [Dominance.Even]: { label: "Parejo", Icon: Equal, classes: "text-even bg-even/5 border-even/40" },
  [Dominance.Dominated]: {
    label: "Te domina",
    Icon: ArrowDown,
    classes: "text-loss bg-loss/5 border-loss/40",
  },
} as const;

/**
 * Who dominates, in words and an icon, so it never depends on color alone. The 5% tint is the one
 * the palette contrast test checks (4.5:1 over the glass and the glow). Not interactive.
 */
export function DominanceChip({ dominance }: { dominance: Dominance }) {
  const { label, Icon, classes } = CHIPS[dominance];
  return (
    <span
      data-dominance={dominance}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap ${classes}`}
    >
      <Icon aria-hidden size={14} />
      {label}
    </span>
  );
}
