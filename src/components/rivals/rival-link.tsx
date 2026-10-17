import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The link to a rival's detail (plan 0016). The accessible name starts with the visible name
 * ("Boca, ver el mano a mano"). With `stretched` the link's box covers its positioned parent, so
 * the whole card is the target while the DOM keeps one link per card.
 */
export function RivalLink({
  rivalId,
  shortName,
  stretched = false,
  className = "",
  children,
}: {
  rivalId: string;
  shortName: string;
  stretched?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const box = stretched ? "after:absolute after:inset-0 after:content-['']" : "";
  return (
    <Link
      href={`/rivales/${rivalId}`}
      className={`${box} focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
    >
      {children ?? shortName}
      <span className="sr-only">, ver el mano a mano</span>
    </Link>
  );
}

/** A decorative chevron: the card is a link, and this says so. */
export function RivalChevron() {
  return <ChevronRight aria-hidden className="text-muted size-5 shrink-0" />;
}
