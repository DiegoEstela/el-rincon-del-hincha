import { Trophy, WifiOff } from "lucide-react";
import Link from "next/link";

const button =
  "bg-accent text-accent-contrast focus-visible:outline-accent inline-flex min-h-12 items-center rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
const ghost = "border-line-strong inline-flex min-h-12 items-center rounded-xl border px-6 text-lg";

/** Same layout as the loaded screen, so nothing jumps when the numbers arrive. */
export function RivalsSkeleton() {
  const block = "bg-glass rounded-2xl motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="grid gap-4">
      <span className="sr-only">Cargando tu historial…</span>
      <div className={`${block} h-14 w-2/3`} />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${block} h-24`} />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`${block} h-24`} />
      ))}
    </div>
  );
}

/** No club saved on this device yet. */
export function RivalsEmpty() {
  return (
    <section className="glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left">
      <Trophy aria-hidden className="text-gold mx-auto lg:mx-0" size={40} />
      <h1 className="font-display mt-4 text-4xl lg:text-6xl">Todavía no elegiste tu club</h1>
      <p className="text-muted mx-auto mt-3 max-w-sm lg:mx-0 lg:max-w-xl">
        Elegí tu club y desde cuándo sos hincha, y te mostramos a quién tenés de hijo.
      </p>
      <Link href="/#elegi-tu-club" className={`${button} mt-6`}>
        Elegí tu club
      </Link>
    </section>
  );
}

/** A club and a period, but nothing to count (or the filters leave nothing). */
export function RivalsNoMatches({
  filtersActive,
  onReset,
}: {
  filtersActive: boolean;
  onReset: () => void;
}) {
  return (
    <section className="glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left">
      <h2 className="font-display text-3xl">Todavía no hay partidos para contar</h2>
      {filtersActive ? (
        <>
          <p className="text-muted mt-2">
            Con estos filtros no hay partidos. Probá con otro rango o torneo.
          </p>
          <button type="button" onClick={onReset} className={`${ghost} mt-4`}>
            Limpiar filtros
          </button>
        </>
      ) : null}
    </section>
  );
}

/** The document could not be loaded. */
export function RivalsError({ onRetry }: { onRetry: () => void }) {
  return (
    <section role="alert" className="glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left">
      <WifiOff aria-hidden className="text-loss mx-auto lg:mx-0" size={40} />
      <h1 className="font-display mt-4 text-4xl">Se nos cortó la transmisión</h1>
      <p className="text-muted mt-3">
        No pudimos cargar tu historial. Revisá tu conexión y probá de nuevo.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
        <button type="button" onClick={onRetry} className={button}>
          Reintentar
        </button>
        <Link href="/" className={ghost}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
