const SEGMENTS = [
  { key: "won", color: "bg-win" },
  { key: "drawn", color: "bg-even" },
  { key: "lost", color: "bg-loss" },
] as const;

/**
 * Wins, draws and losses as one bar. Decorative: the numbers are next to it. It grows from the
 * left only when motion is allowed (the keyframes are in globals.css).
 */
export function RecordBar({
  bar,
}: {
  bar: Readonly<{ won: number; drawn: number; lost: number }>;
}) {
  return (
    <div
      aria-hidden="true"
      className="bg-glass flex h-2 w-full origin-left gap-px overflow-hidden rounded-full motion-safe:animate-[grow_0.6s_ease-out_both]"
    >
      {SEGMENTS.map(({ key, color }) => (
        <span
          key={key}
          data-segment={key}
          className={color}
          style={{ width: `${bar[key] * 100}%` }}
        />
      ))}
    </div>
  );
}
