import { Trophy } from "lucide-react";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <section className="rise glass mt-6 rounded-3xl p-8 text-center lg:mt-0 lg:rounded-xl lg:text-left">
      <Trophy aria-hidden className="text-gold mx-auto lg:mx-0" size={40} />
      <h1 className="font-display mt-4 text-4xl lg:text-6xl">{title}</h1>
      <p className="text-muted mx-auto mt-3 max-w-sm lg:mx-0 lg:max-w-xl">{text}</p>
    </section>
  );
}
