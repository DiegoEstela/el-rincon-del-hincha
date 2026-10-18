// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FinalsPanel } from "@/components/rivalry/finals-panel";
import { GoleadasPanel } from "@/components/rivalry/goleadas-panel";
import { MatchCard, ResultPill } from "@/components/rivalry/match-card";
import { RecordPanel } from "@/components/rivalry/record-panel";
import { RivalryHeader } from "@/components/rivalry/rivalry-header";
import { NeverMet, RivalrySkeleton, SameClub } from "@/components/rivalry/rivalry-states";
import { StakesPanel } from "@/components/rivalry/stakes-panel";
import { StreaksPanel } from "@/components/rivalry/streaks-panel";
import { Dominance } from "@/domain/dominance";
import type { ClubOption } from "@/lib/club-options";
import type { FinalView, MatchCardView, RivalryView } from "@/lib/rivalry-view";

afterEach(cleanup);

const crest = {
  initials: "A",
  initialsInk: "#ffffff",
  pattern: "solid" as const,
  primary: "#112233",
  secondary: "#ffffff",
};
const club = (id: string, shortName: string): ClubOption => ({
  id,
  name: shortName,
  shortName,
  searchKeys: [],
  crest,
});

const match = (extra: Partial<MatchCardView> = {}): MatchCardView => ({
  date: "27 de abril de 2025",
  competition: "Primera División · Liga Profesional 2025",
  home: { name: "River", goals: 2, isFan: true },
  away: { name: "Boca", goals: 1, isFan: false },
  outcome: "W",
  result: "Ganaste",
  note: null,
  spoken: "River 2, Boca 1",
  ...extra,
});

describe("RivalryHeader", () => {
  it("has a 44 px back link, decorative crests, the title and the sub-line", () => {
    const { container } = render(
      <RivalryHeader
        title="River vs. Boca"
        subline="Desde mayo de 1990 · 8 partidos"
        own={club("river-plate", "River")}
        rival={club("boca-juniors", "Boca")}
      />,
    );
    const back = screen.getByRole("link", { name: "Volver a Rivales" });
    expect(back).toHaveAttribute("href", "/rivales");
    expect(back).toHaveClass("min-h-11");
    expect(screen.getByRole("heading", { level: 1, name: "River vs. Boca" })).toBeInTheDocument();
    expect(screen.getByText("Desde mayo de 1990 · 8 partidos")).toBeInTheDocument();
    expect(container.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThanOrEqual(3);
  });

  it("works before the club or the sub-line are known", () => {
    render(
      <RivalryHeader
        title="Tu club vs. Boca"
        subline={null}
        own={null}
        rival={club("boca-juniors", "Boca")}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Tu club vs. Boca" })).toBeInTheDocument();
    expect(screen.queryByText(/Desde/)).toBeNull();
  });
});

const record = (extra: Partial<RivalryView["record"]> = {}): RivalryView["record"] => ({
  played: 8,
  won: 5,
  drawn: 2,
  lost: 1,
  balance: "+4",
  goalsFor: 10,
  goalsAgainst: 5,
  dominance: Dominance.Dominates,
  bar: { won: 0.625, drawn: 0.25, lost: 0.125 },
  administrative: 0,
  shootouts: 0,
  ...extra,
});

describe("RecordPanel", () => {
  it("shows the numbers, the balance, the chip, the goals and the bar", () => {
    const { container } = render(<RecordPanel record={record()} />);
    expect(screen.getByRole("heading", { level: 2, name: "El historial" })).toBeInTheDocument();
    const terms = screen.getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["PJ", "PG", "PE", "PP", "Saldo"]);
    expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual([
      "8",
      "5",
      "2",
      "1",
      "+4",
    ]);
    expect(screen.getByText("Dominás")).toBeInTheDocument();
    expect(screen.getByText("Goles: 10 a 5")).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true'][class*='rounded-full']")).not.toBeNull();
    expect(screen.queryByText(/administrativos|por penales/)).toBeNull();
  });

  it("marks administrative results and shoot-outs", () => {
    const { rerender } = render(<RecordPanel record={record({ administrative: 1 })} />);
    expect(screen.getByText("Incluye resultados administrativos")).toBeInTheDocument();
    rerender(<RecordPanel record={record({ shootouts: 2 })} />);
    expect(screen.getByText("2 por penales")).toBeInTheDocument();
    rerender(<RecordPanel record={record({ administrative: 1, shootouts: 2 })} />);
    expect(
      screen.getByText("Incluye resultados administrativos · 2 por penales"),
    ).toBeInTheDocument();
  });
});

describe("StakesPanel and StreaksPanel", () => {
  it("lists the lines with decorative icons, and hides without lines", () => {
    const { container, rerender } = render(
      <StakesPanel
        lines={[
          "Con 2 triunfos más pasás a dominar este historial.",
          "Ojo: con 1 derrota más te pasan a dominar.",
          "Estás a 1 victoria de las 10 contra Boca desde que naciste.",
          "Tenés colchón: haría falta 1 derrota más para que esto vuelva a estar parejo.",
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Lo que está en juego" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(container.querySelectorAll("li svg[aria-hidden='true']")).toHaveLength(4);
    rerender(<StakesPanel lines={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the headline and the best run, or only the best run", () => {
    const { rerender } = render(
      <StreaksPanel
        streak={{ headline: "Venís de 3 triunfos seguidos.", best: "Tu mejor racha." }}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Rachas" })).toBeInTheDocument();
    expect(screen.getByText("Venís de 3 triunfos seguidos.")).toBeInTheDocument();
    rerender(<StreaksPanel streak={{ headline: null, best: "Todavía no le ganaste." }} />);
    expect(screen.queryByText(/Venís/)).toBeNull();
    expect(screen.getByText("Todavía no le ganaste.")).toBeInTheDocument();
  });
});

describe("MatchCard", () => {
  it("shows date, competition, a spoken score, the visual score hidden and the fan in bold", () => {
    const { container } = render(<MatchCard match={match()} />);
    expect(screen.getByText(/27 de abril de 2025 · Primera División/)).toBeInTheDocument();
    expect(screen.getByText("River 2, Boca 1")).toHaveClass("sr-only");
    const visual = container.querySelector("p[aria-hidden='true']") as HTMLElement;
    expect(visual.textContent).toBe("River 2 - Boca 1");
    expect(within(visual).getByText("River 2")).toHaveClass("font-bold");
    expect(within(visual).getByText("Boca 1")).not.toHaveClass("font-bold");
    expect(screen.getByText("Ganaste")).toBeInTheDocument();
  });

  it("shows a note, and the pill has text and an icon for every outcome", () => {
    render(<MatchCard match={match({ note: "Ganaste 5 a 3 por penales" })} />);
    expect(screen.getByText("Ganaste 5 a 3 por penales")).toBeInTheDocument();
    cleanup();
    for (const [outcome, label] of [
      ["W", "Ganaste"],
      ["D", "Empataste"],
      ["L", "Perdiste"],
    ] as const) {
      const { container, unmount } = render(<ResultPill outcome={outcome} label={label} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
      unmount();
    }
  });
});

describe("ResultPill colors", () => {
  it("uses the colors and the 5% tint the palette contrast test checks for the chips", () => {
    for (const [outcome, token] of [
      ["W", "win"],
      ["D", "even"],
      ["L", "loss"],
    ] as const) {
      const { container, unmount } = render(<ResultPill outcome={outcome} label="x" />);
      const pill = container.firstElementChild!;
      expect(pill).toHaveClass(`text-${token}`, `bg-${token}/5`);
      unmount();
    }
  });
});

describe("GoleadasPanel", () => {
  it("shows both cards, or the empty lines", () => {
    const { rerender } = render(
      <GoleadasPanel
        biggestWin={match()}
        biggestLoss={match({ outcome: "L", result: "Perdiste" })}
        noBiggestWin="sin mejor"
        noBiggestLoss="sin peor"
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Goleadas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "La mejor" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "La que más dolió" })).toBeInTheDocument();
    expect(screen.getByText("Perdiste")).toBeInTheDocument();
    rerender(
      <GoleadasPanel
        biggestWin={null}
        biggestLoss={null}
        noBiggestWin="sin mejor"
        noBiggestLoss="sin peor"
      />,
    );
    expect(screen.getByText("sin mejor")).toBeInTheDocument();
    expect(screen.getByText("sin peor")).toBeInTheDocument();
  });
});

describe("FinalsPanel", () => {
  const series: FinalView = {
    season: "Copa Diego Armando Maradona 2020",
    winner: "Ganaste la final",
    legs: [
      {
        ...match({ note: "Ganaste 5 a 3 por penales", outcome: "D", result: "Empataste" }),
        beforePeriod: false,
      },
      { ...match(), beforePeriod: true },
    ],
  };

  it("lists each series with its winner, legs and the before-the-period mark", () => {
    render(<FinalsPanel finals={[series]} empty="vacío" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Finales entre ustedes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Copa Diego Armando Maradona 2020")).toBeInTheDocument();
    expect(screen.getByText("Ganaste la final")).toBeInTheDocument();
    expect(screen.getByText("Ganaste 5 a 3 por penales")).toBeInTheDocument();
    expect(screen.getAllByText("(antes de tu período)")).toHaveLength(1);
    expect(
      screen.getByText("Contamos solo las finales de los torneos que tenemos cargados."),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/completa|completo/i);
  });

  it("shows the empty line", () => {
    render(<FinalsPanel finals={[]} empty="No se cruzaron en ninguna final." />);
    expect(screen.getByText("No se cruzaron en ninguna final.")).toBeInTheDocument();
  });
});

describe("states", () => {
  it("the skeleton is busy, says it is loading and pulses only with motion allowed", () => {
    const { container } = render(<RivalrySkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando el mano a mano…")).toHaveClass("sr-only");
    expect(container.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();
  });

  it("the same club card links back to the rivals", () => {
    render(<SameClub />);
    expect(screen.getByRole("heading", { level: 1, name: "Ese es tu club" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver tus rivales" })).toHaveAttribute(
      "href",
      "/rivales",
    );
  });

  it("the never met card names both clubs", () => {
    render(<NeverMet club="Aldosivi" rival="Riestra" />);
    expect(screen.getByRole("heading", { name: "Todavía no se cruzaron" })).toBeInTheDocument();
    expect(
      screen.getByText("En tu período no hay partidos cargados entre Aldosivi y Riestra."),
    ).toBeInTheDocument();
  });
});
