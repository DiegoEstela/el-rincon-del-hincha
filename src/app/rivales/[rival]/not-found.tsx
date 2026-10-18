import Link from "next/link";

/** An id that is not a club of the dataset. It never echoes the id it was asked for. */
export default function RivalNotFound() {
  return (
    <section className="glass rounded-3xl p-8 text-center lg:rounded-xl lg:text-left">
      <h1 className="font-display text-4xl lg:text-6xl">Ese rival no está en nuestro fixture</h1>
      <p className="text-muted mx-auto mt-3 max-w-sm lg:mx-0 lg:max-w-xl">
        Fijate que el link esté bien, o elegí uno de tu lista.
      </p>
      <Link
        href="/rivales"
        className="bg-accent text-accent-contrast focus-visible:outline-accent mt-6 inline-flex min-h-12 items-center rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Ver tus rivales
      </Link>
    </section>
  );
}
