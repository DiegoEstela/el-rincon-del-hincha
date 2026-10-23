// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BeforePeriod, Disputed } from "@/components/vitrina/before-period";
import { Checklist } from "@/components/vitrina/checklist";
import { Counters } from "@/components/vitrina/counters";
import { Shelf, TrophyButton } from "@/components/vitrina/shelf";
import { TrophyArt } from "@/components/vitrina/trophy-art";
import {
  EmptyPeriod,
  NoTitlesLoaded,
  VitrinaEmpty,
  VitrinaError,
  VitrinaSkeleton,
} from "@/components/vitrina/vitrina-states";
import type { ShelfView, TrophyKind, TrophyView } from "@/lib/vitrina-view";

afterEach(cleanup);

export const trophy = (extra: Partial<TrophyView> = {}): TrophyView => ({
  id: "t1",
  year: "2019",
  seasonName: "Superliga 2018-19",
  competitionName: "Primera División",
  kind: "league",
  shared: false,
  buttonLabel: "Superliga 2018-19, campeón el 7 de abril de 2019. Ver detalle",
  detail: {
    awardedOn: "7 de abril de 2019",
    matchHeading: "La última fecha",
    match: null,
    noMatchLine: "No tenemos cargado el partido que lo definió.",
    sharedWith: null,
    sourceHost: "www.rsssf.org",
    sourceUrl: "https://www.rsssf.org/x",
    criterion: "Contamos solo títulos reconocidos por la AFA.",
    recognized: true,
  },
  ...extra,
});

describe("TrophyArt (plan 0018, T11)", () => {
  const kinds: TrophyKind[] = ["league", "cup", "international", "other"];

  it("draws one decorative svg per kind: gold, muted or an outline", () => {
    for (const kind of kinds) {
      const gold = render(<TrophyArt kind={kind} tone="gold" />);
      const lit = gold.container.querySelector("svg")!;
      expect(lit).toHaveAttribute("aria-hidden", "true");
      expect(lit).toHaveClass("text-gold");
      expect(lit.dataset.kind).toBe(kind);
      expect(lit.querySelector("g")).toHaveAttribute("fill", "currentColor");
      gold.unmount();

      const outline = render(<TrophyArt kind={kind} tone="outline" />);
      const dim = outline.container.querySelector("svg")!;
      expect(dim).toHaveClass("text-muted");
      expect(dim.querySelector("g")).toHaveAttribute("fill", "none");
      outline.unmount();

      const muted = render(<TrophyArt kind={kind} tone="muted" />);
      expect(muted.container.querySelector("svg")).toHaveClass("text-muted");
      expect(muted.container.querySelector("g")).toHaveAttribute("fill", "currentColor");
      muted.unmount();
    }
  });

  it("gives each kind its own mark", () => {
    const marks = kinds.map((kind) => {
      const { container, unmount } = render(<TrophyArt kind={kind} tone="gold" />);
      const mark = container.querySelectorAll("path")[3].getAttribute("d");
      unmount();
      return mark;
    });
    expect(new Set(marks).size).toBe(4);
  });
});

const shelf = (extra: Partial<ShelfView> = {}): ShelfView => ({
  key: "domestic",
  title: "Locales",
  trophies: [
    trophy(),
    trophy({
      id: "t2",
      year: "2021",
      seasonName: "Liga 2021",
      shared: true,
      buttonLabel: "Liga 2021, campeón el 15 de diciembre de 2021. Ver detalle",
    }),
  ],
  silhouettes: [
    {
      competitionId: "copa",
      name: "Copa de la Liga",
      kind: "cup",
      caption: "No lo ganaste entre A y B.",
    },
  ],
  underConstruction: null,
  ...extra,
});

describe("Shelf (T12)", () => {
  it("has an h2, trophy buttons with their names and 44 px, and silhouettes that are not focusable", () => {
    render(<Shelf shelf={shelf()} onOpen={() => undefined} />);
    expect(screen.getByRole("heading", { level: 2, name: "Locales" })).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Superliga 2018-19, campeón el 7 de abril de 2019. Ver detalle",
    });
    expect(button).toHaveClass("min-h-11");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("Copa de la Liga")).toBeInTheDocument();
    expect(screen.getByText("Te falta")).toBeInTheDocument();
    expect(screen.getByText("No lo ganaste entre A y B.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("marks a shared title", () => {
    render(<Shelf shelf={shelf()} onOpen={() => undefined} />);
    expect(screen.getAllByText("Compartido")).toHaveLength(1);
  });

  it("opens the detail on click and on Enter", async () => {
    const onOpen = vi.fn();
    render(<Shelf shelf={shelf()} onOpen={onOpen} />);
    const button = screen.getAllByRole("button")[0];
    await userEvent.click(button);
    expect(onOpen).toHaveBeenLastCalledWith("t1");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("shows the under construction line, and nothing else when the shelf is empty", () => {
    const { rerender } = render(
      <Shelf
        shelf={shelf({ trophies: [], silhouettes: [], underConstruction: "En obra." })}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText("En obra.")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    rerender(
      <Shelf
        shelf={shelf({ trophies: [], silhouettes: [], underConstruction: null })}
        onOpen={() => undefined}
      />,
    );
    expect(screen.queryByText("En obra.")).toBeNull();
  });

  it("draws a muted trophy without the gold", () => {
    const { container } = render(<TrophyButton trophy={trophy()} onOpen={() => undefined} muted />);
    expect(container.querySelector("svg")).toHaveClass("text-muted");
    expect(container.querySelector("svg")).not.toHaveClass("text-gold");
  });
});

describe("Counters and Checklist (T13)", () => {
  it("shows both numbers with their labels and the caption", () => {
    render(
      <Counters
        counters={{
          wonLabel: "Trofeos ganados desde que naciste",
          won: 5,
          missingLabel: "Trofeos que te faltan",
          missing: 1,
          caption: "En los torneos y temporadas que tenemos cargados.",
        }}
      />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Trofeos ganados desde que naciste")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Trofeos que te faltan")).toBeInTheDocument();
    expect(
      screen.getByText("En los torneos y temporadas que tenemos cargados."),
    ).toBeInTheDocument();
  });

  it("lists a row per competition with text and an icon for each status", () => {
    const { container } = render(
      <Checklist
        rows={[
          { competitionId: "a", name: "Primera División", status: "won", label: "Ganado (2)" },
          { competitionId: "b", name: "Copa de la Liga", status: "missing", label: "Te falta" },
          { competitionId: "c", name: "Otra", status: "unknown", label: "Sin datos todavía" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Tu checklist" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.dataset.status)).toEqual(["won", "missing", "unknown"]);
    expect(within(rows[0]).getByText("Ganado (2)")).toBeInTheDocument();
    expect(container.querySelectorAll("li svg[aria-hidden='true']")).toHaveLength(3);
  });

  it("renders nothing without rows", () => {
    const { container } = render(<Checklist rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("BeforePeriod and Disputed (T15)", () => {
  it("shows a closed details block with the count and a button per title", async () => {
    const onOpen = vi.fn();
    const { container } = render(
      <BeforePeriod trophies={[trophy(), trophy({ id: "t2" })]} onOpen={onOpen} />,
    );
    const details = container.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("Antes de que llegaras (2)")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { hidden: true })[1]);
    expect(onOpen).toHaveBeenCalledWith("t2");
  });

  it("is hidden when there is nothing", () => {
    expect(
      render(<BeforePeriod trophies={[]} onOpen={() => undefined} />).container,
    ).toBeEmptyDOMElement();
    expect(
      render(<Disputed trophies={[]} onOpen={() => undefined} />).container,
    ).toBeEmptyDOMElement();
  });

  it("shows the disputed titles with the criterion, apart", () => {
    render(<Disputed trophies={[trophy({ id: "t7" })]} onOpen={() => undefined} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Títulos discutidos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No los contamos: no están reconocidos por la AFA."),
    ).toBeInTheDocument();
  });
});

describe("states (T16)", () => {
  it("the skeleton is busy, announced, and pulses only when motion is allowed", () => {
    const { container } = render(<VitrinaSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando tu vitrina…")).toHaveClass("sr-only");
    expect(container.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();
  });

  it("no club: the empty state links to the picker", () => {
    render(<VitrinaEmpty />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Todavía no elegiste tu club" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Elegir mi club" })).toHaveAttribute(
      "href",
      "/#elegi-tu-club",
    );
  });

  it("error: retries", async () => {
    const onRetry = vi.fn();
    render(<VitrinaError onRetry={onRetry} />);
    expect(
      screen.getByRole("heading", { name: "No pudimos abrir tu vitrina" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("no titles loaded: links to the rivals", () => {
    render(<NoTitlesLoaded />);
    expect(
      screen.getByRole("heading", { name: "Todavía no cargamos los títulos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver rivales" })).toHaveAttribute("href", "/rivales");
  });

  it("empty period", () => {
    render(<EmptyPeriod />);
    expect(
      screen.getByRole("heading", { name: "Tu historia todavía no empezó" }),
    ).toBeInTheDocument();
  });
});
