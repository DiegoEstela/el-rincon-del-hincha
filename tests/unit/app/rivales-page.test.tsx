// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import RivalsError from "@/app/rivales/error";
import RivalesPage, { metadata } from "@/app/rivales/page";

afterEach(cleanup);

describe("/rivales page", () => {
  it("is titled Rivales and prerenders both pending blocks, for CSS to choose", () => {
    expect(metadata.title).toBe("Rivales");
    const html = renderToString(<RivalesPage />);
    expect(html).toContain("pending-skeleton");
    expect(html).toContain("pending-empty");
    expect(html).toContain("Cargando tu historial…");
    expect(html).toContain("Todavía no elegiste tu club");
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("has the two pre-hydration rules in globals.css", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/html\[data-club\]\s+\.pending-empty\s*\{\s*display:\s*none/);
    expect(css).toMatch(/html:not\(\[data-club\]\)\s+\.pending-skeleton\s*\{\s*display:\s*none/);
  });
});

describe("/rivales error boundary", () => {
  it("shows the friendly error, retries with reset and logs nothing", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const reset = vi.fn();
    render(<RivalsError error={new Error("boom 1990-05-20")} reset={reset} />);
    expect(
      screen.getByRole("heading", { name: "Se nos cortó la transmisión" }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("boom");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledOnce();
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
