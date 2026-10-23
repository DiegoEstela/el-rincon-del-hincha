// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vitrina-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vitrina-view")>();
  return { ...actual, buildVitrinaView: vi.fn(actual.buildVitrinaView) };
});

import { VitrinaScreen } from "@/components/vitrina/vitrina-screen";
import { sliceClubData, type ClubData } from "@/domain/club-data";
import { statsDataFrom } from "@/domain/data";
import { toClubOptions } from "@/lib/club-options";
import { clearFanChoice, getBrowserStorage, writeFanChoice } from "@/lib/fan-storage";
import { buildVitrinaView } from "@/lib/vitrina-view";
import { statsWorld } from "../../../fixtures/domain/stats-world";

const world = statsWorld();
const data = statsDataFrom(world);
const clubs = toClubOptions(world["clubs.json"]);
const START = "2020-01-01";

const docFor = (clubId: string): ClubData => sliceClubData(data, clubId);
const save = (clubId: string, startDate = START) =>
  act(() => {
    writeFanChoice(window.localStorage, { v: 1, clubId, startDate, startMode: "birth" });
  });

const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation(() => undefined),
);

beforeEach(() => {
  clearFanChoice(getBrowserStorage());
  window.localStorage.clear();
  consoleSpies.forEach((s) => s.mockClear());
  vi.mocked(buildVitrinaView).mockClear();
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

describe("VitrinaScreen (plan 0018, T17)", () => {
  it("renders both pending blocks before the choice is known", () => {
    // The server snapshot of the choice is "unknown": the screen prerenders both blocks.
    const { container } = render(<VitrinaScreen clubs={clubs} loadData={vi.fn()} />);
    expect(container.querySelector(".pending-skeleton, .pending-empty, h1")).not.toBeNull();
  });

  it("shows the empty state and loads nothing without a saved club", async () => {
    const loadData = vi.fn();
    render(<VitrinaScreen clubs={clubs} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "Todavía no elegiste tu club" }),
    ).toBeInTheDocument();
    expect(loadData).not.toHaveBeenCalled();
    expect(buildVitrinaView).not.toHaveBeenCalled();
  });

  it("shows the skeleton, then the content in order, loading only the club id", async () => {
    let resolve!: (doc: ClubData) => void;
    const loadData = vi.fn(() => new Promise<ClubData>((r) => (resolve = r)));
    save("club-a");
    render(<VitrinaScreen clubs={clubs} loadData={loadData} />);
    expect(await screen.findByText("Cargando tu vitrina…")).toBeInTheDocument();
    await act(async () => resolve(docFor("club-a")));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Mi vitrina" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ficticio A · desde enero de 2020/)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Internacionales",
      "Locales",
      "Otros",
      "Tu checklist",
      "Títulos discutidos",
    ]);
    expect(screen.getByRole("note")).toHaveTextContent("Tu vitrina puede estar incompleta");
    expect(screen.getByText(/^Todavía no cargamos Copa Argentina/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/(?<!in)complet[ao]\b|toda la historia/i);
    expect(loadData.mock.calls).toEqual([["club-a"]]);
  });

  it("opens the detail of a trophy and closes it", async () => {
    save("club-a");
    render(<VitrinaScreen clubs={clubs} loadData={async (id) => docFor(id)} />);
    await screen.findByRole("heading", { level: 2, name: "Locales" });
    const button = screen.getAllByRole("button", { name: /Ver detalle/ })[0];
    await userEvent.click(button);
    expect(document.querySelector("dialog")).toHaveAttribute("open");
    expect(screen.getByText(/^Campeón el /)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    expect(button).toHaveFocus();
  });

  it("shows the error when the document fails and loads it again on Reintentar", async () => {
    let attempt = 0;
    const loadData = vi.fn(async (id: string) => {
      if (++attempt === 1) throw new Error("network");
      return docFor(id);
    });
    save("club-a");
    render(<VitrinaScreen clubs={clubs} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "No pudimos abrir tu vitrina" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Locales" })).toBeInTheDocument();
  });

  it("says the titles are not loaded when the document has none", async () => {
    save("club-a");
    const bare = async (id: string) => ({ ...docFor(id), titles: [] });
    render(<VitrinaScreen clubs={clubs} loadData={bare} />);
    expect(
      await screen.findByRole("heading", { name: "Todavía no cargamos los títulos" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Trofeos que te faltan")).toBeNull();
    expect(screen.getByRole("link", { name: "Ver rivales" })).toHaveAttribute("href", "/rivales");
  });

  it("loads the new club when the saved club changes", async () => {
    const loadData = vi.fn(async (id: string) => docFor(id));
    save("club-a");
    render(<VitrinaScreen clubs={clubs} loadData={loadData} />);
    await screen.findByText(/Ficticio A · desde/);
    save("club-b");
    expect(await screen.findByText(/Ficticio B · desde/)).toBeInTheDocument();
    expect(loadData.mock.calls.map((c) => c[0])).toEqual(["club-a", "club-b"]);
  });

  it("never puts the start date in the page or in the console", async () => {
    const date = "1990-05-20";
    save("club-a", date);
    const { container } = render(
      <VitrinaScreen clubs={clubs} loadData={async (id) => docFor(id)} />,
    );
    await screen.findByRole("heading", { level: 2, name: "Locales" });
    expect(container.innerHTML).not.toContain(date);
    expect(container.innerHTML).not.toContain("20/05/1990");
    consoleSpies.forEach((spy) => {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(date);
    });
  });
});
