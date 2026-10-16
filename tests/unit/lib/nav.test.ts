import { describe, expect, it } from "vitest";
import { INFO_ITEMS, NAV_ITEMS, isActiveRoute } from "@/lib/nav";

describe("NAV_ITEMS", () => {
  it("lists the four sections in order", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual(["Inicio", "Vitrina", "Rivales", "Comparar"]);
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/", "/vitrina", "/rivales", "/comparar"]);
  });
});

describe("isActiveRoute", () => {
  it("matches home only on the root", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/vitrina", "/")).toBe(false);
  });

  it("matches exact and nested routes", () => {
    expect(isActiveRoute("/vitrina", "/vitrina")).toBe(true);
    expect(isActiveRoute("/vitrina/2024", "/vitrina")).toBe(true);
  });

  it("respects the segment boundary", () => {
    expect(isActiveRoute("/vitrinas", "/vitrina")).toBe(false);
  });

  it("matches nothing for routes outside the nav", () => {
    for (const item of NAV_ITEMS) expect(isActiveRoute("/acerca", item.href)).toBe(false);
  });
});

describe("INFO_ITEMS", () => {
  it("lists Acerca and Privacidad in order", () => {
    expect(INFO_ITEMS.map((i) => i.label)).toEqual(["Acerca", "Privacidad"]);
    expect(INFO_ITEMS.map((i) => i.href)).toEqual(["/acerca", "/privacidad"]);
    expect(isActiveRoute("/acerca", "/acerca")).toBe(true);
  });
});
