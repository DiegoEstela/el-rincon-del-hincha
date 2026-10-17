// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HumorSections } from "@/components/rivals/humor-sections";
import { RivalCardList } from "@/components/rivals/rival-card-list";
import { RivalsTable } from "@/components/rivals/rivals-table";
import { Dominance } from "@/domain/dominance";
import type { RivalRowView } from "@/lib/rivals-view";

afterEach(cleanup);

const row = (id: string, shortName: string, balance: number): RivalRowView => ({
  rivalId: id,
  name: shortName,
  shortName,
  crest: null,
  played: 4,
  won: 2,
  drawn: 1,
  lost: 1,
  balance,
  dominance: Dominance.Even,
  isClassic: false,
  bar: { won: 0.5, drawn: 0.25, lost: 0.25 },
  administrative: 0,
  shootouts: 0,
});
const rows = [row("boca-juniors", "Boca", 3), row("union", "Unión", 0)];

describe("links to the rivalry detail", () => {
  it("makes each card one link named after the rival, to its detail", () => {
    render(<RivalCardList rows={rows} />);
    const items = within(screen.getByRole("list", { name: "Rivales" })).getAllByRole("listitem");
    for (const item of items) expect(within(item).getAllByRole("link")).toHaveLength(1);
    const link = screen.getByRole("link", { name: "Boca, ver el mano a mano" });
    expect(link).toHaveAttribute("href", "/rivales/boca-juniors");
    expect(link.className).toContain("after:absolute");
    expect(link.className).toContain("after:inset-0");
    expect(link).toHaveClass("focus-visible:outline-2");
    expect(link.closest("li")).toHaveClass("relative");
  });

  it("keeps the visible name first in the accessible name", () => {
    render(<RivalCardList rows={rows} />);
    const link = screen.getByRole("link", { name: /^Unión/ });
    expect(link).toHaveTextContent("Unión, ver el mano a mano");
    expect(link.querySelector(".sr-only")).not.toBeNull();
  });

  it("does not make the chip focusable", () => {
    render(<RivalCardList rows={rows} />);
    expect(screen.getAllByRole("link")).toHaveLength(rows.length);
  });

  it("puts the link in the Rival cell of the table and no handler on the row", () => {
    render(<RivalsTable rows={rows} sort="balance" competitions="Primera División" />);
    const table = screen.getByRole("table", { hidden: true });
    const body = within(table).getAllByRole("row", { hidden: true }).slice(1);
    for (const tr of body) {
      expect(within(tr).getAllByRole("link", { hidden: true })).toHaveLength(1);
      expect(tr.getAttribute("onclick")).toBeNull();
    }
    const link = within(table).getByRole("link", {
      name: "Boca, ver el mano a mano",
      hidden: true,
    });
    expect(link).toHaveAttribute("href", "/rivales/boca-juniors");
    expect(link).toHaveClass("h-12");
    expect(link.className).not.toContain("after:absolute");
  });

  it("makes the humor rows links", () => {
    render(<HumorSections sections={{ favorable: [rows[0]], even: [rows[1]], unfavorable: [] }} />);
    expect(screen.getByRole("link", { name: "Boca, ver el mano a mano" })).toHaveAttribute(
      "href",
      "/rivales/boca-juniors",
    );
    expect(screen.getByRole("link", { name: "Unión, ver el mano a mano" })).toHaveAttribute(
      "href",
      "/rivales/union",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
