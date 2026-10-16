import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="pt-4 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start lg:gap-10 lg:pt-0">
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
      </section>
      <div className="glass rise mt-8 rounded-3xl p-6 lg:mt-2 lg:rounded-xl">
        <p className="font-display text-2xl">Muy pronto</p>
        <p className="text-muted mt-1">
          Estamos cargando la historia de todos los clubes de Primera. Cuando esté lista, vas a
          poder armar tu vitrina y compararte con tus amigos.
        </p>
      </div>
    </div>
  );
}
