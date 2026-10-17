import { notFound } from "next/navigation";
import { CLUB_IDS } from "@/lib/club-data.server";
import { CLUB_OPTIONS } from "@/lib/club-catalog.server";
import { clubIdSchema } from "@/lib/engine-input.server";

// The build fails if this route ever reads request data, and an unlisted id gets a real 404
// (ADR 0019).
export const ensureStatic = "navigation";

export function generateStaticParams(): { rival: string }[] {
  return CLUB_IDS.map((rival) => ({ rival }));
}

export default async function RivalryPage({ params }: { params: Promise<{ rival: string }> }) {
  const parsed = clubIdSchema.safeParse((await params).rival);
  const rival = parsed.success ? CLUB_OPTIONS.find((c) => c.id === parsed.data) : undefined;
  if (rival === undefined) notFound();
  return <h1 className="font-display text-4xl">Tu club vs. {rival.shortName}</h1>;
}
