import type { Metadata } from "next";
import { CREDITS } from "@/lib/version";

export const metadata: Metadata = { title: "Acerca" };

export default function AcercaPage() {
  return (
    <article className="rise mt-6 space-y-4">
      <h1 className="font-display text-5xl">Acerca de Rincón del Hincha</h1>
      <p className="text-muted">
        Creada por <strong className="text-foreground">{CREDITS.author}</strong>. Idea original de{" "}
        <strong className="text-foreground">{CREDITS.originalIdea}</strong>.
      </p>
      <p className="text-muted">
        Acá se compara a los hinchas, no a los clubes: cada historia empieza cuando empezás a vivir
        a tu equipo.
      </p>
      <h2 className="font-display pt-4 text-3xl">Metodología y fuentes</h2>
      <p className="text-muted">
        Todavía estamos armando la base de datos histórica. Cuando una fecha de inicio sea anterior
        a la cobertura completa de un club, te lo vamos a avisar. Nunca mostramos como completo un
        dato que no lo es.
      </p>
    </article>
  );
}
