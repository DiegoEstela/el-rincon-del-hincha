import Link from "next/link";
import { InfoLinks } from "./info-links";
import { NavLinks } from "./nav-links";

/**
 * Desktop navigation: a floating panel. `hidden lg:flex` keeps it out of the accessibility tree
 * below 1024px. The shared <Footer> is pinned over the bottom of this panel, hence the bottom
 * reserve: it must stay at least the footer height + 16px (guarded by an e2e test, see plan 0002).
 */
export function Sidebar() {
  return (
    <div
      data-testid="sidebar"
      className="panel bg-raised fixed inset-y-3 left-3 z-30 hidden w-64 flex-col overflow-y-auto rounded-2xl px-4 pt-6 pb-[9rem] lg:flex"
    >
      <Link
        href="/"
        className="font-display text-foreground mb-8 block px-3 text-[1.75rem] leading-none"
      >
        Rincón <span className="text-accent">del Hincha</span>
      </Link>
      <NavLinks variant="sidebar" />
      <InfoLinks />
    </div>
  );
}
