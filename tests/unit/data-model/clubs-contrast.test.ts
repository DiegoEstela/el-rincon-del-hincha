import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSelectable } from "@/data-model/club";
import { clubSchema } from "@/data-model/schemas";
import { contrastRatio, meetsAA } from "@/lib/contrast";
import { parseRootTokens } from "@/lib/css-tokens";

const clubs = clubSchema
  .array()
  .parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8").replace(/^﻿/, "")),
  )
  .filter(isSelectable);
const tokens = parseRootTokens(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"));
const background = tokens["background"];
const raised = tokens["background-raised"];
const accentContrast = tokens["accent-contrast"];

const fmt = (n: number) => n.toFixed(2);

describe("club colors contrast (ADR 0012)", () => {
  it("has a visible crest pattern: primary against secondary and tertiary at 3:1", () => {
    for (const c of clubs) {
      const { primary, secondary, tertiary } = c.colors;
      const r1 = contrastRatio(primary, secondary);
      expect(meetsAA(r1, "ui"), `${c.id}: primary/secondary ${fmt(r1)}`).toBe(true);
      if (tertiary !== undefined) {
        const r2 = contrastRatio(tertiary, primary);
        expect(meetsAA(r2, "ui"), `${c.id}: primary/tertiary ${fmt(r2)}`).toBe(true);
      }
    }
  });

  it("has readable crest initials on primary (4.5:1 with white or the accent contrast)", () => {
    for (const c of clubs) {
      const best = Math.max(
        contrastRatio("#ffffff", c.colors.primary),
        contrastRatio(accentContrast, c.colors.primary),
      );
      expect(best, `${c.id}: initials ${fmt(best)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("has at least one color usable as an accent on both app backgrounds", () => {
    for (const c of clubs) {
      const ratios = Object.values(c.colors).map((hex) =>
        Math.min(contrastRatio(hex, background), contrastRatio(hex, raised)),
      );
      const best = Math.max(...ratios);
      expect(meetsAA(best, "ui"), `${c.id}: best accent ${fmt(best)}`).toBe(true);
    }
  });
});
