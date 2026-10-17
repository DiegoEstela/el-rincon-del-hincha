// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartDateStep } from "@/components/onboarding/start-date-step";
import type { StartMode } from "@/lib/fan-storage";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({ submitError = null }: { submitError?: "empty" | null }) {
  const [mode, setMode] = useState<StartMode>("birth");
  const [value, setValue] = useState("");
  return (
    <StartDateStep
      mode={mode}
      onModeChange={setMode}
      value={value}
      onValueChange={setValue}
      submitError={submitError}
      inputRef={{ current: null }}
    />
  );
}

const input = () => screen.getByLabelText(/Tu fecha de nacimiento|¿Desde qué fecha\?/);

describe("StartDateStep", () => {
  it("defaults to the birth date", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /Desde que nací/ })).toBeChecked();
    expect(screen.getByLabelText("Tu fecha de nacimiento")).toBeInTheDocument();
    expect(screen.getByText("Paso 2 de 2")).toBeInTheDocument();
    expect(screen.getByText(/Tu fecha se guarda solo en este dispositivo/)).toBeInTheDocument();
  });
  it("switches the label and keeps the value", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "1990-05-20" } });
    await user.click(screen.getByRole("radio", { name: /Desde otra fecha/ }));
    expect(screen.getByLabelText("¿Desde qué fecha?")).toHaveValue("1990-05-20");
    expect(screen.queryByLabelText("Tu fecha de nacimiento")).toBeNull();
  });
  it("has no name attribute (never reaches a form post) and the min bound", () => {
    render(<Harness />);
    expect(input()).not.toHaveAttribute("name");
    expect(input()).toHaveAttribute("min", "1880-01-01");
    expect(input()).toHaveAttribute("type", "date");
  });
  it("sets max to today in Buenos Aires after mount", () => {
    render(<Harness />);
    expect(input()).toHaveAttribute("max", "2026-10-16");
  });
  it("shows an accessible error for a future date on blur and clears it when valid", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "2026-12-01" } });
    fireEvent.blur(input());
    const message = screen.getByText(/Eso todavía no se jugó/);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input().getAttribute("aria-describedby")).toContain(message.id);
    fireEvent.change(input(), { target: { value: "2020-01-01" } });
    fireEvent.blur(input());
    expect(screen.queryByText(/Eso todavía no se jugó/)).toBeNull();
    expect(input()).not.toHaveAttribute("aria-invalid");
  });
  it("shows the too early message", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "1879-12-31" } });
    fireEvent.blur(input());
    expect(screen.getByText(/Tan atrás no llegamos/)).toBeInTheDocument();
  });
  it("does not complain about an empty date on blur", () => {
    render(<Harness />);
    fireEvent.blur(input());
    expect(input()).not.toHaveAttribute("aria-invalid");
  });
  it("shows the error that comes from submit", () => {
    render(<Harness submitError="empty" />);
    expect(screen.getByText("Poné una fecha para arrancar.")).toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-invalid", "true");
  });
});
