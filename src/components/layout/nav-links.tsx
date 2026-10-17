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
                    : `relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium tracking-tight motion-safe:transition-colors ${
                        active
                          ? "bg-accent/12 text-accent before:bg-accent before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full"
                          : "text-muted hover:bg-glass hover:text-foreground"
                      }`
                }
              >
                {bottom && active && (
                  <span
                    aria-hidden
                    data-testid="active-indicator"
                    className="bg-accent/12 absolute inset-x-3 inset-y-1.5 rounded-xl shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_8%,transparent)]"
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
