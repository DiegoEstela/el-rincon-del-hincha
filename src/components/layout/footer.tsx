import Link from "next/link";
import { CREDITS, formatVersion } from "@/lib/version";

export function Footer() {
  return (
    <footer className="text-muted mx-auto w-full max-w-3xl px-4 pt-6 pb-28 text-center text-sm">
      <p>
        Creada por {CREDITS.author} · Idea original de {CREDITS.originalIdea}
      </p>
      <p className="mt-1">
        <Link
          href="/changelog"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          data-testid="app-version"
        >
          {formatVersion()}
        </Link>
        <span aria-hidden> · </span>
        <Link
          href="/acerca"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          Acerca
        </Link>
        <span aria-hidden> · </span>
        <Link
          href="/privacidad"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          Privacidad
        </Link>
      </p>
    </footer>
  );
}
