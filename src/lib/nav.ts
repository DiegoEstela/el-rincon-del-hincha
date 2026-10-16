export const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/vitrina", label: "Vitrina" },
  { href: "/rivales", label: "Rivales" },
  { href: "/comparar", label: "Comparar" },
] as const;

/** Home matches only the root; other items match themselves and their nested routes. */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const INFO_ITEMS = [
  { href: "/acerca", label: "Acerca" },
  { href: "/privacidad", label: "Privacidad" },
] as const;
