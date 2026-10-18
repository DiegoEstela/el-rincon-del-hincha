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

  it("prerenders both pending blocks with the rival and no date", async () => {
    const element = await RivalryPage({ params: Promise.resolve({ rival: "boca-juniors" }) });
    const html = renderToString(element);
    expect(html).toContain("Tu club vs. Boca");
    expect(html).toContain("pending-skeleton");
    expect(html).toContain("pending-empty");
    expect(html).toContain("Cargando el mano a mano…");
    expect(html).toContain("Todavía no elegiste tu club");
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("builds metadata from the public rival only, and asks not to be indexed", async () => {
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ rival: "boca-juniors" }),
    });
    expect(metadata.title).toBe("Boca Juniors · Rivales");
    expect(String(metadata.description)).toContain("Boca Juniors");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(
      await pageModule.generateMetadata({ params: Promise.resolve({ rival: "nope" }) }),
    ).toEqual({});
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
    expect(
      screen.getByRole("heading", { level: 1, name: "Ese rival no está en nuestro fixture" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver tus rivales" })).toHaveAttribute(
      "href",
      "/rivales",
    );
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
