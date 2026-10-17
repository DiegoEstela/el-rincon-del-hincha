// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { applyClubTheme, savedClubId } from "@/lib/club-theme-dom";
import { FAN_STORAGE_KEY } from "@/lib/fan-storage";

const root = document.documentElement;
afterEach(() => root.removeAttribute("data-club"));

describe("applyClubTheme", () => {
  it("sets data-club", () => {
    applyClubTheme(root, "river-plate");
    expect(root.getAttribute("data-club")).toBe("river-plate");
  });
  it("replaces the previous club", () => {
    applyClubTheme(root, "river-plate");
    applyClubTheme(root, "racing-club");
    expect(root.getAttribute("data-club")).toBe("racing-club");
  });
  it("removes the attribute for null", () => {
    applyClubTheme(root, "river-plate");
    applyClubTheme(root, null);
    expect(root.hasAttribute("data-club")).toBe(false);
  });
  it("ignores an id that is not a slug", () => {
    applyClubTheme(root, "river-plate");
    applyClubTheme(root, 'x"]{}body{');
    expect(root.getAttribute("data-club")).toBe("river-plate");
  });
});

describe("savedClubId", () => {
  const record = (value: unknown) => JSON.stringify(value);
  it("reads the club of a version 1 record", () => {
    expect(savedClubId(record({ v: 1, clubId: "river-plate" }))).toBe("river-plate");
  });
  it("is null for no record, bad JSON, another shape or version, or a non-slug id", () => {
    expect(savedClubId(null)).toBeNull();
    expect(savedClubId("{oops")).toBeNull();
    expect(savedClubId("7")).toBeNull();
    expect(savedClubId("null")).toBeNull();
    expect(savedClubId(record({ v: 2, clubId: "river-plate" }))).toBeNull();
    expect(savedClubId(record({ v: 1, clubId: 5 }))).toBeNull();
    expect(savedClubId(record({ v: 1, clubId: "a b" }))).toBeNull();
  });
  it("uses the same key as the boot script", () => {
    expect(FAN_STORAGE_KEY).toBe("rincon-del-hincha:fan");
  });
});
