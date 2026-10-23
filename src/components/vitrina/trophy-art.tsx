import type { TrophyKind } from "@/lib/vitrina-view";

// Generic trophies drawn for this project (ADR 0005 spirit: no official trophy or brand). One cup
// for everything, with a small mark inside that tells the kinds apart. Decorative: the name of the
// trophy is always next to it.
const CUP = "M20 8h24v14c0 9-5 15-12 17-7-2-12-8-12-17z";
const HANDLES = "M20 12H12c0 8 3 12 9 14M44 12h8c0 8-3 12-9 14";
const STEM = "M32 39v9M25 48h14l2 8H23z";

const MARKS: Record<TrophyKind, string> = {
  // A star: the league.
  league: "M32 14l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z",
  // Two bands: a cup.
  cup: "M24 17h16M24 22h16",
  // A ball: international.
  international: "M32 24m-6 0a6 6 0 1012 0a6 6 0 10-12 0M26 24h12M32 18v12",
  // A diamond: anything else.
  other: "M32 14l6 8-6 8-6-8z",
};

export type Tone = "gold" | "muted" | "outline";

const TONE_CLASS: Record<Tone, string> = {
  gold: "text-gold",
  muted: "text-muted",
  outline: "text-muted",
};

/**
 * "gold": a title of the fan, filled with the gold of the palette. "muted": a title from before the
 * fan arrived, filled but without the gold. "outline": a silhouette, only a line, so it reads as
 * "still missing" without color alone (the caption says it too).
 */
export function TrophyArt({
  kind,
  tone,
  className,
}: {
  kind: TrophyKind;
  tone: Tone;
  className?: string;
}) {
  const filled = tone !== "outline";
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-kind={kind}
      data-tone={tone}
      className={`${TONE_CLASS[tone]} ${className ?? ""}`}
    >
      <g
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 1 : 2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={CUP} />
        <path d={HANDLES} fill="none" strokeWidth={2.5} />
        <path d={STEM} />
      </g>
      <path
        d={MARKS[kind]}
        fill="none"
        stroke={filled ? "var(--background)" : "currentColor"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
