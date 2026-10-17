// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoverageNotice } from "@/components/coverage/coverage-notice";
import {
  RivalsEmpty,
  RivalsError,
  RivalsNoMatches,
  RivalsSkeleton,
} from "@/components/rivals/rivals-states";
import { RivalsFilters, type FiltersState } from "@/components/rivals/rivals-filters";
import { CUPS_NOT_LOADED } from "@/lib/coverage-copy";

afterEach(cleanup);

const options = { years: [2018, 2019, 2020, 2021], types: ["league", "national_cup"] as const };

function Harness({ initial, count = 5 }: { initial?: Partial<FiltersState>; count?: number }) {
  const [state, setState] = useState<FiltersState>({
    fromYear: 2018,
    toYear: 2021,
    type: "all",
    sort: "balance",
    ...initial,
  });
  const active = state.fromYear !== 2018 || state.toYear !== 2021 || state.type !== "all";
  return (
    <RivalsFilters
      state={state}
      options={options}
      count={count}
      active={active}
      onChange={(next) => setState((s) => ({ ...s, ...next }))}
      onReset={() => setState({ fromYear: 2018, toYear: 2021, type: "all", sort: state.sort })}
    />
  );
}

describe("RivalsFilters", () => {
  it("has labelled Desde and Hasta selects with the year options", async () => {
    render(<Harness />);
    const from = screen.getByRole("combobox", { name: "Desde" });
    const to = screen.getByRole("combobox", { name: "Hasta" });
    expect(
      within(from)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["2018", "2019", "2020", "2021"]);
    expect(from).toHaveValue("2018");
    expect(to).toHaveValue("2021");
    await userEvent.selectOptions(from, "2020");
    expect(from).toHaveValue("2020");
  });

  it("moves Hasta up when Desde passes it, and Desde down when Hasta goes below it", async () => {
    render(<Harness initial={{ fromYear: 2018, toYear: 2019 }} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Desde" }), "2021");
    expect(screen.getByRole("combobox", { name: "Hasta" })).toHaveValue("2021");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Hasta" }), "2019");
    expect(screen.getByRole("combobox", { name: "Desde" })).toHaveValue("2019");
  });

  it("offers only the tournament types it was given, as a radio group", async () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Torneo" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => (r as HTMLInputElement).labels?.[0].textContent),
    ).toEqual(["Todos", "Liga", "Copas nacionales"]);
    await userEvent.click(within(group).getByLabelText("Liga"));
    expect(within(group).getByLabelText("Liga")).toBeChecked();
  });

  it("sorts with a labelled select", async () => {
    render(<Harness />);
    const sort = screen.getByRole("combobox", { name: "Ordenar por" });
    expect(
      within(sort)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Saldo", "Partidos", "Nombre"]);
    await userEvent.selectOptions(sort, "name");
    expect(sort).toHaveValue("name");
  });

  it("shows Limpiar filtros only with active filters and restores the defaults", async () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Desde" }), "2020");
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getByRole("combobox", { name: "Desde" })).toHaveValue("2018");
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
  });

  it("announces the number of rivals in a polite live region", () => {
    const { rerender } = render(<Harness count={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("Mostrando 1 rival");
    rerender(<Harness count={12} />);
    expect(screen.getByRole("status")).toHaveTextContent("Mostrando 12 rivales");
  });

  it("gives every control a touch target of at least 44 px", () => {
    render(<Harness initial={{ fromYear: 2019 }} />);
    for (const el of [
      ...screen.getAllByRole("combobox"),
      ...screen.getAllByRole("radio").map((r) => r.closest("label")!),
      screen.getByRole("button", { name: "Limpiar filtros" }),
    ]) {
      expect(el.className).toContain("min-h-11");
    }
  });
});

describe("CoverageNotice", () => {
  const copy = {
    show: true,
    heading: "Tu historial puede estar incompleto",
    lead: "Estos números cuentan solo los partidos que tenemos cargados.",
    lines: ["Primera División: tenemos todos los partidos desde agosto de 2018."],
  };

  it("shows the heading, the lead and a line per competition as a note", () => {
    render(<CoverageNotice copy={copy} included="Contamos: Primera División." />);
    const note = screen.getByRole("note");
    expect(within(note).getByText("Tu historial puede estar incompleto")).toBeInTheDocument();
    expect(within(note).getByText(copy.lead)).toBeInTheDocument();
    expect(within(note).getByText(copy.lines[0])).toBeInTheDocument();
  });

  it("always says what is counted and that some cups are not loaded", () => {
    render(<CoverageNotice copy={copy} included="Contamos: Primera División." />);
    expect(screen.getByText("Contamos: Primera División.")).toBeInTheDocument();
    expect(screen.getByText(CUPS_NOT_LOADED)).toBeInTheDocument();
  });

  it("shows only those two lines when the notice is hidden, and never claims a complete history", () => {
    const { container } = render(
      <CoverageNotice
        copy={{ show: false, heading: "", lead: "", lines: [] }}
        included="Contamos: Primera División."
      />,
    );
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByText("Contamos: Primera División.")).toBeInTheDocument();
    expect(screen.getByText(CUPS_NOT_LOADED)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/historial completo|cobertura completa/i);
    expect(
      container.querySelector("svg[data-check], .lucide-check, .lucide-circle-check"),
    ).toBeNull();
  });
});

describe("states", () => {
  it("skeleton is busy and says it is loading for screen readers", () => {
    const { container } = render(<RivalsSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando tu historial…")).toHaveClass("sr-only");
    expect(container.innerHTML).toContain("motion-safe:animate-pulse");
  });

  it("empty state invites to choose a club", () => {
    render(<RivalsEmpty />);
    expect(
      screen.getByRole("heading", { name: "Todavía no elegiste tu club" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Elegí tu club y desde cuándo sos hincha, y te mostramos a quién tenés de hijo.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegí tu club" })).toHaveAttribute(
      "href",
      "/#elegi-tu-club",
    );
  });

  it("no-matches state offers to clear the filters only when they are active", async () => {
    const onReset = vi.fn();
    const { rerender } = render(<RivalsNoMatches filtersActive={false} onReset={onReset} />);
    expect(screen.getByText("Todavía no hay partidos para contar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
    rerender(<RivalsNoMatches filtersActive onReset={onReset} />);
    expect(
      screen.getByText("Con estos filtros no hay partidos. Probá con otro rango o torneo."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("error state retries and goes home", async () => {
    const onRetry = vi.fn();
    render(<RivalsError onRetry={onRetry} />);
    expect(
      screen.getByRole("heading", { name: "Se nos cortó la transmisión" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No pudimos cargar tu historial. Revisá tu conexión y probá de nuevo."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });
});
