import { useId } from "react";
import type { CrestSpec } from "@/lib/club-options";
import { CREST_VIEWBOX, SHIELD_PATH, crestShapes } from "@/lib/crest";

type CrestProps = { spec: CrestSpec; title?: string; className?: string };

/**
 * Generic club crest built from the club colors (ADR 0005): no official crest or brand.
 * Decorative by default (the club name is always next to it); pass `title` to use it alone.
 */
export function Crest({ spec, title, className }: CrestProps) {
  const clipId = useId();
  const { outline, body, chief, initials } = crestShapes(spec);
  const a11y = title
    ? ({ role: "img", "aria-label": title } as const)
    : ({ "aria-hidden": true } as const);
  return (
    <svg viewBox={CREST_VIEWBOX} className={className} focusable="false" {...a11y}>
      <defs>
        <clipPath id={clipId}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {body.map((shape, i) =>
          shape.kind === "rect" ? (
            <rect
              key={i}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill={shape.fill}
            />
          ) : (
            <polygon key={i} points={shape.points} fill={shape.fill} />
          ),
        )}
        <rect x={chief.x} y={chief.y} width={chief.width} height={chief.height} fill={chief.fill} />
      </g>
      <path
        d={outline.path}
        fill="none"
        stroke={outline.stroke}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <text
        x={initials.x}
        y={initials.y}
        fontSize={initials.fontSize}
        fill={initials.fill}
        textAnchor="middle"
        fontFamily="var(--font-display), system-ui, sans-serif"
        letterSpacing={1}
      >
        {initials.text}
      </text>
    </svg>
  );
}
