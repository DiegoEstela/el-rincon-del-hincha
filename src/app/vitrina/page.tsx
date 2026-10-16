import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Mi vitrina" };

export default function VitrinaPage() {
  return (
    <ComingSoon
      title="Mi vitrina"
      text="Acá vas a ver los trofeos que ganó tu club desde que naciste, y los que todavía te faltan."
    />
  );
}
