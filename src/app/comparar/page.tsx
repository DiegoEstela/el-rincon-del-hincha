import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Comparar" };

export default function CompararPage() {
  return (
    <ComingSoon
      title="Compará con un amigo"
      text="Armá tu comparación, mandale el link a tu amigo y fijate quién gana en categorías."
    />
  );
}
