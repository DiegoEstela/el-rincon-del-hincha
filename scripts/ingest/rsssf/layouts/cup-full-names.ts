// Layout "cup-full-names": the cup sections of the pages of 2017-18 onward (Copa Argentina, the
// Trofeo de Campeones and the Supercopas on `arg2023` to `arg2025`). Same grammar as
// `full-names-2017` (date headers, two-space columns, `[3] 0- 0 [1]` plus `pso`), with the knockout
// rounds of a cup, dates that may carry their own year, and a section of one match that has no
// round heading. The table of rounds reached that opens the Copa Argentina is not a final table.
import { parseFullNames, type FullNamesOptions } from "./full-names-2017";
import type { LayoutContext, ParsedTournament } from "../types";
import type { PreparedText } from "../text";

const OPTIONS: FullNamesOptions = {
  knockout: [
    [/^Round of 64\b.*$/, "32avos de final"],
    [/^Round of 32\b.*$/, "16avos de final"],
    [/^Round of 16\b.*$/, "Octavos de final"],
    [/^Quarter-?finals?\b.*$/, "Cuartos de final"],
    [/^Semi-?finals?\b.*$/, "Semifinal"],
    [/^Final:?$/, "Final"],
  ],
  defaultStage: "Final",
};

export function parseCupFullNames(text: PreparedText, ctx: LayoutContext): ParsedTournament {
  return parseFullNames(text, ctx, OPTIONS);
}
