// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLUB_SLUG, clubThemeCss, themeBootScript } from "@/lib/club-theme-css";
import { FAN_STORAGE_KEY } from "@/lib/fan-storage";

describe("clubThemeCss", () => {
  it("emits one rule per club, in input order", () => {
    const css = clubThemeCss([
      { id: "river-plate", accent: "#ff6f64", accentContrast: "#0a1a00" },
      { id: "boca-juniors", accent: "#83a0d8", accentContrast: "#0a1a00" },
    ]);
    expect(css).toBe(
      'html[data-club="river-plate"]{--accent:#ff6f64;--accent-contrast:#0a1a00}' +
        'html[data-club="boca-juniors"]{--accent:#83a0d8;--accent-contrast:#0a1a00}',
    );
  });

  it("throws on an id that could break out of the selector", () => {
    expect(() =>
      clubThemeCss([{ id: 'x"]{}body{', accent: "#ff6f64", accentContrast: "#0a1a00" }]),
    ).toThrow(RangeError);
  });

  it("throws on a color that is not a 6-digit hex", () => {
    expect(() =>
      clubThemeCss([{ id: "river-plate", accent: "red", accentContrast: "#0a1a00" }]),
    ).toThrow(RangeError);
    expect(() =>
      clubThemeCss([{ id: "river-plate", accent: "#ff6f64", accentContrast: "#fff" }]),
    ).toThrow(RangeError);
  });
});

describe("CLUB_SLUG", () => {
  it("accepts slugs and rejects everything else", () => {
    expect(CLUB_SLUG.test("river-plate")).toBe(true);
    expect(CLUB_SLUG.test("a b")).toBe(false);
    expect(CLUB_SLUG.test("")).toBe(false);
    expect(CLUB_SLUG.test("-a")).toBe(false);
  });
});

describe("themeBootScript", () => {
  const run = () => new Function(themeBootScript())();
  const attr = () => document.documentElement.getAttribute("data-club");

  beforeEach(() => {
    document.documentElement.removeAttribute("data-club");
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("is a constant string that mentions only the storage key", () => {
    expect(themeBootScript()).toBe(themeBootScript());
    expect(themeBootScript()).toContain(FAN_STORAGE_KEY);
  });

  it("sets data-club from a valid record", () => {
    localStorage.setItem(
      FAN_STORAGE_KEY,
      JSON.stringify({ v: 1, clubId: "river-plate", startDate: "1990-05-20", startMode: "birth" }),
    );
    run();
    expect(attr()).toBe("river-plate");
  });

  it("leaves no attribute and does not throw on bad input", () => {
    const bad = [
      null,
      "{not json",
      "null",
      "[]",
      JSON.stringify({ v: 1 }),
      JSON.stringify({ v: 2, clubId: "river-plate" }),
      JSON.stringify({ v: 1, clubId: 7 }),
      JSON.stringify({ v: 1, clubId: "a b" }),
    ];
    for (const value of bad) {
      localStorage.clear();
      if (value !== null) localStorage.setItem(FAN_STORAGE_KEY, value);
      expect(run).not.toThrow();
      expect(attr()).toBeNull();
    }
  });

  it("does not throw when the localStorage getter throws", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(run).not.toThrow();
    expect(attr()).toBeNull();
  });
});
