import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { foldName, resolveClubId } from "@/data-model/club-aliases";
import { CLUB_PALETTE } from "@/data-model/club-palette";
import { clubSchema } from "@/data-model/schemas";
import { validate } from "@/data-model/validate";
import {
  CLUB_SOURCE_ROWS,
  KAGGLE_CLUB_NAMES,
  KAGGLE_LOOKALIKE_NAMES,
  OPENFOOTBALL_2025_NAMES,
} from "../../fixtures/clubs/source-names";

const raw: unknown = JSON.parse(
  readFileSync(join(process.cwd(), "data", "clubs.json"), "utf8").replace(/^﻿/, ""),
);
const clubs = clubSchema.array().parse(raw);
const now = new Date();
// Clubs of the 2025 list that cannot be delivered yet (open product question, see the plan).
// Empty this list when the club is added; the contract below then covers all 30.
// Issue #48: Independiente Rivadavia stays out for now (no verifiable second color).
const PENDING_CLUB_IDS: readonly string[] = ["independiente-rivadavia"];
const DELIVERED_ROWS = CLUB_SOURCE_ROWS.filter((r) => !PENDING_CLUB_IDS.includes(r.id));
const paletteHexes = new Set(CLUB_PALETTE.map((c) => c.hex));

describe("data/clubs.json", () => {
  it("validates with the dataset validator", () => {
    expect(validate({ "clubs.json": raw }, { now })).toEqual([]);
  });

  it("has the clubs of the 2025 Primera División, with stable ids", () => {
    expect(CLUB_SOURCE_ROWS).toHaveLength(30);
    expect(clubs).toHaveLength(30 - PENDING_CLUB_IDS.length);
    expect(clubs.map((c) => c.id).sort()).toEqual(DELIVERED_ROWS.map((r) => r.id).sort());
  });

  it("records the verified shirt pattern of the audited clubs (2026-10-16)", () => {
    const byId = new Map(clubs.map((c) => [c.id, c]));
    // Riestra: current home shirt is black with white details; stripes are the traditional kit.
    expect(byId.get("deportivo-riestra")?.jersey_pattern).toBe("solid");
    // Defensa y Justicia: stripe direction is unverified, so the safest reading is solid.
    expect(byId.get("defensa-y-justicia")?.jersey_pattern).toBe("solid");
    // Independiente: founded is the OFFICIAL year (1 Jan 1905, ADR 0012), not the 4 Aug 1904 birth.
    expect(byId.get("independiente")?.founded).toBe(1905);
  });

  it("has unique ids that are slugs", () => {
    expect(new Set(clubs.map((c) => c.id)).size).toBe(clubs.length);
    for (const c of clubs) expect(c.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has unique short names of at most 15 characters", () => {
    expect(new Set(clubs.map((c) => c.short_name)).size).toBe(clubs.length);
    for (const c of clubs) expect(c.short_name.length, c.id).toBeLessThanOrEqual(15);
  });

  it("shares no alias between two clubs, even after folding, and has no blank alias", () => {
    const owner = new Map<string, string>();
    for (const c of clubs) {
      for (const alias of c.aliases) {
        expect(alias.trim(), c.id).toBe(alias);
        expect(alias, c.id).not.toContain("’");
        const key = foldName(alias);
        const previous = owner.get(key);
        expect(
          previous === undefined || previous === c.id,
          `${alias} shared by ${previous} and ${c.id}`,
        ).toBe(true);
        owner.set(key, c.id);
      }
    }
  });

  it("cites a permanent Spanish Wikipedia revision as source", () => {
    for (const c of clubs) {
      const url = new URL(c.source);
      expect(url.protocol, c.id).toBe("https:");
      expect(url.host, c.id).toBe("es.wikipedia.org");
      expect(url.searchParams.get("oldid"), c.id).toMatch(/^\d+$/);
    }
  });

  it("uses only colors of the project palette", () => {
    for (const c of clubs) {
      for (const hex of Object.values(c.colors)) {
        expect(paletteHexes.has(hex.toLowerCase()), `${c.id} ${hex}`).toBe(true);
      }
    }
  });

  it("has a founding year between 1880 and now", () => {
    for (const c of clubs) {
      expect(c.founded, c.id).toBeGreaterThanOrEqual(1880);
      expect(c.founded, c.id).toBeLessThanOrEqual(now.getFullYear());
    }
  });

  it("resolves every openfootball 2025 name to its club", () => {
    expect(OPENFOOTBALL_2025_NAMES).toHaveLength(30);
    for (const row of DELIVERED_ROWS) {
      expect(resolveClubId(clubs, row.openfootball), row.openfootball).toBe(row.id);
    }
  });

  it("resolves every Kaggle name to its club", () => {
    for (const [name, id] of Object.entries(KAGGLE_CLUB_NAMES)) {
      if (PENDING_CLUB_IDS.includes(id)) continue;
      expect(resolveClubId(clubs, name), name).toBe(id);
    }
  });

  it("does not resolve any Kaggle lookalike name", () => {
    for (const name of KAGGLE_LOOKALIKE_NAMES) {
      expect(resolveClubId(clubs, name), name).toBeNull();
    }
  });
});
