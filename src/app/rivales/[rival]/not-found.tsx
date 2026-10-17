import Link from "next/link";

/** An id that is not a club of the dataset. It never echoes the id it was asked for. */
export default function RivalNotFound() {
  return (
    <section className="glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left">
      <h1 className="font-display text-4xl lg:text-6xl">Ese rival no está en la cancha</h1>
      <p className="text-muted mx-auto mt-3 max-w-sm lg:mx-0 lg:max-w-xl">
        No encontramos ese club. Volvé a la lista y elegí a quién querés mirar de frente.
      </p>
      <Link
        href="/rivales"
        className="bg-accent text-accent-contrast focus-visible:outline-accent mt-6 inline-flex min-h-12 items-center rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Volver a Rivales
      </Link>
    </section>
  );
}
