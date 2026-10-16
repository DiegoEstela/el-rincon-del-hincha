import Link from "next/link";
import { CREDITS, formatVersion } from "@/lib/version";

/**
 * The single footer of the app: credits and version only (mandatory on every page).
 * Mobile: small centered text below the content. Desktop: pinned to the bottom of the floating
 * sidebar panel (same box as its bottom edge). It is a direct child of <body> so it keeps the
 * `contentinfo` landmark role.
 */
export function Footer() {
  return (
    <footer className="text-muted lg:border-glass-border lg:bg-raised mx-auto w-full max-w-3xl px-4 pt-6 pb-28 text-center text-xs lg:fixed lg:bottom-3 lg:left-3 lg:z-40 lg:m-0 lg:w-64 lg:max-w-none lg:rounded-b-2xl lg:border-t lg:px-7 lg:pt-4 lg:pb-5 lg:text-left">
      <p>
        Creada por {CREDITS.author}
        <span aria-hidden className="hidden sm:inline lg:hidden">
          {" "}
          ·{" "}
        </span>
        <span className="block sm:inline lg:block">Idea original de {CREDITS.originalIdea}</span>
      </p>
      <p>
        <Link
          href="/changelog"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline lg:min-h-6"
          data-testid="app-version"
        >
          {formatVersion()}
        </Link>
      </p>
    </footer>
  );
}
