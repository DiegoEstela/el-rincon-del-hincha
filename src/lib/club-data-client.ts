// Loads the document of one club in the browser (plan 0015, ADR 0018). The signature takes only
// the club id: it cannot receive the fan start date, so the date cannot reach a request. The URL
// has no query and the request has no body.
import { CLUB_DATA_VERSION, type ClubData } from "@/domain/club-data";

export type ClubDataFailure = "http" | "network" | "shape";

export class ClubDataError extends Error {
  constructor(public readonly kind: ClubDataFailure) {
    super(kind);
    this.name = "ClubDataError";
  }
}

const COLLECTIONS = [
  "clubs",
  "competitions",
  "seasons",
  "matches",
  "coverage",
  "titles",
  "movements",
  "rivalries",
] as const;

const MATCH_STRINGS = ["id", "date", "home_id", "away_id", "season_id"] as const;

/** Light structural guard (the server is ours): version, club, arrays and the match keys. */
export function isClubData(value: unknown, clubId: string): value is ClubData {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Record<string, unknown>;
  if (doc.v !== CLUB_DATA_VERSION || doc.clubId !== clubId) return false;
  if (!COLLECTIONS.every((key) => Array.isArray(doc[key]))) return false;
  return (doc.matches as unknown[]).every(
    (match) =>
      typeof match === "object" &&
      match !== null &&
      MATCH_STRINGS.every((key) => typeof (match as Record<string, unknown>)[key] === "string"),
  );
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function fetchDocument(fetchImpl: FetchLike, clubId: string): Promise<ClubData> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/clubs/${encodeURIComponent(clubId)}`, {
      credentials: "same-origin",
    });
  } catch {
    throw new ClubDataError("network");
  }
  if (!response.ok) throw new ClubDataError("http");
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ClubDataError("shape");
  }
  if (!isClubData(body, clubId)) throw new ClubDataError("shape");
  return body;
}

/** A loader with its own cache: one request per club, a failed one is forgotten so it can retry. */
export function createClubDataLoader(
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): (clubId: string) => Promise<ClubData> {
  const cache = new Map<string, Promise<ClubData>>();
  return (clubId) => {
    const cached = cache.get(clubId);
    if (cached !== undefined) return cached;
    const pending = fetchDocument(fetchImpl, clubId);
    cache.set(clubId, pending);
    pending.catch(() => cache.delete(clubId));
    return pending;
  };
}

export const loadClubData = createClubDataLoader();
