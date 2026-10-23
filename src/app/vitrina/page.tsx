import type { Metadata } from "next";
import { VitrinaScreen } from "@/components/vitrina/vitrina-screen";
import { CLUB_OPTIONS } from "@/lib/club-catalog.server";

export const metadata: Metadata = {
  title: "Mi vitrina",
  description: "Los trofeos que ganó tu club desde que sos hincha, y los que todavía te faltan.",
};

/** A static shell: the club list is the same for everyone, the rest happens in the browser. */
export default function VitrinaPage() {
  return <VitrinaScreen clubs={CLUB_OPTIONS} />;
}
