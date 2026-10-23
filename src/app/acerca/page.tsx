import type { Metadata } from "next";
import rsssfManifest from "../../../sources/rsssf/manifest.json";
import { RSSSF_HOME, rsssfCredit } from "@/lib/rsssf-credit";
import { CREDITS } from "@/lib/version";

export const metadata: Metadata = { title: "Acerca" };

export default function AcercaPage() {
  const rsssf = rsssfCredit(rsssfManifest);
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
      <h3 className="font-display pt-2 text-2xl">RSSSF</h3>
      <p className="text-muted">
        {rsssf.sentence} Usamos solo los resultados y las tablas de la primera división argentina,
        con el permiso de la RSSSF. Podés ver el sitio en{" "}
        <a className="text-accent underline" href={RSSSF_HOME}>
          rsssf.org
        </a>
        .
      </p>
      <p className="text-muted">
        Páginas que usamos:{" "}
        {rsssf.pages.map((page, index) => (
          <span key={page.url}>
            {index > 0 ? ", " : ""}
            <a className="text-accent underline" href={page.url}>
              {page.label}
            </a>
          </span>
        ))}
        .
      </p>
    </article>
  );
}
