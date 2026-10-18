import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Crest } from "@/components/crest";
import type { ClubOption } from "@/lib/club-options";

/** Back link, two crests facing each other and the title. The crests are decorative. */
export function RivalryHeader({
  title,
  subline,
  own,
  rival,
}: {
  title: string;
  /** "Desde mayo de 1990 · 8 partidos"; null while it is not known. */
  subline: string | null;
  own: ClubOption | null;
  rival: ClubOption;
}) {
  return (
    <header className="grid gap-4">
      <Link
        href="/rivales"
        className="text-muted hover:text-foreground focus-visible:outline-accent -ml-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft aria-hidden size={18} />
        <span>
          <span className="sr-only">Volver a</span> Rivales
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <div aria-hidden className="flex shrink-0 items-center gap-2">
          {own ? <Crest spec={own.crest} className="size-14" /> : null}
          <span className="font-display text-muted text-2xl">vs.</span>
          <Crest spec={rival.crest} className="size-14" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-4xl leading-none lg:text-6xl">{title}</h1>
          {subline === null ? null : <p className="text-muted mt-1 text-sm">{subline}</p>}
        </div>
      </div>
    </header>
  );
}
