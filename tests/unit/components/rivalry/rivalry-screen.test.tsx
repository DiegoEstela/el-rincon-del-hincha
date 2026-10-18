// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domain/head-to-head", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/head-to-head")>();
  return { ...actual, headToHead: vi.fn(actual.headToHead) };
});

import { RivalryScreen } from "@/components/rivalry/rivalry-screen";
import { sliceClubData, type ClubData } from "@/domain/club-data";
import { statsDataFrom } from "@/domain/data";
import { headToHead } from "@/domain/head-to-head";
import { toClubOption } from "@/lib/club-options";
import { clearFanChoice, getBrowserStorage, writeFanChoice } from "@/lib/fan-storage";
import { statsWorld } from "../../../fixtures/domain/stats-world";

const world = statsWorld();
const data = statsDataFrom(world);
const clubs = world["clubs.json"].map(toClubOption);
const rival = clubs.find((c) => c.id === "club-b")!;
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
  vi.mocked(headToHead).mockClear();
});
afterEach(cleanup);

describe("RivalryScreen", () => {
  it("shows the empty state and loads nothing without a saved club", async () => {
    const loadData = vi.fn();
    render(<RivalryScreen clubs={clubs} rival={rival} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "Todavía no elegiste tu club" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /^Tu club vs\./ })).toBeInTheDocument();
    expect(loadData).not.toHaveBeenCalled();
    expect(headToHead).not.toHaveBeenCalled();
  });

  it("says it is the fan's club, and neither loads nor computes", async () => {
    const loadData = vi.fn();
    save("club-b");
    render(<RivalryScreen clubs={clubs} rival={rival} loadData={loadData} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Ese es tu club" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver tus rivales" })).toHaveAttribute(
      "href",
      "/rivales",
    );
    expect(loadData).not.toHaveBeenCalled();
    expect(headToHead).not.toHaveBeenCalled();
  });

  it("shows the skeleton, then the content in order, loading only the two club ids", async () => {
    let resolve!: (doc: ClubData) => void;
    const loadData = vi.fn((id: string) =>
      id === "club-a" ? new Promise<ClubData>((r) => (resolve = r)) : Promise.resolve(docFor(id)),
    );
    save("club-a");
    render(<RivalryScreen clubs={clubs} rival={rival} loadData={loadData} />);
    expect(await screen.findByText("Cargando el mano a mano…")).toBeInTheDocument();
    await act(async () => resolve(docFor("club-a")));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. Ficticio B" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "El historial",
      "Lo que está en juego",
      "El último partido",
      "Rachas",
      "Goleadas",
      "Finales entre ustedes",
    ]);
    expect(screen.getByText(/Contamos:/)).toBeInTheDocument();
    expect(screen.getByText(/Todavía no cargamos Copa Argentina/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/cobertura completa|historial completo/i);
    expect(loadData.mock.calls.map((c) => c.join())).toEqual(["club-a", "club-b"]);
    expect(headToHead).toHaveBeenCalled();
  });

  it("shows the never-met card for a rival without matches in the period", async () => {
    save("club-a", "2026-10-16");
    render(<RivalryScreen clubs={clubs} rival={rival} loadData={async (id) => docFor(id)} />);
    expect(await screen.findByRole("heading", { name: "Todavía no se cruzaron" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "El historial" })).toBeNull();
  });

  it("shows the error when the rival document fails and loads it again on Reintentar", async () => {
    let failing = true;
    const loadData = vi.fn(async (id: string) => {
      if (id === "club-b" && failing) throw new Error("network");
      return docFor(id);
    });
    save("club-a");
    render(<RivalryScreen clubs={clubs} rival={rival} loadData={loadData} />);
    expect(
      await screen.findByRole("heading", { name: "Se nos cortó la transmisión" }),
    ).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. Ficticio B" }),
    ).toBeInTheDocument();
  });

  it("loads the new club when the saved club changes", async () => {
    const loadData = vi.fn(async (id: string) => docFor(id));
    save("club-a");
    render(<RivalryScreen clubs={clubs} rival={rival} loadData={loadData} />);
    await screen.findByRole("heading", { level: 1, name: "Ficticio A vs. Ficticio B" });
    save("club-c");
    await screen.findByRole("heading", { level: 1, name: "Ficticio C vs. Ficticio B" });
    // The real loader caches by id; this mock does not, so the rival is asked for again.
    expect(loadData.mock.calls.map((c) => c[0])).toEqual(["club-a", "club-b", "club-c", "club-b"]);
  });

  it("never puts the start date in the page or in the console", async () => {
    const date = "1990-05-20";
    save("club-a", date);
    const { container } = render(
      <RivalryScreen clubs={clubs} rival={rival} loadData={async (id) => docFor(id)} />,
    );
    await screen.findByRole("heading", { level: 2, name: "El historial" });
    expect(container.innerHTML).not.toContain(date);
    expect(container.innerHTML).not.toContain("20/05/1990");
    consoleSpies.forEach((spy) => {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(date);
    });
  });
});
