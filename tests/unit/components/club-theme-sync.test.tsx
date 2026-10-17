// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClubThemeSync } from "@/components/club-theme-sync";
import { FAN_STORAGE_KEY } from "@/lib/fan-storage";

const root = document.documentElement;
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  root.removeAttribute("data-club");
  window.localStorage.clear();
});

describe("ClubThemeSync", () => {
  it("sets data-club from the saved club on mount", () => {
    window.localStorage.setItem(FAN_STORAGE_KEY, JSON.stringify({ v: 1, clubId: "river-plate" }));
    render(<ClubThemeSync />);
    expect(root.getAttribute("data-club")).toBe("river-plate");
  });
  it("does nothing without a saved club", () => {
    render(<ClubThemeSync />);
    expect(root.hasAttribute("data-club")).toBe(false);
  });
  it("does nothing and does not throw when the storage throws", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => render(<ClubThemeSync />)).not.toThrow();
    expect(root.hasAttribute("data-club")).toBe(false);
  });
});
