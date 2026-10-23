import type { FileReport } from "./adapter";

/** The lines the CLI prints for one file of the run report. */
export function reportLines(f: FileReport): string[] {
  const note = f.partial
    ? ` PARTIAL (source ends ${f.lastSourceDate}, season ends ${f.seasonEnd})`
    : "";
  const lines = [`${f.file}: ${f.parsed} matches, ${f.first} to ${f.last}${note}`];
  // Cups keep only the matches of the app clubs: a name that was not resolved in a dropped match
  // may be a spelling of an app club that is missing from its aliases, so a reviewer must see it.
  if (f.droppedUnknown !== undefined && f.droppedUnknown.length > 0) {
    lines.push(
      `${f.file}: WARNING ${f.droppedUnknown.length} unresolved name(s) in dropped matches, check none is an app club: ${f.droppedUnknown.join("; ")}`,
    );
  }
  return lines;
}
