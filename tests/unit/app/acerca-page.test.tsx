// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AcercaPage from "@/app/acerca/page";
import { loadManifest } from "../../../scripts/ingest/rsssf/manifest";

afterEach(cleanup);

describe("/acerca (RSSSF credit, plan 0017)", () => {
  it("keeps the credits of the creator and the original idea", () => {
    render(<AcercaPage />);
    expect(screen.getByText("Diego Estela Lopez")).toBeInTheDocument();
    expect(screen.getByText("Juan Farre")).toBeInTheDocument();
  });

  it("thanks the author of every page we use and RSSSF, with links", () => {
    render(<AcercaPage />);
    const manifest = loadManifest("sources/rsssf");
    for (const author of manifest.pages.flatMap((p) => p.authors)) {
      expect(document.body.textContent).toContain(author);
    }
    expect(document.body.textContent).toMatch(/Muchas gracias a .* y a la RSSSF/);
    expect(screen.getByRole("link", { name: "rsssf.org" })).toHaveAttribute(
      "href",
      "https://www.rsssf.org/",
    );
    for (const page of manifest.pages) {
      expect(document.querySelector(`a[href="${page.url}"]`)).not.toBeNull();
    }
  });

  it("says the permission covers the first division only", () => {
    render(<AcercaPage />);
    expect(document.body.textContent).toContain("primera división argentina");
  });
});
