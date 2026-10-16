import Link from "next/link";

/** Mobile header. Hidden from 1024px up, where the sidebar carries the logo. */
export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 lg:hidden">
      <Link href="/" className="font-display text-foreground text-2xl leading-none">
        Rincón <span className="text-accent">del Hincha</span>
      </Link>
    </header>
  );
}
