// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Shelf } from "@/components/vitrina/shelf";
import { TrophyDetail } from "@/components/vitrina/trophy-detail";
import type { MatchCardView } from "@/lib/match-card-view";
import type { TrophyView } from "@/lib/vitrina-view";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

const match: MatchCardView = {
  date: "17 de enero de 2021",
  competition: "Copa Diego Armando Maradona 2020",
  home: { name: "Boca", goals: 1, isFan: true },
  away: { name: "Banfield", goals: 1, isFan: false },
  outcome: "D",
  result: "Empataste",
  note: "Ganaste 5 a 3 por penales",
  spoken: "Boca 1, Banfield 1",
};

const trophy = (extra: Partial<TrophyView["detail"]> = {}): TrophyView => ({
  id: "t1",
  year: "2021",
  seasonName: "Copa Diego Armando Maradona 2020",
  competitionName: "Copa de la Liga Profesional",
  kind: "cup",
  shared: false,
  buttonLabel: "Copa Diego Armando Maradona 2020, campeón el 17 de enero de 2021. Ver detalle",
  detail: {
    awardedOn: "17 de enero de 2021",
    matchHeading: "La final",
    match,
    noMatchLine: null,
    sharedWith: "Compartido con River.",
    sourceHost: "github.com",
    sourceUrl: "https://github.com/openfootball/x",
    criterion: "Contamos solo títulos reconocidos por la AFA.",
    recognized: true,
    ...extra,
  },
});

/** The shelf and the detail together, like the screen wires them. */
function Harness({ item = trophy() }: { item?: TrophyView }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <Shelf
        shelf={{
          key: "domestic",
          title: "Locales",
          trophies: [item],
          silhouettes: [],
          underConstruction: null,
        }}
        onOpen={setOpenId}
      />
      <TrophyDetail trophy={openId === null ? null : item} onClose={() => setOpenId(null)} />
    </>
  );
}

const opener = () => screen.getByRole("button", { name: /Ver detalle/ });

describe("TrophyDetail (plan 0018, T14)", () => {
  it("opens labelled by the season heading, modal, with the focus on the heading", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    const dialog = document.querySelector("dialog")!;
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Copa Diego Armando Maradona 2020",
    });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    expect(heading).toHaveFocus();
  });

  it("shows the date, the heading of the match, the card, the shared line, the source and the criterion", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    expect(screen.getByText("Campeón el 17 de enero de 2021")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "La final" })).toBeInTheDocument();
    expect(screen.getByText("Ganaste 5 a 3 por penales")).toBeInTheDocument();
    expect(screen.getByText("Boca 1, Banfield 1")).toBeInTheDocument();
    expect(screen.getByText("Compartido con River.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "github.com" });
    expect(link).toHaveAttribute("href", "https://github.com/openfootball/x");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(screen.getByText("Contamos solo títulos reconocidos por la AFA.")).toBeInTheDocument();
  });

  it("says there is no match when none is loaded, and has no shared line", async () => {
    render(
      <Harness
        item={trophy({
          match: null,
          noMatchLine: "No tenemos cargado el partido que lo definió.",
          sharedWith: null,
          matchHeading: "La última fecha",
        })}
      />,
    );
    await userEvent.click(opener());
    expect(screen.getByText("No tenemos cargado el partido que lo definió.")).toBeInTheDocument();
    expect(screen.queryByText(/Compartido con/)).toBeNull();
  });

  it("writes a source that is not an https link as plain text", async () => {
    render(<Harness item={trophy({ sourceHost: null, sourceUrl: "fixture:synthetic" })} />);
    await userEvent.click(opener());
    expect(screen.getByText("Fuente: fixture:synthetic")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("closes with the button and returns the focus to the trophy", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    expect(opener()).toHaveFocus();
  });

  it("closes when the dialog is dismissed (Escape) and when the backdrop is clicked", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    fireEvent(document.querySelector("dialog")!, new Event("close"));
    expect(opener()).toHaveFocus();
    await userEvent.click(opener());
    fireEvent.click(document.querySelector("dialog")!);
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("traps Tab inside: from the last control back to the first, and Shift+Tab the other way", async () => {
    render(<Harness />);
    await userEvent.click(opener());
    const close = screen.getByRole("button", { name: "Cerrar" });
    const link = screen.getByRole("link", { name: "github.com" });
    link.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(link).toHaveFocus();
    fireEvent.keyDown(document.querySelector("dialog")!, { key: "Enter" });
    expect(link).toHaveFocus();
  });

  it("renders an empty dialog when nothing is open", () => {
    render(<TrophyDetail trophy={null} onClose={() => undefined} />);
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    expect(screen.queryByRole("heading", { hidden: true })).toBeNull();
  });
});
