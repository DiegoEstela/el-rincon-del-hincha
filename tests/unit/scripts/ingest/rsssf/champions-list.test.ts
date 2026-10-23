import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeSource } from "../../../../../scripts/ingest/core/pinned-fetch";
import { parseChampionsList } from "../../../../../scripts/ingest/rsssf/layouts/champions-list";
import { prepareText } from "../../../../../scripts/ingest/rsssf/text";

const name = "champions-modern.txt";
const bytes = readFileSync(join(process.cwd(), "tests/fixtures/ingest/rsssf", name));
const sha256 = createHash("sha256").update(bytes).digest("hex");
const real = prepareText(
  decodeSource({ name, url: "https://x", sha256, encoding: "windows-1252" }, bytes),
  name,
);

describe("champions-list on the real excerpt (plan 0017, T20)", () => {
  const parsed = parseChampionsList(real);

  it("reads one row per tournament from 2017/18 to the 2026 Apertura", () => {
    expect(parsed.rows.map((r) => `${r.season} ${r.tournament}`)).toEqual([
      "2017/18 Campeonato",
      "2018/19 Campeonato",
      "2019/20 Campeonato",
      "2021 Campeonato",
      "2022 Campeonato",
      "2023 Campeonato",
      "2024 Campeonato",
      "2025 Torneo Apertura",
      "2025 Anual LPF",
      "2025 Torneo Clausura",
      "2026 Torneo Apertura",
    ]);
  });

  it("reads the champion and the runner-up with their full names", () => {
    const by = (season: string, tournament: string) =>
      parsed.rows.find((r) => r.season === season && r.tournament === tournament)!;
    expect(by("2018/19", "Campeonato")).toMatchObject({
      champion: "Racing Club",
      runnerUp: "Club Social y Deportivo Defensa y Justicia",
    });
    expect(by("2024", "Campeonato").champion).toBe("Club Atlético Vélez Sarsfield");
    expect(by("2025", "Torneo Clausura")).toMatchObject({
      champion: "Club Estudiantes de La Plata",
      runnerUp: "Racing Club",
    });
  });

  it("keeps the Anual LPF row, which is not a championship we load", () => {
    expect(parsed.rows.find((r) => r.tournament === "Anual LPF")?.champion).toBe(
      "Club Atlético Rosario Central",
    );
  });
});

describe("champions-list failures", () => {
  const prepare = (lines: string[]) => prepareText(lines.join("\n"), "x.txt");

  it("ignores notes between the rows", () => {
    const text = prepare([
      "End of the period.",
      "2021               Campeonato               A FC                    B FC",
    ]);
    expect(parseChampionsList(text).rows).toHaveLength(1);
  });

  it("stops on a row it cannot read, naming the line", () => {
    expect(() =>
      parseChampionsList(prepare(["2021               Copa Rara               A FC    B FC"])),
    ).toThrow(/x\.txt:1: unrecognized champion row/);
  });
});
