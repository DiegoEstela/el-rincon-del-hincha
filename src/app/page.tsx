import { Sparkles } from "lucide-react";
import { Onboarding } from "@/components/onboarding/onboarding";
import { CLUB_OPTIONS } from "@/lib/club-catalog.server";

export default function Home() {
  return (
    <div className="pt-4 lg:pt-0">
      <section className="lawn rounded-3xl py-6 lg:rounded-none lg:py-0">
        <p className="rise border-glass-border text-muted inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
          <Sparkles aria-hidden size={14} className="text-gold" />
          Tu DNI futbolero
        </p>
        <h1 className="font-display rise mt-5 text-6xl leading-[0.95] sm:text-7xl lg:text-8xl">
          La historia de tu club ya está escrita.
          <span className="text-accent mt-2 block">La tuya se sigue jugando.</span>
        </h1>
        <p className="rise text-muted mt-5 max-w-md text-lg">
          Elegí tu club, decinos desde cuándo sos hincha y mirá cuántos títulos viviste, a quién
          tenés de hijo y qué te falta ganar.
        </p>
        <a
          href="#elegi-tu-club"
          className="bg-accent text-accent-contrast focus-visible:outline-accent rise mt-6 inline-flex min-h-12 items-center rounded-xl px-6 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Empezá: elegí tu club
        </a>
      </section>
      <div className="mt-10 lg:mt-14">
        <Onboarding clubs={CLUB_OPTIONS} />
      </div>
    </div>
  );
}
