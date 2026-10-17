// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFanChoice } from "@/components/fan/use-fan-choice";
import {
  clearFanChoice,
  FAN_STORAGE_KEY,
  getBrowserStorage,
  writeFanChoice,
} from "@/lib/fan-storage";

const ids = new Set(["river-plate", "boca-juniors"]);

function Probe() {
  const choice = useFanChoice(ids);
  const text = choice === "unknown" ? "unknown" : choice === null ? "none" : `${choice.clubId}`;
  return <p data-testid="choice">{text}</p>;
}

beforeEach(() => {
  clearFanChoice(getBrowserStorage());
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useFanChoice", () => {
  it("is unknown on the server, so the prerendered HTML and hydration agree", () => {
    expect(renderToString(<Probe />)).toContain("unknown");
  });

  it("is none after mount when nothing is saved", () => {
    render(<Probe />);
    expect(screen.getByTestId("choice")).toHaveTextContent("none");
  });

  it("returns the saved choice after mount", () => {
    window.localStorage.setItem(
      FAN_STORAGE_KEY,
      JSON.stringify({ v: 1, clubId: "river-plate", startDate: "1990-05-20", startMode: "birth" }),
    );
    render(<Probe />);
    expect(screen.getByTestId("choice")).toHaveTextContent("river-plate");
  });

  it("treats a record of an unknown club or a broken record as no choice", () => {
    window.localStorage.setItem(
      FAN_STORAGE_KEY,
      JSON.stringify({ v: 1, clubId: "nope", startDate: "1990-05-20", startMode: "birth" }),
    );
    render(<Probe />);
    expect(screen.getByTestId("choice")).toHaveTextContent("none");
    cleanup();
    window.localStorage.setItem(FAN_STORAGE_KEY, "{ not json");
    render(<Probe />);
    expect(screen.getByTestId("choice")).toHaveTextContent("none");
  });

  it("is none when the browser blocks the storage", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<Probe />);
    expect(screen.getByTestId("choice")).toHaveTextContent("none");
  });

  it("follows a save made in the same tab", () => {
    render(<Probe />);
    expect(screen.getByTestId("choice")).toHaveTextContent("none");
    act(() => {
      writeFanChoice(window.localStorage, {
        v: 1,
        clubId: "boca-juniors",
        startDate: "2001-01-01",
        startMode: "other",
      });
    });
    expect(screen.getByTestId("choice")).toHaveTextContent("boca-juniors");
  });
});
