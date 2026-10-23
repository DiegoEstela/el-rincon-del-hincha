// @vitest-environment jsdom
import { cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import VitrinaPage, { metadata } from "@/app/vitrina/page";

afterEach(cleanup);

describe("/vitrina page (plan 0018, T18)", () => {
  it("is titled Mi vitrina, with a description that has no fan data", () => {
    expect(metadata.title).toBe("Mi vitrina");
    expect(String(metadata.description)).toBe(
      "Los trofeos que ganó tu club desde que sos hincha, y los que todavía te faltan.",
    );
  });

  it("prerenders the h1 and both pending blocks, for CSS to choose, with no date", () => {
    const html = renderToString(<VitrinaPage />);
    expect(html).toContain("Mi vitrina");
    expect(html).toContain("pending-skeleton");
    expect(html).toContain("pending-empty");
    expect(html).toContain("Cargando tu vitrina…");
    expect(html).toContain("Todavía no elegiste tu club");
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
