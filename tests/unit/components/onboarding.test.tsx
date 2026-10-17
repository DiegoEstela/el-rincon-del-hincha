// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Onboarding } from "@/components/onboarding/onboarding";
import { clubSchema } from "@/data-model/schemas";
import { toClubOption } from "@/lib/club-options";
import {
  FAN_STORAGE_KEY,
  clearFanChoice,
  getBrowserStorage,
  writeFanChoice,
} from "@/lib/fan-storage";
import clubsJson from "../../../data/clubs.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const clubs = clubSchema.array().parse(clubsJson).map(toClubOption);
const root = document.documentElement;
const DATE = "1990-05-20";
const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
  vi.spyOn(console, m).mockImplementation(() => {}),
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  clearFanChoice(getBrowserStorage());
  window.localStorage.clear();
  root.removeAttribute("data-club");
  push.mockReset();
  consoleSpies.forEach((spy) => spy.mockClear());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const dateInput = () => screen.getByLabelText(/Tu fecha de nacimiento|¿Desde qué fecha\?/);
const search = () => screen.getByRole("searchbox", { name: "Buscá tu club" });
const cta = () => screen.getByRole("button", { name: "Ver mi historia" });
const pickRiver = () => fireEvent.click(screen.getByRole("radio", { name: /River/ }));
const saved = () => window.localStorage.getItem(FAN_STORAGE_KEY);
const seed = (clubId: string) =>
  window.localStorage.setItem(
    FAN_STORAGE_KEY,
    JSON.stringify({ v: 1, clubId, startDate: DATE, startMode: "birth" }),
  );

describe("Onboarding submit", () => {
  it("asks for a club first and focuses the group", () => {
    render(<Onboarding clubs={clubs} />);
    fireEvent.change(dateInput(), { target: { value: DATE } });
    fireEvent.click(cta());
    expect(screen.getByText("Primero elegí tu club.")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
    expect(saved()).toBeNull();
  });
  it("asks for the date and focuses the input", () => {
    render(<Onboarding clubs={clubs} />);
    pickRiver();
    fireEvent.click(cta());
    expect(screen.getByText("Poné una fecha para arrancar.")).toBeInTheDocument();
    expect(dateInput()).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });
  it("saves the choice and goes to /vitrina with no query", () => {
    render(<Onboarding clubs={clubs} />);
    pickRiver();
    fireEvent.change(dateInput(), { target: { value: DATE } });
    fireEvent.click(cta());
    expect(JSON.parse(saved()!)).toEqual({
      v: 1,
      clubId: "river-plate",
      startDate: DATE,
      startMode: "birth",
    });
    expect(push).toHaveBeenCalledExactlyOnceWith("/vitrina");
  });
  it("saves the other mode", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Onboarding clubs={clubs} />);
    pickRiver();
    await user.click(screen.getByRole("radio", { name: /Desde otra fecha/ }));
    fireEvent.change(dateInput(), { target: { value: DATE } });
    fireEvent.click(cta());
    expect(JSON.parse(saved()!).startMode).toBe("other");
  });
  it("goes on when the browser refuses to save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    render(<Onboarding clubs={clubs} />);
    pickRiver();
    fireEvent.change(dateInput(), { target: { value: DATE } });
    fireEvent.click(cta());
    expect(push).toHaveBeenCalledExactlyOnceWith("/vitrina");
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows the future date error from submit and does not navigate", () => {
    render(<Onboarding clubs={clubs} />);
    pickRiver();
    fireEvent.change(dateInput(), { target: { value: "2026-12-01" } });
    fireEvent.click(cta());
    expect(screen.getByText(/Eso todavía no se jugó/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Onboarding theme preview", () => {
  it("previews the selected club and restores the saved one on unmount", () => {
    seed("racing-club");
    const { unmount } = render(<Onboarding clubs={clubs} />);
    expect(root.getAttribute("data-club")).toBe("racing-club");
    pickRiver();
    expect(root.getAttribute("data-club")).toBe("river-plate");
    unmount();
    expect(root.getAttribute("data-club")).toBe("racing-club");
  });
  it("removes the preview on unmount when nothing was saved", () => {
    const { unmount } = render(<Onboarding clubs={clubs} />);
    pickRiver();
    expect(root.getAttribute("data-club")).toBe("river-plate");
    unmount();
    expect(root.hasAttribute("data-club")).toBe(false);
  });
});

describe("Onboarding returning visitor", () => {
  it("shows the banner with the club name and links to the history", () => {
    seed("river-plate");
    render(<Onboarding clubs={clubs} />);
    expect(screen.getByText("¡Volviste!")).toBeInTheDocument();
    expect(
      screen.getByText(/Sos de River Plate\. Tu historia te está esperando\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver mi historia" })).toHaveAttribute(
      "href",
      "/vitrina",
    );
  });
  it("has no banner for a visitor without a saved choice", () => {
    render(<Onboarding clubs={clubs} />);
    expect(screen.queryByText("¡Volviste!")).toBeNull();
  });
  it("ignores a saved club that left the dataset", () => {
    seed("club-que-no-existe");
    render(<Onboarding clubs={clubs} />);
    expect(screen.queryByText("¡Volviste!")).toBeNull();
  });
  it("'Cambiar club o fecha' focuses the search box", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    seed("river-plate");
    render(<Onboarding clubs={clubs} />);
    await user.click(screen.getByRole("button", { name: "Cambiar club o fecha" }));
    expect(search()).toHaveFocus();
    expect(screen.getByRole("radio", { name: /River/ })).toBeChecked();
  });
  it("shows the banner right after a choice is saved in this tab", () => {
    render(<Onboarding clubs={clubs} />);
    expect(screen.queryByText("¡Volviste!")).toBeNull();
    act(
      () =>
        void writeFanChoice(getBrowserStorage(), {
          v: 1,
          clubId: "river-plate",
          startDate: DATE,
          startMode: "birth",
        }),
    );
    expect(screen.getByText("¡Volviste!")).toBeInTheDocument();
  });
});

describe("Onboarding privacy", () => {
  it("never logs the date and never renders it outside the input value", () => {
    const { container } = render(<Onboarding clubs={clubs} />);
    pickRiver();
    fireEvent.change(dateInput(), { target: { value: DATE } });
    fireEvent.blur(dateInput());
    fireEvent.click(cta());
    for (const spy of consoleSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(DATE);
    }
    const html = container.innerHTML.replace(/value="[^"]*"/g, "");
    expect(html).not.toContain(DATE);
    expect(html).not.toContain("20/05/1990");
    expect(container.querySelector("form")).not.toHaveAttribute("action");
    expect(dateInput()).not.toHaveAttribute("name");
  });
});
