// Declared coverage gaps (plan 0014, ADR 0017): periods of a competition for which we have no
// (or only partial) data. They are reviewed data, not derived: each one names its reason and a
// permanent source for its dates. The generator turns them into `complete: false` rows and keeps
// them out of every complete stretch. Dates read on 2026-10-17; see plan 0014, "Verification log".
import type { CoverageGap } from "./coverage-generate";

const wiki = (title: string, oldid: number) =>
  `https://es.wikipedia.org/w/index.php?title=${title}&oldid=${oldid}`;

export const COVERAGE_GAPS: readonly CoverageGap[] = [
  {
    competition_id: "copa-argentina",
    from: "2025-11-06",
    to: null,
    reason:
      "The Copa Argentina of 2026 and later is not loaded: the RSSSF pages used end with the final of 2025-11-05, and the editions before 2023 are a later PR of plan 0017.",
    source: "https://www.rsssf.org/tablesa/arg2025.html#nationalcup",
  },
  {
    competition_id: "copa-de-la-liga-profesional",
    from: "2021-02-12",
    to: "2021-06-04",
    reason: "Copa de la Liga Profesional 2021 (second edition) is not loaded.",
    source: wiki("Copa_de_la_Liga_Profesional_2021", 175528472),
  },
  {
    competition_id: "copa-de-la-liga-profesional",
    from: "2022-02-10",
    to: "2022-05-22",
    reason: "Copa de la Liga Profesional 2022 (third edition) is not loaded.",
    source: wiki("Copa_de_la_Liga_Profesional_2022", 175528478),
  },
  {
    competition_id: "copa-de-la-liga-profesional",
    from: "2023-08-17",
    to: "2023-12-16",
    reason: "Copa de la Liga Profesional 2023 (fourth edition) is not loaded.",
    source: wiki("Copa_de_la_Liga_Profesional_2023", 175528489),
  },
  {
    competition_id: "copa-de-la-liga-profesional",
    from: "2024-01-25",
    to: "2024-05-05",
    reason: "Copa de la Liga Profesional 2024 (fifth and last edition) is not loaded.",
    source: wiki("Copa_de_la_Liga_Profesional_2024", 175528520),
  },
  {
    competition_id: "primera-division",
    from: "2025-12-15",
    to: null,
    reason:
      "The 2026 Apertura and every later tournament are not loaded: the RSSSF page of 2025 ends with the Clausura final on 2025-12-14 (plan 0017).",
    source: "https://www.rsssf.org/tablesa/arg2025.html#1clausura",
  },
  {
    competition_id: "supercopa-argentina",
    from: "2025-09-07",
    to: null,
    reason:
      "The Supercopa Argentina 2025 and later are not loaded: the RSSSF page of 2025 has no section for it.",
    source: "https://www.rsssf.org/tablesa/arg2025.html",
  },
  {
    competition_id: "supercopa-internacional",
    from: "2026-09-27",
    to: null,
    reason: "The Supercopa Internacional 2026 and later are not loaded (plan 0017).",
    source: "https://www.rsssf.org/tablesa/arg2025.html#lpfsuper",
  },
  {
    competition_id: "trofeo-de-campeones",
    from: "2025-12-21",
    to: null,
    reason:
      "The Trofeo de Campeones 2026 and later are not loaded: the RSSSF pages used end with the edition of 2025-12-20.",
    source: "https://www.rsssf.org/tablesa/arg2025.html#1champtroph",
  },
];
