import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RivalryScreen } from "@/components/rivalry/rivalry-screen";
import { CLUB_OPTIONS } from "@/lib/club-catalog.server";
import { CLUB_IDS } from "@/lib/club-data.server";
import { clubIdSchema } from "@/lib/engine-input.server";

// The build fails if this route ever reads request data, and an unlisted id gets a real 404
// (ADR 0019).
export const ensureStatic = "navigation";

type Props = { params: Promise<{ rival: string }> };

export function generateStaticParams(): { rival: string }[] {
  return CLUB_IDS.map((rival) => ({ rival }));
}

/** The rival of the URL, or undefined for an id outside the dataset. The id is never echoed. */
async function rivalOf(params: Props["params"]) {
  const parsed = clubIdSchema.safeParse((await params).rival);
  return parsed.success ? CLUB_OPTIONS.find((club) => club.id === parsed.data) : undefined;
}

/** Built from the public rival only: the fan's club and start date are unknown on the server. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const rival = await rivalOf(params);
  if (rival === undefined) return {};
  return {
    title: `${rival.name} · Rivales`,
    description: `Tu historial contra ${rival.name} desde que sos hincha: último partido, rachas, goleadas y finales.`,
    robots: { index: false, follow: true },
  };
}

/** A static shell per rival: the numbers depend on the fan, so they are computed in the browser. */
export default async function RivalryPage({ params }: Props) {
  const rival = await rivalOf(params);
  if (rival === undefined) notFound();
  return <RivalryScreen clubs={CLUB_OPTIONS} rival={rival} />;
}
