import { describe, expect, it } from "vitest";
import { reportLines } from "../../../../scripts/ingest/core/report";

const file = {
  file: "arg2025.nationalcup",
  parsed: 2,
  header: 2,
  first: "2025-01-22",
  last: "2025-07-23",
  partial: false,
  lastSourceDate: "2025-07-23",
  seasonEnd: "2025-11-05",
};

describe("reportLines", () => {
  it("prints one line for a file", () => {
    expect(reportLines(file)).toEqual(["arg2025.nationalcup: 2 matches, 2025-01-22 to 2025-07-23"]);
  });
  it("marks a partial season", () => {
    expect(reportLines({ ...file, partial: true })[0]).toContain(
      "PARTIAL (source ends 2025-07-23, season ends 2025-11-05)",
    );
  });
  it("warns with every unresolved name of the dropped matches", () => {
    const lines = reportLines({ ...file, droppedUnknown: ["CA Racing", "Zzz FC"] });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("WARNING 2 unresolved name(s)");
    expect(lines[1]).toContain("CA Racing; Zzz FC");
  });
  it("says nothing when no name was dropped", () => {
    expect(reportLines({ ...file, droppedUnknown: [] })).toHaveLength(1);
  });
});
