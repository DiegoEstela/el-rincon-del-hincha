// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { notFound } from "next/navigation";
import NotFound from "@/app/rivales/[rival]/not-found";
import RivalryPage, * as pageModule from "@/app/rivales/[rival]/page";
import { CLUB_IDS } from "@/lib/club-data.server";

afterEach(cleanup);

describe("/rivales/[rival] page", () => {
  it("prerenders the 34 dataset ids", () => {
    const params = pageModule.generateStaticParams();
    expect(params).toHaveLength(34);
    expect(params.map((p) => p.rival)).toEqual(CLUB_IDS);
  });

  it("requires the complete route to be static", () => {
    expect(pageModule.ensureStatic).toBe("navigation");
  });

  it("renders the rival it was asked for", async () => {
    const element = await RivalryPage({ params: Promise.resolve({ rival: "boca-juniors" }) });
    expect(renderToString(element)).toContain("Boca");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("answers not found for an id outside the dataset, without echoing it", async () => {
    for (const bad of ["not-a-club", "..%2Fapi", "BOCA-JUNIORS", ""]) {
      await expect(RivalryPage({ params: Promise.resolve({ rival: bad }) })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    }
    expect(notFound).toHaveBeenCalledTimes(4);
  });
});

describe("/rivales/[rival] not-found", () => {
  it("is friendly, links back to /rivales and logs nothing", () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rivales/i })).toHaveAttribute("href", "/rivales");
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
