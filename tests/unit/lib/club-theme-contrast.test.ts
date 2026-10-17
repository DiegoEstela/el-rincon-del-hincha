import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clubSchema } from "@/data-model/schemas";
import { accentSurfaces, deriveClubTheme, pickAccentBase } from "@/lib/club-theme";
import { contrastRatio } from "@/lib/contrast";
import { parseRootTokens } from "@/lib/css-tokens";
import { hexToOklch } from "@/lib/oklch";

const clubs = clubSchema
  .array()
  .parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8").replace(/^﻿/, "")),
  );
const tokens = parseRootTokens(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"));
const fmt = (n: number) => n.toFixed(2);

describe("accent surfaces match the CSS tokens", () => {
  it("uses the background, raised and glass values of globals.css", () => {
    const s = accentSurfaces("#c6ff3d");
    expect(s.background).toBe(tokens["background"]);
    expect(s.raised).toBe(tokens["background-raised"]);
    expect(tokens["glass"]).toBe("rgb(255 255 255 / 0.06)");
  });
});

describe("club themes over the whole dataset (AA, acceptance criterion of #40)", () => {
  it("covers 34 clubs", () => {
    expect(clubs).toHaveLength(34);
  });

  for (const club of clubs) {
    const { accent, accentContrast } = deriveClubTheme(club.colors);
    const surfaces = accentSurfaces(accent);

    it(`${club.id}: accent text is >= 4.5:1 on all six surfaces`, () => {
      for (const [name, surface] of Object.entries(surfaces)) {
        const ratio = contrastRatio(accent, surface);
        expect(ratio, `${club.id} on ${name}: ${fmt(ratio)}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${club.id}: accent-contrast is >= 4.5:1 on the accent and the focus ring >= 3:1`, () => {
      expect(contrastRatio(accentContrast, accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accent, surfaces.background)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(accent, surfaces.tint)).toBeGreaterThanOrEqual(3);
    });

    it(`${club.id}: the other text tokens stay >= 4.5:1 on the worst surface with its glow`, () => {
      for (const name of ["foreground", "muted", "gold", "win", "even", "loss"]) {
        for (const [surfaceName, surface] of Object.entries(surfaces)) {
          const ratio = contrastRatio(tokens[name], surface);
          expect(
            ratio,
            `${club.id}: ${name} on ${surfaceName} ${fmt(ratio)}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${club.id}: the hue drifts less than 5 degrees from its base`, () => {
      const base = pickAccentBase(club.colors);
      if (hexToOklch(base).c < 0.04) return; // neutral base: no hue to keep
      const d = Math.abs(hexToOklch(base).h - hexToOklch(accent).h);
      expect(Math.min(d, 360 - d)).toBeLessThan(5);
    });
  }

  it("pins the approved accent per club (plan 0008, approved by Diego on 2026-10-16)", () => {
    expect(Object.fromEntries(clubs.map((c) => [c.id, deriveClubTheme(c.colors).accent]))).toEqual({
      aldosivi: "#ffd60a",
      "argentinos-juniors": "#ff6f64",
      // Added by plan 0012 (2026-10-17): derived by the same algorithm, reviewed for AA below.
      arsenal: "#a9d6f5",
      colon: "#ff6f64",
      "independiente-rivadavia": "#83a0d8",
      patronato: "#ff6f64",
      "san-martin-tucuman": "#ff6f64",
      "atletico-tucuman": "#4da5f2",
      banfield: "#41b46a",
      "barracas-central": "#ff6f64",
      belgrano: "#4da5f2",
      "boca-juniors": "#83a0d8",
      "central-cordoba-sde": "#ffffff",
      "defensa-y-justicia": "#ffd60a",
      "deportivo-riestra": "#ffffff",
      "estudiantes-la-plata": "#ff6f64",
      "gimnasia-la-plata": "#83a0d8",
      "godoy-cruz": "#719dff",
      huracan: "#ff6f64",
      independiente: "#ff6f64",
      instituto: "#ff6f64",
      lanus: "#e67f94",
      "newells-old-boys": "#ff6f64",
      platense: "#c49677",
      "racing-club": "#4da5f2",
      "river-plate": "#ff6f64",
      "rosario-central": "#719dff",
      "san-lorenzo": "#83a0d8",
      "san-martin-san-juan": "#41b46a",
      "sarmiento-junin": "#41b46a",
      "talleres-cordoba": "#83a0d8",
      tigre: "#83a0d8",
      union: "#ff6f64",
      "velez-sarsfield": "#719dff",
    });
  });
});
