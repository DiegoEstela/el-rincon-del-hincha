import type { Metadata } from "next";
import { RivalsScreen } from "@/components/rivals/rivals-screen";
import { CLUB_OPTIONS } from "@/lib/club-catalog.server";

export const metadata: Metadata = { title: "Rivales" };

/** A static shell: the club list is the same for everyone, the rest happens in the browser. */
export default function RivalesPage() {
  return <RivalsScreen clubs={CLUB_OPTIONS} />;
}
