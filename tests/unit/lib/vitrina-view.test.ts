import { describe, expect, it } from "vitest";
import { makeCompetition, makeTitle } from "../../fixtures/data-model/dataset";
import { statsWorld } from "../../fixtures/domain/stats-world";
import { buildStatsIndex, statsDataFrom } from "@/domain/data";
import type { ClubOption } from "@/lib/club-options";
import { buildVitrinaView, type VitrinaViewInput } from "@/lib/vitrina-view";

const NOW = new Date("2026-10-23T12:00:00Z");
const crest = {
  initials: "A",
  initialsInk: "#ffffff",
  pattern: "solid" as const,
  primary: "#112233",
  secondary: "#ffffff",
};
const option = (id: string, shortName: string): ClubOption => ({
  id,
  name: shortName,
  shortName,
  searchKeys: [],
  crest,
});
const catalog = new Map([
  ["club-a", option("club-a", "Ana")],
  ["club-b", option("club-b", "Beto")],
]);

function inputFor(
  mutate: (ds: ReturnType<typeof statsWorld>) => void = () => undefined,
  extra: Partial<VitrinaViewInput> = {},
): VitrinaViewInput {
  const ds = statsWorld();
  mutate(ds);
  const data = statsDataFrom(ds);
  return {
    index: buildStatsIndex(data),
    clubId: "club-a",
    startDate: "2020-01-01",
    startMode: "birth",
    now: NOW,
    catalog,
    competitionNames: new Map(data.competitions.map((c) => [c.id, c.name])),
    seasonNames: new Map(data.seasons.map((s) => [s.id, s.name])),
    ...extra,
  };
}

describe("buildVitrinaView on the synthetic world", () => {
  const view = buildVitrinaView(inputFor());

  it("has the period start as month and year, and the dataset has titles", () => {
    expect(view.since).toBe("enero de 2020");
    expect(view.hasAnyTitles).toBe(true);
    expect(view.emptyPeriod).toBe(false);
  });

  it("counts the lit trophies and the silhouettes, with the labels of the start mode", () => {
    expect(view.counters).toMatchObject({
      wonLabel: "Trofeos ganados desde que naciste",
      won: 5,
      missingLabel: "Trofeo que te falta",
      missing: 1,
      caption: "En los torneos y temporadas que tenemos cargados.",
    });
    const other = buildVitrinaView(inputFor(undefined, { startMode: "other" }));
    expect(other.counters.wonLabel).toBe("Trofeos ganados desde que sos hincha");
  });

  it("has the three shelves in order, trophies by date and silhouettes apart", () => {
    expect(view.shelves.map((s) => s.title)).toEqual(["Internacionales", "Locales", "Otros"]);
    const domestic = view.shelves[1];
    expect(domestic.trophies.map((t) => t.id)).toEqual(["t2", "t1", "t3", "t5", "t4"]);
    expect(view.shelves[0].trophies).toEqual([]);
    expect(view.shelves[0].silhouettes.map((s) => s.name)).toEqual([expect.stringMatching(/./)]);
  });

  it("makes one trophy per title with the year, the names and a button label", () => {
    const t1 = view.shelves[1].trophies.find((t) => t.id === "t1")!;
    expect(t1).toMatchObject({
      year: t1.detail.awardedOn.slice(-4),
      kind: "league",
      shared: false,
    });
    expect(t1.buttonLabel).toBe(`${t1.seasonName}, campeón el ${t1.detail.awardedOn}. Ver detalle`);
  });

  it("marks a shared title and names the co-champion", () => {
    const t5 = view.shelves[1].trophies.find((t) => t.id === "t5")!;
    expect(t5.shared).toBe(true);
    expect(t5.detail.sharedWith).toBe("Compartido con Beto.");
    const t1 = view.shelves[1].trophies.find((t) => t.id === "t1")!;
    expect(t1.detail.sharedWith).toBeNull();
  });

  it("fills the detail with the deciding match, the source and the criterion", () => {
    const cup = view.shelves[1].trophies.find((t) => t.id === "t3")!;
    expect(cup.kind).toBe("cup");
    expect(cup.detail.matchHeading).toBe("La final");
    expect(cup.detail.criterion).toMatch(/reconocidos por la AFA/);
    expect(cup.detail.recognized).toBe(true);
    const league = view.shelves[1].trophies.find((t) => t.id === "t1")!;
    expect(league.detail.matchHeading).toBe("La última fecha");
    expect(league.detail.match).not.toBeNull();
    expect(league.detail.noMatchLine).toBeNull();
  });

  it("says there is no match to show when none is loaded", () => {
    const bare = buildVitrinaView(
      inputFor(
        (ds) => {
          ds["titles.json"].push(makeTitle("tn", "club-d", "cup-y", "cup-y-2021", "2021-11-08"));
        },
        { clubId: "club-d" },
      ),
    );
    const t = bare.shelves[1].trophies.find((x) => x.id === "tn")!;
    expect(t.detail.match).toBeNull();
    expect(t.detail.noMatchLine).toBe("No tenemos cargado el partido que lo definió.");
  });

  it("gives a link host only for an https source", () => {
    const sources = buildVitrinaView(
      inputFor((ds) => {
        ds["titles.json"].push(
          {
            ...makeTitle("th", "club-a", "league-x", "league-x-2022", "2022-12-15"),
            source: "http://example.org/x",
          },
          {
            ...makeTitle("ts", "club-a", "league-x", "league-x-2023", "2023-12-15"),
            source: "https://www.rsssf.org/tablesa/argchamp.html#champions",
          },
        );
      }),
    );
    const trophies = sources.shelves[1].trophies;
    const http = trophies.find((x) => x.id === "th")!;
    expect(http.detail.sourceHost).toBeNull();
    expect(http.detail.sourceUrl).toBe("http://example.org/x");
    expect(trophies.find((x) => x.id === "ts")!.detail.sourceHost).toBe("www.rsssf.org");
  });

  it("keeps the unrecognized title apart, not lit and not counted", () => {
    expect(view.disputed.map((t) => t.id)).toEqual(["t7"]);
    expect(view.disputed[0].detail.recognized).toBe(false);
    expect(view.shelves.flatMap((s) => s.trophies).some((t) => t.id === "t7")).toBe(false);
  });

  it("has a checklist row per competition: won, missing or unknown", () => {
    expect(view.checklist.map((r) => [r.competitionId, r.status, r.label])).toEqual(
      expect.arrayContaining([
        ["league-x", "won", "Ganado (2)"],
        ["cup-y", "won", "Ganado (3)"],
        ["intl-z", "missing", "Te falta"],
      ]),
    );
    expect(view.checklist[0].competitionId).toBe("intl-z");
  });

  it("has the notice and the included line, never claiming a complete history", () => {
    expect(view.notice.show).toBe(true);
    expect(view.notice.heading).toBe("Tu vitrina puede estar incompleta");
    expect(view.included.startsWith("Contamos títulos de: ")).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/(?<!in)complet[ao]\b|toda la historia/i);
    expect(view.emptyLine).toBeNull();
  });
});

describe("buildVitrinaView: shelves without a loaded competition", () => {
  it("says the international and other shelves are under construction, never a silhouette", () => {
    const view = buildVitrinaView(
      inputFor((ds) => {
        ds["competitions.json"] = ds["competitions.json"].filter((c) => c.id !== "intl-z");
        ds["seasons.json"] = ds["seasons.json"].filter((s) => s.competition_id !== "intl-z");
        ds["titles.json"] = ds["titles.json"].filter((t) => t.competition_id !== "intl-z");
        ds["matches.json"] = ds["matches.json"].filter((m) => !m.season_id.startsWith("intl-z"));
        ds["coverage.json"] = ds["coverage.json"].filter((c) => c.competition_id !== "intl-z");
      }),
    );
    expect(view.shelves[0].underConstruction).toMatch(/Libertadores, Sudamericana/);
    expect(view.shelves[0].silhouettes).toEqual([]);
    expect(view.shelves[2].underConstruction).toMatch(/supercopas/);
    expect(view.shelves[1].underConstruction).toBeNull();
  });

  it("loads an 'other' competition without under construction", () => {
    const view = buildVitrinaView(
      inputFor((ds) => {
        ds["competitions.json"].push(makeCompetition("other-q", { type: "other" }));
      }),
    );
    expect(view.shelves[2].underConstruction).toBeNull();
  });
});

describe("buildVitrinaView: other states", () => {
  it("shows no counters-worth of titles when the dataset has none", () => {
    const view = buildVitrinaView(
      inputFor((ds) => {
        ds["titles.json"] = [];
      }),
    );
    expect(view.hasAnyTitles).toBe(false);
    expect(view.counters.won).toBe(0);
    expect(view.emptyLine).toBeNull();
    expect(view.included).toBe("Todavía no cargamos títulos.");
    expect(view.checklist.every((r) => r.status === "unknown")).toBe(true);
  });

  it("gives the humor line to a club with no title in the period", () => {
    const view = buildVitrinaView(inputFor(undefined, { clubId: "club-c" }));
    expect(view.counters.won).toBe(0);
    expect(view.emptyLine).toBe(
      "Todavía no levantaste ninguna copa desde que naciste. La vitrina está limpita y con lugar de sobra.",
    );
    expect(
      buildVitrinaView(inputFor(undefined, { clubId: "club-c", startMode: "other" })).emptyLine,
    ).toContain("desde que sos hincha");
  });

  it("puts the titles before the start apart and does not count them", () => {
    const view = buildVitrinaView(inputFor(undefined, { startDate: "2022-06-01" }));
    expect(view.before.length).toBeGreaterThan(0);
    const counted = view.shelves.flatMap((s) => s.trophies).map((t) => t.id);
    for (const t of view.before) expect(counted).not.toContain(t.id);
  });

  it("is empty for a start after today: no notice, every title before", () => {
    const view = buildVitrinaView(inputFor(undefined, { startDate: "2030-01-01" }));
    expect(view.emptyPeriod).toBe(true);
    expect(view.notice.show).toBe(false);
    expect(view.counters.won).toBe(0);
    expect(view.emptyLine).toBeNull();
    expect(view.before.length).toBeGreaterThan(0);
  });

  it("falls back to the id when the names are missing from the maps", () => {
    const view = buildVitrinaView(
      inputFor(undefined, {
        competitionNames: new Map(),
        seasonNames: new Map(),
        catalog: new Map(),
      }),
    );
    const t = view.shelves[1].trophies[0];
    expect(t.competitionName).toMatch(/^(league-x|cup-y)$/);
    expect(t.seasonName).toMatch(/-20/);
  });

  it("notes a competition with no champions and a window outside the period", () => {
    const view = buildVitrinaView(
      inputFor((ds) => {
        ds["titles.json"] = ds["titles.json"].filter((t) => t.competition_id !== "cup-y");
      }),
    );
    expect(view.notice.lines.join("\n")).toMatch(
      /Copa Ficticia Y: todavía no tenemos sus campeones/,
    );
    const later = buildVitrinaView(inputFor(undefined, { startDate: "2023-01-01" }));
    expect(later.notice.lines.join("\n")).toMatch(/no tenemos campeones cargados en tu período/);
  });
});

describe("buildVitrinaView: kinds and missing seasons", () => {
  it("draws an 'other' competition as an other trophy", () => {
    const view = buildVitrinaView(
      inputFor((ds) => {
        ds["competitions.json"].push(makeCompetition("other-q", { type: "other" }));
        ds["seasons.json"].push({
          id: "other-q-2021",
          competition_id: "other-q",
          name: "Otro 2021",
          start: "2021-01-01",
          end: "2021-12-31",
          source: "fixture:synthetic",
        });
        ds["titles.json"].push(makeTitle("to", "club-a", "other-q", "other-q-2021", "2021-06-01"));
      }),
    );
    expect(view.shelves[2].trophies.map((t) => [t.id, t.kind])).toEqual([["to", "other"]]);
  });

  it("names the missing seasons of the window that touch the period, not the ones before it", () => {
    const withGap = (startDate: string) =>
      buildVitrinaView(
        inputFor(
          (ds) => {
            ds["titles.json"].push(
              makeTitle("tb", "club-b", "league-x", "league-x-2023", "2023-12-20"),
            );
          },
          { startDate },
        ),
      ).notice.lines.join(" | ");
    expect(withGap("2022-06-01")).toMatch(/nos falta el campeón de league-x-2022/);
    expect(withGap("2023-06-01")).not.toMatch(/nos falta el campeón de league-x-2022/);
  });
});

describe("privacy", () => {
  it("never contains the start date, in any spelling, for 50 random dates", () => {
    const base = inputFor();
    const months = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    for (let i = 0; i < 50; i++) {
      const year = 1950 + ((i * 7) % 70);
      const month = String(1 + ((i * 5) % 12)).padStart(2, "0");
      const day = String(2 + ((i * 3) % 25)).padStart(2, "0");
      const startDate = `${year}-${month}-${day}`;
      const text = JSON.stringify(buildVitrinaView({ ...base, startDate }));
      expect(text).not.toContain(startDate);
      expect(text).not.toContain(`${day}/${month}/${year}`);
      expect(text).not.toContain(`${year}${month}${day}`);
      expect(text).not.toContain(`${Number(day)} de ${months[Number(month) - 1]} de ${year}`);
    }
  });
});
