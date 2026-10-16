import Link from "next/link";

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4">
      <a
        href="#contenido"
        className="bg-accent text-accent-contrast sr-only rounded-md px-3 py-2 focus:not-sr-only"
      >
        Saltar al contenido
      </a>
      <Link href="/" className="font-display text-foreground text-2xl leading-none">
        Rincón <span className="text-accent">del Hincha</span>
      </Link>
    </header>
  );
}
