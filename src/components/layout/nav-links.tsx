"use client";

import { Home, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActiveRoute } from "@/lib/nav";

const ICONS = { "/": Home, "/vitrina": Trophy, "/rivales": Swords, "/comparar": Users } as const;

export function NavLinks({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  const bottom = variant === "bottom";

  return (
    <nav aria-label="Principal">
      <ul className={bottom ? "grid grid-cols-4" : "flex flex-col gap-1"}>
        {NAV_ITEMS.map(({ href, label }) => {
          const Icon = ICONS[href];
          const active = isActiveRoute(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  bottom
                    ? `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs motion-safe:transition-colors ${
                        active ? "text-accent" : "text-muted"
                      }`
                    : `flex min-h-11 items-center gap-3 rounded-lg px-3 text-base motion-safe:transition-colors ${
                        active
                          ? "bg-accent/12 text-accent"
                          : "text-muted hover:bg-glass hover:text-foreground"
                      }`
                }
              >
                {bottom && active && (
                  <span
                    aria-hidden
                    data-testid="active-indicator"
                    className="bg-accent/12 absolute inset-x-3 inset-y-1.5 rounded-xl shadow-[0_0_24px_rgb(198_255_61/0.08)]"
                  />
                )}
                <Icon aria-hidden size={bottom ? 20 : 22} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
