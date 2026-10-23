import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CLUB_OPTIONS, CLUB_THEME_CSS } from "@/lib/club-catalog.server";

const dataset = JSON.parse(
  readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8").replace(/^﻿/, ""),
) as { id: string; selectable?: boolean }[];
// Opponents (ADR 0022) are in the file but not in the catalog.
const selectable = dataset.filter((club) => club.selectable !== false);

describe("club catalog", () => {
  it("has the 34 clubs in dataset order", () => {
    expect(CLUB_OPTIONS).toHaveLength(34);
    expect(CLUB_OPTIONS.map((club) => club.id)).toEqual(selectable.map((club) => club.id));
    expect(dataset.length).toBeGreaterThan(selectable.length);
  });
  it("stays under 8 KB serialized (guards the home payload)", () => {
    expect(JSON.stringify(CLUB_OPTIONS).length).toBeLessThan(8 * 1024);
  });
  it("has one theme rule per club", () => {
    expect(CLUB_THEME_CSS.match(/html\[data-club="/g)).toHaveLength(34);
    expect(CLUB_THEME_CSS).toContain('html[data-club="river-plate"]{--accent:#ff6f64;');
  });
});
