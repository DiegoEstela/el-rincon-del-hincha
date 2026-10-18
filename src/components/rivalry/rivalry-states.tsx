import Link from "next/link";

const button =
  "bg-accent text-accent-contrast focus-visible:outline-accent inline-flex min-h-12 items-center rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2";
const card = "glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left";

/** Same layout as the loaded screen, so nothing jumps when the numbers arrive. */
export function RivalrySkeleton() {
  const block = "bg-glass rounded-2xl motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="grid gap-4">
      <span className="sr-only">Cargando el mano a mano…</span>
      <div className={`${block} h-14 w-2/3`} />
      <div className={`${block} h-24`} />
      <div className={`${block} h-40`} />
      <div className={`${block} h-28`} />
      <div className={`${block} h-36`} />
      <div className={`${block} h-36`} />
    </div>
  );
}

/** The rival is the fan's own club. */
export function SameClub() {
  return (
    <section className={card}>
      <h1 className="font-display text-4xl lg:text-6xl">Ese es tu club</h1>
      <p className="text-muted mt-3 max-w-xl">
        No podés jugar contra vos mismo… bueno, en los entrenamientos sí. Elegí un rival.
      </p>
      <Link href="/rivales" className={`${button} mt-6`}>
        Ver tus rivales
      </Link>
    </section>
  );
}

/** The two clubs have no meeting in the fan period. */
export function NeverMet({ club, rival }: { club: string; rival: string }) {
  return (
    <section aria-labelledby="todavia-no-se-cruzaron" className={card}>
      <h2 id="todavia-no-se-cruzaron" className="font-display text-3xl">
        Todavía no se cruzaron
      </h2>
      <p className="text-muted mt-2">
        En tu período no hay partidos cargados entre {club} y {rival}.
      </p>
      <Link href="/rivales" className={`${button} mt-6`}>
        Ver tus rivales
      </Link>
    </section>
  );
}
