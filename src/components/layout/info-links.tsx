"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INFO_ITEMS, isActiveRoute } from "@/lib/nav";

/** Discreet Acerca / Privacidad links for the desktop sidebar. */
export function InfoLinks() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Información" className="border-glass-border mt-6 border-t pt-4">
      <ul>
        {INFO_ITEMS.map(({ href, label }) => {
          const active = isActiveRoute(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-8 items-center rounded-lg px-3 text-sm motion-safe:transition-colors ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
