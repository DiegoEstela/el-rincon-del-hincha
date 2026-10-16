import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Rivales" };

export default function RivalesPage() {
  return (
    <ComingSoon
      title="Tu club vs. todos"
      text="Pronto vas a saber a quién tenés de hijo, con quién la historia viene pareja y quién te tiene de hijo a vos."
    />
  );
}
