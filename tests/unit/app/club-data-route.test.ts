import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET, generateStaticParams } from "@/app/api/clubs/[clubId]/route";

const call = (clubId: string) =>
  GET(new Request(`http://localhost/api/clubs/${clubId}`), {
    params: Promise.resolve({ clubId }),
  });

const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation(() => undefined),
);
afterEach(() => spies.forEach((s) => s.mockClear()));

describe("GET /api/clubs/[clubId]", () => {
  it("answers 200 with the JSON slice of a known club", async () => {
    const response = await call("river-plate");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as { v: number; clubId: string; matches: unknown[] };
    expect(body.v).toBe(1);
    expect(body.clubId).toBe("river-plate");
    expect(body.matches.length).toBeGreaterThan(100);
  });

  it("answers 400 with exactly an error code for an unknown or malformed id, and does not echo it", async () => {
    for (const bad of ["nope", "BOCA-JUNIORS", "../etc/passwd", "x".repeat(5000), ""]) {
      const response = await call(bad);
      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toBe('{"error":"unknown_club"}');
    }
  });

  it("prerenders the 34 clubs", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(34);
    expect(params[0]).toEqual({ clubId: expect.any(String) });
    expect(new Set(params.map((p) => p.clubId)).size).toBe(34);
  });

  it("never writes to the console", async () => {
    await call("river-plate");
    await call("nope");
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
