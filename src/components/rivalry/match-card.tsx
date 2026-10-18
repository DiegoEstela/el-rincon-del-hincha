import { Check, Minus, X } from "lucide-react";
import type { Outcome } from "@/domain/match-outcome";
import type { MatchCardView, MatchSide } from "@/lib/rivalry-view";

const PILLS = {
  W: { Icon: Check, classes: "text-win bg-win/5 border-win/40" },
  D: { Icon: Minus, classes: "text-even bg-even/5 border-even/40" },
  L: { Icon: X, classes: "text-loss bg-loss/5 border-loss/40" },
} as const;

/** The result in words and an icon, never in color alone. The tint is the chips' 5%. */
export function ResultPill({ outcome, label }: { outcome: Outcome; label: string }) {
  const { Icon, classes } = PILLS[outcome];
  return (
    <span
      data-outcome={outcome}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap ${classes}`}
    >
      <Icon aria-hidden size={14} />
      {label}
    </span>
  );
}

const side = (s: MatchSide) => (
  <span className={s.isFan ? "font-bold" : undefined}>
    {s.name} {s.goals}
  </span>
);

/** One match: date, competition, the score, the result and a note. */
export function MatchCard({ match }: { match: MatchCardView }) {
  return (
    <div className="grid gap-2">
      <p className="text-muted text-sm">
        {match.date} · {match.competition}
      </p>
      <p className="sr-only">{match.spoken}</p>
      <p aria-hidden className="font-display text-2xl">
        {side(match.home)} - {side(match.away)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <ResultPill outcome={match.outcome} label={match.result} />
        {match.note === null ? null : <span className="text-muted text-sm">{match.note}</span>}
      </div>
    </div>
  );
}
