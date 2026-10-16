import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidad" };

export default function PrivacidadPage() {
  return (
    <article className="rise mt-6 space-y-4">
      <h1 className="font-display text-5xl">Privacidad</h1>
      <p className="text-muted">
        Tu club y tu fecha de inicio se guardan solo en tu dispositivo. Tu fecha de nacimiento nunca
        viaja en un link ni en la analítica.
      </p>
      <p className="text-muted">
        Cuando armes una comparación para compartir, guardamos únicamente el club, la fecha de
        inicio y un apodo opcional. Esos datos se borran solos a los 90 días.
      </p>
    </article>
  );
}
