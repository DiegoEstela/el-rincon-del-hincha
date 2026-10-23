import { Trophy, WifiOff } from "lucide-react";
import Link from "next/link";
import { EMPTY_PERIOD, NO_TITLES_LOADED } from "@/lib/vitrina-copy";

const button =
  "bg-accent text-accent-contrast focus-visible:outline-accent inline-flex min-h-12 items-center rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
const card = "glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left";

/** Same layout as the loaded screen, so nothing jumps when the trophies arrive. */
export function VitrinaSkeleton() {
  const block = "bg-glass rounded-2xl motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="grid gap-4">
      <span className="sr-only">Cargando tu vitrina…</span>
      <div className={`${block} h-14 w-2/3`} />
      <div className="grid grid-cols-2 gap-2">
        <div className={`${block} h-24`} />
        <div className={`${block} h-24`} />
      </div>
      <div className={`${block} h-28`} />
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${block} h-40`} />
      ))}
    </div>
  );
}

/** No club saved on this device yet. */
export function VitrinaEmpty() {
  return (
    <section className={card}>
      <Trophy aria-hidden className="text-gold mx-auto lg:mx-0" size={40} />
      <h1 className="font-display mt-4 text-4xl lg:text-6xl">Todavía no elegiste tu club</h1>
      <p className="text-muted mx-auto mt-3 max-w-sm lg:mx-0 lg:max-w-xl">
        Elegí tu club y desde cuándo sos hincha para armar tu vitrina.
      </p>
      <Link href="/#elegi-tu-club" className={`${button} mt-6`}>
        Elegir mi club
      </Link>
    </section>
  );
}

/** The document could not be loaded. */
export function VitrinaError({ onRetry }: { onRetry: () => void }) {
  return (
    <section role="alert" className={card}>
      <WifiOff aria-hidden className="text-loss mx-auto lg:mx-0" size={40} />
      <h1 className="font-display mt-4 text-4xl">No pudimos abrir tu vitrina</h1>
      <p className="text-muted mt-3">Se nos cortó la transmisión. ¿Probamos de nuevo?</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
        <button type="button" onClick={onRetry} className={button}>
          Reintentar
        </button>
      </div>
    </section>
  );
}

/** The dataset has no title at all. */
export function NoTitlesLoaded() {
  return (
    <section aria-labelledby="sin-titulos" className={card}>
      <h2 id="sin-titulos" className="font-display text-3xl">
        {NO_TITLES_LOADED.title}
      </h2>
      <p className="text-muted mt-2 max-w-xl">{NO_TITLES_LOADED.text}</p>
      <Link href="/rivales" className={`${button} mt-6`}>
        {NO_TITLES_LOADED.action}
      </Link>
    </section>
  );
}

/** The fan starts after today. */
export function EmptyPeriod() {
  return (
    <section aria-labelledby="historia-no-empezo" className={card}>
      <h2 id="historia-no-empezo" className="font-display text-3xl">
        {EMPTY_PERIOD.title}
      </h2>
      <p className="text-muted mt-2">{EMPTY_PERIOD.text}</p>
    </section>
  );
}
