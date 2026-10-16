import Link from "next/link";
import { NavLinks } from "./nav-links";

/**
 * Desktop navigation. `hidden lg:flex` keeps it out of the accessibility tree below 1024px.
 * The shared <Footer> is pinned over the bottom of this column, hence the bottom padding.
 */
export function Sidebar() {
  return (
    <div
      data-testid="sidebar"
      className="border-line-strong bg-raised fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r px-4 pt-6 pb-44 lg:flex"
    >
      <Link href="/" className="font-display text-foreground mb-8 block px-3 text-3xl leading-none">
        Rincón <span className="text-accent">del Hincha</span>
      </Link>
      <NavLinks variant="sidebar" />
    </div>
  );
}
