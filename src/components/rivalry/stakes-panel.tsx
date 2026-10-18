import { AlertTriangle, Flag, Target } from "lucide-react";

/** Each line gets the icon of what it says; the icon is decoration. */
function iconFor(line: string) {
  if (line.startsWith("Ojo")) return AlertTriangle;
  if (line.startsWith("Con ") || line.startsWith("Tenés colchón")) return Target;
  return Flag;
}

/** "Lo que está en juego": one to three lines; nothing at all when there are none. */
export function StakesPanel({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <section
      aria-labelledby="lo-que-esta-en-juego"
      className="glass border-accent/60 grid gap-3 rounded-2xl border-2 p-4 lg:rounded-xl"
    >
      <h2 id="lo-que-esta-en-juego" className="font-display text-3xl">
        Lo que está en juego
      </h2>
      <ul className="grid gap-2">
        {lines.map((line) => {
          const Icon = iconFor(line);
          return (
            <li key={line} className="flex items-start gap-3">
              <Icon aria-hidden size={20} className="text-accent mt-0.5 shrink-0" />
              <span>{line}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
