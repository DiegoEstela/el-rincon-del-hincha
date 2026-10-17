// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RivalsScreen } from "@/components/rivals/rivals-screen";
import { sliceClubData, type ClubData } from "@/domain/club-data";
import { statsDataFrom } from "@/domain/data";
import { clearFanChoice, getBrowserStorage, writeFanChoice } from "@/lib/fan-storage";
import { toClubOption } from "@/lib/club-options";
import { statsWorld } from "../../../fixtures/domain/stats-world";

const world = statsWorld();
const data = statsDataFrom(world);
const clubs = world["clubs.json"].map(toClubOption);
const START = "2020-01-01";

const docFor = (clubId: string): ClubData => sliceClubData(data, clubId);
const save = (clubId: string, startDate = START) =>
  act(() => {
    writeFanChoice(window.localStorage, { v: 1, clubId, startDate, startMode: "other" });
  });

const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation(() => undefined),
);

beforeEach(() => {
  clearFanChoice(getBrowserStorage());
  window.localStorage.clear();
  consoleSpies.forEach((s) => s.mockClear());
});
afterEach(cleanup);

describe("RivalsScreen", () => {
  it("shows the empty state, and never loads anything, without a saved club", async () => {
    const loadData = vi.fn();
    render(<RivalsScreen clubs={clubs} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "Todavía no elegiste tu club" }),
    ).toBeInTheDocument();
    expect(loadData).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Elegí tu club" })).toHaveAttribute(
      "href",
      "/#elegi-tu-club",
    );
  });

  it("shows the skeleton while loading, then the title, the notice, the cards and the list", async () => {
    let resolve!: (doc: ClubData) => void;
    const loadData = vi.fn(() => new Promise<ClubData>((r) => (resolve = r)));
    save("club-a");
    render(<RivalsScreen clubs={clubs} loadData={loadData} />);
    expect(await screen.findByText("Cargando tu historial…")).toBeInTheDocument();
    await act(async () => resolve(docFor("club-a")));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. todos" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Contamos:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Historial favorable/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Rivales" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText(/^Desde enero de 2020 · /)).toBeInTheDocument();
  });

  it("calls the loader with the club id and nothing else", async () => {
    const loadData = vi.fn(async (id: string) => docFor(id));
    save("club-a");
    render(<RivalsScreen clubs={clubs} loadData={loadData} />);
    await screen.findByRole("heading", { level: 1 });
    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadData.mock.calls[0]).toEqual(["club-a"]);
  });

  it("shows the error and loads again on Reintentar", async () => {
    let attempt = 0;
    const loadData = vi.fn(async (id: string) => {
      if (++attempt === 1) throw new Error("network");
      return docFor(id);
    });
    save("club-a");
    render(<RivalsScreen clubs={clubs} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "Se nos cortó la transmisión" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. todos" }),
    ).toBeInTheDocument();
    expect(loadData).toHaveBeenCalledTimes(2);
  });

  it("changes the counts when the tournament type changes", async () => {
    save("club-a");
    render(<RivalsScreen clubs={clubs} loadData={async (id) => docFor(id)} />);
    await screen.findByRole("heading", { level: 1 });
    const before = screen.getAllByRole("link", { name: /Historial/ }).map((l) => l.textContent);
    await userEvent.click(screen.getByLabelText("Copas nacionales"));
    const after = screen.getAllByRole("link", { name: /Historial/ }).map((l) => l.textContent);
    expect(after).not.toEqual(before);
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByRole("link", { name: /Historial/ }).map((l) => l.textContent)).toEqual(
      before,
    );
  });

  it("does not bring back an old error when the fan returns to a club", async () => {
    let attemptsOfA = 0;
    const loadData = vi.fn((id: string) => {
      if (id === "club-b") return new Promise<ClubData>(() => undefined); // never answers
      if (++attemptsOfA === 1) return Promise.reject(new Error("network"));
      return Promise.resolve(docFor(id));
    });
    save("club-a");
    render(<RivalsScreen clubs={clubs} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "Se nos cortó la transmisión" }),
    ).toBeInTheDocument();
    save("club-b"); // B is still loading when the fan goes back to A
    expect(await screen.findByText("Cargando tu historial…")).toBeInTheDocument();
    save("club-a");
    // Right after switching back the old failure must not flash: it is loading again.
    expect(screen.queryByRole("heading", { name: "Se nos cortó la transmisión" })).toBeNull();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. todos" }),
    ).toBeInTheDocument();
  });

  it("loads the new club when the saved club changes", async () => {
    const loadData = vi.fn(async (id: string) => docFor(id));
    save("club-a");
    render(<RivalsScreen clubs={clubs} loadData={loadData} />);
    await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. todos" });
    save("club-b");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ficticio B vs. todos" }),
    ).toBeInTheDocument();
    expect(loadData.mock.calls.map((c) => c[0])).toEqual(["club-a", "club-b"]);
  });

  it("shows the no matches state when the start is after the last match", async () => {
    save("club-a", "2026-10-16");
    render(<RivalsScreen clubs={clubs} loadData={async (id) => docFor(id)} />);
    expect(await screen.findByText("Todavía no hay partidos para contar")).toBeInTheDocument();
  });

  it("never puts the start date in the page or in the console", async () => {
    const date = "1990-05-20";
    save("club-a", date);
    const { container } = render(
      <RivalsScreen clubs={clubs} loadData={async (id) => docFor(id)} />,
    );
    await screen.findByRole("heading", { level: 1 });
    expect(container.innerHTML).not.toContain(date);
    expect(container.innerHTML).not.toContain("20/05/1990");
    consoleSpies.forEach((spy) => {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(date);
    });
    expect(within(container).queryByText(/1990-05/)).toBeNull();
  });
});
