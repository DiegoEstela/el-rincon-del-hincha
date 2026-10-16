import { Trophy } from "lucide-react";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="rise glass mt-6 rounded-3xl p-8 text-center">
      <Trophy aria-hidden className="text-gold mx-auto" size={40} />
      <h1 className="font-display mt-4 text-4xl">{title}</h1>
      <p className="text-muted mx-auto mt-3 max-w-sm">{text}</p>
    </section>
  );
}
