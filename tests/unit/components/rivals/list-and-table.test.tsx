// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RivalCardList } from "@/components/rivals/rival-card-list";
import { RivalsTable } from "@/components/rivals/rivals-table";
import { Dominance } from "@/domain/dominance";
import type { RivalRowView } from "@/lib/rivals-view";

afterEach(cleanup);

const crest = {
  initials: "VS",
  initialsInk: "#ffffff",
  pattern: "solid" as const,
  primary: "#112233",
  secondary: "#ffffff",
};
const rows: RivalRowView[] = [
  {
    rivalId: "velez",
    name: "Vélez Sarsfield",
    shortName: "Vélez",
    crest,
    played: 10,
    won: 6,
    drawn: 2,
    lost: 2,
    balance: 4,
    dominance: Dominance.Dominates,
    isClassic: false,
    bar: { won: 0.6, drawn: 0.2, lost: 0.2 },
    administrative: 1,
    shootouts: 0,
  },
  {
    rivalId: "union",
    name: "Unión",
    shortName: "Unión",
    crest: null,
    played: 3,
    won: 1,
    drawn: 1,
    lost: 1,
    balance: 0,
    dominance: Dominance.Even,
    isClassic: false,
    bar: { won: 1 / 3, drawn: 1 / 3, lost: 1 / 3 },
    administrative: 0,
    shootouts: 2,
  },
];

describe("RivalCardList (mobile)", () => {
  it("is a list named Rivales with one item per rival and hides from desktop", () => {
    render(<RivalCardList rows={rows} />);
    const list = screen.getByRole("list", { name: "Rivales" });
    expect(list.className).toContain("lg:hidden");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the record, the signed balance and the chip of each rival", () => {
    render(<RivalCardList rows={rows} />);
    const first = screen.getAllByRole("listitem")[0];
    expect(within(first).getByText("Vélez")).toBeInTheDocument();
    for (const [label, value] of [
      ["PJ", "10"],
      ["PG", "6"],
      ["PE", "2"],
      ["PP", "2"],
    ]) {
      expect(within(first).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(within(first).getByText("Saldo").nextElementSibling).toHaveTextContent("+4");
    expect(within(first).getByText("Dominás")).toBeInTheDocument();
    const second = screen.getAllByRole("listitem")[1];
    expect(within(second).getByText("Saldo").nextElementSibling).toHaveTextContent("0");
    expect(within(second).getByText("Parejo")).toBeInTheDocument();
  });

  it("marks administrative results and shoot-outs", () => {
    render(<RivalCardList rows={rows} />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByText("Incluye resultados administrativos")).toBeInTheDocument();
    expect(within(first).queryByText(/por penales/)).toBeNull();
    expect(within(second).getByText("2 por penales")).toBeInTheDocument();
    expect(within(second).queryByText(/administrativos/)).toBeNull();
  });

  it("renders a rival without a crest", () => {
    render(<RivalCardList rows={rows} />);
    expect(within(screen.getAllByRole("listitem")[1]).getByText("Unión")).toBeInTheDocument();
  });
});

describe("RivalsTable (desktop)", () => {
  const renderTable = (sort: "balance" | "played" | "name" = "balance") =>
    render(<RivalsTable rows={rows} sort={sort} competitions="Primera División" />);

  it("is a table hidden below the desktop breakpoint, with a caption naming the competitions", () => {
    renderTable();
    const table = screen.getByRole("table", {
      name: "Tu historial contra cada rival (Primera División)",
    });
    expect(table.parentElement).toHaveClass("hidden", "lg:block");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("has column headers with abbreviations that explain themselves", () => {
    renderTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.getAttribute("scope"))).toEqual(Array(8).fill("col"));
    expect(screen.getByText("PJ")).toHaveAttribute("title", "Partidos jugados");
    expect(screen.getByText("PG")).toHaveAttribute("title", "Partidos ganados");
    expect(screen.getByText("PE")).toHaveAttribute("title", "Partidos empatados");
    expect(screen.getByText("PP")).toHaveAttribute("title", "Partidos perdidos");
  });

  it("marks the sorted column with aria-sort", () => {
    renderTable("balance");
    expect(screen.getByRole("columnheader", { name: "Saldo" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByRole("columnheader", { name: "Rival" })).not.toHaveAttribute("aria-sort");
    cleanup();
    renderTable("played");
    expect(screen.getByRole("columnheader", { name: /PJ/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    cleanup();
    renderTable("name");
    expect(screen.getByRole("columnheader", { name: "Rival" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("shows one row per rival with the same numbers", () => {
    renderTable();
    const row = screen.getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Vélez");
    expect(cells.slice(1, 5).map((c) => c.textContent)).toEqual(["10", "6", "2", "2"]);
    expect(cells[5]).toHaveTextContent("+4");
    expect(within(row).getByText("Dominás")).toBeInTheDocument();
  });
});
