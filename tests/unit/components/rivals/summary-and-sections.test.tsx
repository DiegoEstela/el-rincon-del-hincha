// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DominanceChip } from "@/components/rivals/dominance-chip";
import { HumorSections } from "@/components/rivals/humor-sections";
import { RecordBar } from "@/components/rivals/record-bar";
import { RivalsSummary } from "@/components/rivals/rivals-summary";
import { Dominance } from "@/domain/dominance";
import { formatBalance, matchesLine, pluralRivals } from "@/lib/rivals-format";
import type { RivalRowView } from "@/lib/rivals-view";

afterEach(cleanup);

const row = (id: string, name: string, balance: number, played = 4): RivalRowView => ({
  rivalId: id,
  name,
  shortName: name,
  crest: null,
  played,
  won: 0,
  drawn: 0,
  lost: 0,
  balance,
  dominance:
    balance >= 2 ? Dominance.Dominates : balance <= -2 ? Dominance.Dominated : Dominance.Even,
  isClassic: false,
  bar: { won: 0.5, drawn: 0.25, lost: 0.25 },
  administrative: 0,
  shootouts: 0,
});

describe("formatting", () => {
  it("shows the sign of the balance and nothing for zero", () => {
    expect(formatBalance(6)).toBe("+6");
    expect(formatBalance(-2)).toBe("-2");
    expect(formatBalance(0)).toBe("0");
  });

  it("uses the singular for one rival", () => {
    expect(pluralRivals(1)).toBe("1 rival");
    expect(pluralRivals(0)).toBe("0 rivales");
    expect(pluralRivals(12)).toBe("12 rivales");
  });
});

describe("matchesLine", () => {
  it("counts matches and rivals with singular and plural", () => {
    expect(matchesLine(312, 33)).toBe("312 partidos contra 33 rivales");
    expect(matchesLine(1, 1)).toBe("1 partido contra 1 rival");
    expect(matchesLine(5, 1)).toBe("5 partidos contra 1 rival");
  });
});

describe("DominanceChip", () => {
  it.each([
    [Dominance.Dominates, "Dominás", "text-win"],
    [Dominance.Even, "Parejo", "text-even"],
    [Dominance.Dominated, "Te domina", "text-loss"],
  ])("shows %s as %s with its color, a 5%% tint and an icon", (dominance, label, color) => {
    render(<DominanceChip dominance={dominance} />);
    const chip = screen.getByText(label);
    expect(chip.closest("span[data-dominance]")).toHaveAttribute("data-dominance", dominance);
    expect(chip.closest("span[data-dominance]")?.className).toContain(color);
    expect(chip.closest("span[data-dominance]")?.className).toMatch(/bg-(win|even|loss)\/5/);
    expect(
      chip.closest("span[data-dominance]")?.querySelector("svg[aria-hidden='true']"),
    ).not.toBeNull();
  });

  it("is not interactive", () => {
    render(<DominanceChip dominance={Dominance.Even} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("RecordBar", () => {
  it("is decorative, with three segments in W, D, L order sized by the shares", () => {
    const { container } = render(<RecordBar bar={{ won: 0.5, drawn: 0.25, lost: 0.25 }} />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    const segments = [...bar.children] as HTMLElement[];
    expect(segments.map((s) => s.dataset.segment)).toEqual(["won", "drawn", "lost"]);
    expect(segments.map((s) => s.style.width)).toEqual(["50%", "25%", "25%"]);
    expect(segments[0].className).toContain("bg-win");
    expect(segments[1].className).toContain("bg-even");
    expect(segments[2].className).toContain("bg-loss");
  });

  it("animates only when motion is allowed", () => {
    const { container } = render(<RecordBar bar={{ won: 1, drawn: 0, lost: 0 }} />);
    const classes = (container.firstElementChild as HTMLElement).className;
    expect(classes).toContain("motion-safe:");
    expect(classes).not.toMatch(/(^|\s)animate-/);
  });
});

describe("RivalsSummary", () => {
  it("shows the three counts as links to the three sections", () => {
    render(<RivalsSummary summary={{ favorable: 21, even: 1, unfavorable: 0 }} />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "#los-tenes-de-hijos",
      "#historia-pareja",
      "#te-tienen-de-hijo",
    ]);
    expect(within(links[0]).getByText("Historial favorable")).toBeInTheDocument();
    expect(within(links[0]).getByText("21 rivales")).toBeInTheDocument();
    expect(within(links[1]).getByText("Historial igualado")).toBeInTheDocument();
    expect(within(links[1]).getByText("1 rival")).toBeInTheDocument();
    expect(within(links[2]).getByText("Historial desfavorable")).toBeInTheDocument();
    expect(within(links[2]).getByText("0 rivales")).toBeInTheDocument();
  });

  it("gives every card a touch target of at least 44 px", () => {
    render(<RivalsSummary summary={{ favorable: 1, even: 1, unfavorable: 1 }} />);
    for (const link of screen.getAllByRole("link")) expect(link.className).toContain("min-h-11");
  });
});

describe("HumorSections", () => {
  const sections = {
    favorable: [row("b", "Vélez", 5), row("c", "Colón", 3)],
    even: [],
    unfavorable: [row("d", "Unión", -4)],
  };

  it("has the three headings with their ids and the jokes", () => {
    render(<HumorSections sections={sections} />);
    expect(screen.getByRole("heading", { level: 2, name: "Los tenés de hijos" })).toHaveAttribute(
      "id",
      "los-tenes-de-hijos",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Historia pareja" })).toHaveAttribute(
      "id",
      "historia-pareja",
    );
    expect(screen.getByRole("heading", { level: 2, name: "Te tienen de hijo" })).toHaveAttribute(
      "id",
      "te-tienen-de-hijo",
    );
    expect(
      screen.getByText("Desde que llegaste, contra estos la historia es tuya."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Duele, pero hay revancha: el próximo partido puede cambiarlo."),
    ).toBeInTheDocument();
  });

  it("lists the rows with name and balance, and an empty line for an empty group", () => {
    render(<HumorSections sections={sections} />);
    const favorable = screen.getByRole("region", { name: "Los tenés de hijos" });
    expect(within(favorable).getAllByRole("listitem")).toHaveLength(2);
    expect(within(favorable).getByText("Vélez")).toBeInTheDocument();
    expect(within(favorable).getByText("Saldo +5")).toBeInTheDocument();
    const unfavorable = screen.getByRole("region", { name: "Te tienen de hijo" });
    expect(within(unfavorable).getByText("Saldo -4")).toBeInTheDocument();
    expect(
      screen.getByText("Acá no hay medias tintas: o los tenés de hijos o te tienen de hijo."),
    ).toBeInTheDocument();
  });

  it("uses the empty lines of the other groups", () => {
    render(
      <HumorSections
        sections={{ favorable: [], even: [row("e", "Talleres", 0)], unfavorable: [] }}
      />,
    );
    expect(
      screen.getByText(
        "Todavía no tenés hijos futboleros. Paciencia, que la tuya se sigue jugando.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Nadie te tiene de hijo. Mirá vos.")).toBeInTheDocument();
  });
});
