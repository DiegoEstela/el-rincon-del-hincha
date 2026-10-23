import { describe, expect, it } from "vitest";
import type { TitleWindow } from "@/domain/titles";
import {
  BEFORE_PERIOD,
  COUNTER_CAPTION,
  CRITERION,
  DISPUTED,
  EMPTY_PERIOD,
  NO_TITLES_LOADED,
  SHELF_TITLES,
  UNDER_CONSTRUCTION,
  checklistLabel,
  matchHeading,
  sharedWith,
  silhouetteCaption,
  sourceHost,
  titleCoverageCopy,
  titlesIncludedLine,
  trophyButtonLabel,
  wonLabel,
  zeroTitlesLine,
  type NoticeRow,
} from "@/lib/vitrina-copy";

describe("vitrina copy: labels", () => {
  it("words the first counter by start mode", () => {
    expect(wonLabel("birth")).toBe("Trofeos ganados desde que naciste");
    expect(wonLabel("other")).toBe("Trofeos ganados desde que sos hincha");
    expect(COUNTER_CAPTION).toBe("En los torneos y temporadas que tenemos cargados.");
  });

  it("names a trophy button with the season and the day", () => {
    expect(trophyButtonLabel("Superliga 2018-19", "2019-04-07")).toBe(
      "Superliga 2018-19, campeón el 7 de abril de 2019. Ver detalle",
    );
  });

  it("captions a silhouette with the window, or with the only season", () => {
    expect(silhouetteCaption("Superliga 2018-19", "Torneo Clausura 2025")).toBe(
      "No lo ganaste entre Superliga 2018-19 y Torneo Clausura 2025.",
    );
    expect(silhouetteCaption("Liga 2021", "Liga 2021")).toBe("No lo ganaste en Liga 2021.");
  });

  it("labels the checklist rows", () => {
    expect(checklistLabel("won", 1)).toBe("Ganado (1)");
    expect(checklistLabel("won", 3)).toBe("Ganado (3)");
    expect(checklistLabel("missing", 0)).toBe("Te falta");
    expect(checklistLabel("unknown", 0)).toBe("Sin datos todavía");
  });

  it("headlines the deciding match", () => {
    expect(matchHeading(true)).toBe("La final");
    expect(matchHeading(false)).toBe("La última fecha");
  });

  it("names the co-champions", () => {
    expect(sharedWith([])).toBeNull();
    expect(sharedWith(["Boca"])).toBe("Compartido con Boca.");
    expect(sharedWith(["Boca", "River"])).toBe("Compartido con Boca y River.");
    expect(sharedWith(["A", "B", "C"])).toBe("Compartido con A, B y C.");
  });

  it("gives a host only for an https link", () => {
    expect(sourceHost("https://www.rsssf.org/tablesa/argchamp.html#champions")).toBe(
      "www.rsssf.org",
    );
    expect(sourceHost("http://example.org/x")).toBeNull();
    expect(sourceHost("javascript:alert(1)")).toBeNull();
    expect(sourceHost("not a url")).toBeNull();
  });

  it("has the fixed texts of the states and the shelves", () => {
    expect(Object.values(SHELF_TITLES)).toEqual(["Internacionales", "Locales", "Otros"]);
    expect(UNDER_CONSTRUCTION.international).toMatch(/Libertadores, Sudamericana/);
    expect(UNDER_CONSTRUCTION.other).toMatch(/supercopas/);
    expect(zeroTitlesLine("birth")).toBe(
      "Todavía no levantaste ninguna copa desde que naciste. La vitrina está limpita y con lugar de sobra.",
    );
    expect(zeroTitlesLine("other")).toContain("desde que sos hincha");
    expect(NO_TITLES_LOADED.title).toBe("Todavía no cargamos los títulos");
    expect(EMPTY_PERIOD.title).toBe("Tu historia todavía no empezó");
    expect(BEFORE_PERIOD.title(2)).toBe("Antes de que llegaras (2)");
    expect(DISPUTED.title).toBe("Títulos discutidos");
    expect(CRITERION).toMatch(/reconocidos por la AFA/);
  });
});

const window = (extra: Partial<TitleWindow> = {}): TitleWindow => ({
  competitionId: "primera-division",
  firstSeasonId: "s1",
  lastSeasonId: "s2",
  windowStart: "2018-08-10",
  windowEnd: "2025-12-14",
  missingSeasonIds: [],
  ...extra,
});
const row = (extra: Partial<NoticeRow> = {}): NoticeRow => ({
  competitionName: "Primera División",
  window: window(),
  firstSeasonName: "Superliga 2018-19",
  lastSeasonName: "Torneo Clausura 2025",
  missingSeasonNames: [],
  windowInPeriod: true,
  ...extra,
});

describe("titleCoverageCopy", () => {
  it("says which champions are loaded and never that the history is complete", () => {
    const copy = titleCoverageCopy([row()], false);
    expect(copy).toEqual({
      show: true,
      heading: "Tu vitrina puede estar incompleta",
      lead: "Mostramos solo los títulos que tenemos cargados.",
      lines: [
        "Primera División: tenemos los campeones de Superliga 2018-19 a Torneo Clausura 2025.",
      ],
    });
    expect(JSON.stringify(copy)).not.toMatch(/(?<!in)complet[ao]|toda la historia/i);
  });

  it("names a season inside the window without champion", () => {
    const copy = titleCoverageCopy(
      [row({ missingSeasonNames: ["Liga 2021", "Liga 2022"] })],
      false,
    );
    expect(copy.lines).toEqual([
      "Primera División: tenemos los campeones de Superliga 2018-19 a Torneo Clausura 2025.",
      "Primera División: nos falta el campeón de Liga 2021.",
      "Primera División: nos falta el campeón de Liga 2022.",
    ]);
  });

  it("says a competition has no champions yet", () => {
    const none = row({
      competitionName: "Copa de la Liga",
      window: window({ firstSeasonId: null, lastSeasonId: null }),
      firstSeasonName: null,
      lastSeasonName: null,
    });
    expect(titleCoverageCopy([none], false).lines).toEqual([
      "Copa de la Liga: todavía no tenemos sus campeones.",
    ]);
  });

  it("says when the champions loaded are outside the period", () => {
    const outside = row({ windowInPeriod: false });
    expect(titleCoverageCopy([outside], false).lines).toEqual([
      "Primera División: no tenemos campeones cargados en tu período.",
    ]);
  });

  it("is hidden for an empty period only", () => {
    expect(titleCoverageCopy([row()], true).show).toBe(false);
    expect(titleCoverageCopy([], false).show).toBe(true);
  });
});

describe("titlesIncludedLine", () => {
  it("lists the competitions with champions, or says there are none", () => {
    expect(titlesIncludedLine([])).toBe("Todavía no cargamos títulos.");
    expect(titlesIncludedLine(["Primera División"])).toBe("Contamos títulos de: Primera División.");
    expect(titlesIncludedLine(["Primera División", "Copa de la Liga"])).toBe(
      "Contamos títulos de: Primera División y Copa de la Liga.",
    );
  });
});
