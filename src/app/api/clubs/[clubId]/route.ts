// One JSON document per club, prerendered at build time for the 34 clubs (plan 0015, ADR 0018).
// The browser computes the fan's history on it; only the club id is ever requested, so the start
// date never reaches the server. It reads no request data, no cookie and no clock, so it is static,
// and it never logs: an id outside the dataset gets a 400 that does not echo it.
import { CLUB_IDS, clubDataFor } from "@/lib/club-data.server";
import { clubIdSchema } from "@/lib/engine-input.server";

export function generateStaticParams(): { clubId: string }[] {
  return CLUB_IDS.map((clubId) => ({ clubId }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
): Promise<Response> {
  const parsed = clubIdSchema.safeParse((await params).clubId);
  const document = parsed.success ? clubDataFor(parsed.data) : null;
  if (document === null) return Response.json({ error: "unknown_club" }, { status: 400 });
  return Response.json(document);
}
