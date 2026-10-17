import { describe, expect, it } from "vitest";
import { CLUB_DATA_VERSION, sliceClubData } from "@/domain/club-data";
import { statsDataFrom } from "@/domain/data";
import { ClubDataError, createClubDataLoader, isClubData } from "@/lib/club-data-client";
import { statsWorld } from "../../fixtures/domain/stats-world";

const doc = sliceClubData(statsDataFrom(statsWorld()), "club-a");
const ok = (body: unknown = doc, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function recorder(handler: (url: string) => Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url);
  };
  return { calls, loader: createClubDataLoader(fetchImpl) };
}

const kindOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "resolved";
  } catch (e) {
    return e instanceof ClubDataError ? e.kind : "other";
  }
};

describe("loadClubData", () => {
  it("requests exactly /api/clubs/<id> with GET, no body and no query", async () => {
    const { calls, loader } = recorder(() => ok());
    await loader("club-a");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/clubs/club-a");
    expect(calls[0].url).not.toContain("?");
    expect(calls[0].init?.method ?? "GET").toBe("GET");
    expect(calls[0].init?.body).toBeUndefined();
    expect(calls[0].init?.credentials).toBe("same-origin");
  });

  it("only takes the club id, so a date cannot be passed", () => {
    expect(createClubDataLoader(() => ok()).length).toBe(1);
  });

  it("makes one request for concurrent calls and caches the document", async () => {
    const { calls, loader } = recorder(() => ok());
    const [a, b] = await Promise.all([loader("club-a"), loader("club-a")]);
    expect(a).toBe(b);
    await loader("club-a");
    expect(calls).toHaveLength(1);
  });

  it("rejects with http for a non-200 answer, network for a failed fetch, shape for bad content", async () => {
    expect(await kindOf(recorder(() => ok({ error: "unknown_club" }, 400)).loader("club-a"))).toBe(
      "http",
    );
    expect(await kindOf(recorder(() => ok(doc, 500)).loader("club-a"))).toBe("http");
    expect(
      await kindOf(recorder(() => Promise.reject(new TypeError("offline"))).loader("club-a")),
    ).toBe("network");
    expect(
      await kindOf(recorder(() => Promise.resolve(new Response("{ nope"))).loader("club-a")),
    ).toBe("shape");
    expect(await kindOf(recorder(() => ok({ ...doc, v: 2 })).loader("club-a"))).toBe("shape");
    expect(await kindOf(recorder(() => ok({ ...doc, clubId: "club-b" })).loader("club-a"))).toBe(
      "shape",
    );
    expect(await kindOf(recorder(() => ok({ ...doc, matches: "x" })).loader("club-a"))).toBe(
      "shape",
    );
  });

  it("fetches again after a failure", async () => {
    let attempt = 0;
    const { calls, loader } = recorder(() => (++attempt === 1 ? ok({}, 500) : ok()));
    expect(await kindOf(loader("club-a"))).toBe("http");
    expect(await kindOf(loader("club-a"))).toBe("resolved");
    expect(calls).toHaveLength(2);
  });

  it("keeps documents of different clubs apart", async () => {
    const other = { ...doc, clubId: "club-b" };
    const { calls, loader } = recorder((url) => ok(url.endsWith("club-b") ? other : doc));
    expect((await loader("club-a")).clubId).toBe("club-a");
    expect((await loader("club-b")).clubId).toBe("club-b");
    expect(calls).toHaveLength(2);
  });

  it("uses the global fetch by default", async () => {
    const original = globalThis.fetch;
    let seen = "";
    globalThis.fetch = ((url: string) => {
      seen = url;
      return ok();
    }) as typeof fetch;
    try {
      await createClubDataLoader()("club-a");
      expect(seen).toBe("/api/clubs/club-a");
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("isClubData", () => {
  it("accepts a real document", () => {
    expect(isClubData(doc, "club-a")).toBe(true);
  });

  it("rejects everything that is not a document of that club", () => {
    const match = doc.matches[0];
    const bad: unknown[] = [
      null,
      undefined,
      "x",
      5,
      [],
      {},
      { ...doc, v: CLUB_DATA_VERSION + 1 },
      { ...doc, clubId: "other" },
      ...[
        "clubs",
        "competitions",
        "seasons",
        "matches",
        "coverage",
        "titles",
        "movements",
        "rivalries",
      ].map((key) => ({ ...doc, [key]: null })),
      { ...doc, matches: [null] },
      { ...doc, matches: [{ ...match, id: 1 }] },
      { ...doc, matches: [{ ...match, date: undefined }] },
      { ...doc, matches: [{ ...match, home_id: 3 }] },
      { ...doc, matches: [{ ...match, away_id: null }] },
      { ...doc, matches: [{ ...match, season_id: {} }] },
    ];
    for (const value of bad) expect(isClubData(value, "club-a")).toBe(false);
  });
});
