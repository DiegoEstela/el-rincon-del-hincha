"use client";

import { Home, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/vitrina", label: "Vitrina", Icon: Trophy },
  { href: "/rivales", label: "Rivales", Icon: Swords },
  { href: "/comparar", label: "Comparar", Icon: Users },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="glass fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon aria-hidden size={20} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
