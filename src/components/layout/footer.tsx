import Link from "next/link";
import { CREDITS, formatVersion } from "@/lib/version";

/**
 * The single footer of the app (credits + version are mandatory on every page).
 * Mobile: below the content. Desktop: pinned over the bottom of the sidebar column.
 * It is a direct child of <body> so it keeps the `contentinfo` landmark role.
 */
export function Footer() {
  return (
    <footer className="text-muted lg:bg-raised mx-auto w-full max-w-3xl px-4 pt-6 pb-28 text-center text-sm lg:fixed lg:bottom-0 lg:left-0 lg:z-40 lg:m-0 lg:w-64 lg:max-w-none lg:px-7 lg:pt-0 lg:pb-6 lg:text-left">
      <p>
        Creada por {CREDITS.author} · Idea original de {CREDITS.originalIdea}
      </p>
      <p className="mt-1 lg:flex lg:flex-col">
        <Link
          href="/changelog"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline lg:min-h-8"
          data-testid="app-version"
        >
          {formatVersion()}
        </Link>
        <span aria-hidden className="lg:hidden">
          {" "}
          ·{" "}
        </span>
        <Link
          href="/acerca"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline lg:min-h-8"
        >
          Acerca
        </Link>
        <span aria-hidden className="lg:hidden">
          {" "}
          ·{" "}
        </span>
        <Link
          href="/privacidad"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline lg:min-h-8"
        >
          Privacidad
        </Link>
      </p>
    </footer>
  );
}
