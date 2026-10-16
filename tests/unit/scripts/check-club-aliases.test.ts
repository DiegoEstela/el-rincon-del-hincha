import { describe, expect, it } from "vitest";
import { analyzeClubNames, formatReport } from "../../../scripts/lib/club-aliases-check";

const HEADER =
  "date_name,local_team_id,local_team,local_result,visitor_result,visitor_team,visitor_team_id";
const clubs = [
  { id: "alpha", aliases: ["Alpha FC", "Alpha"] },
  { id: "beta", aliases: ["Beta"] },
];
const lookalikes = ["Alpha (X)"];

const csv = (rows: string[]) => [HEADER, ...rows].join("\n");

describe("analyzeClubNames", () => {
  it("collects distinct names from the two team columns only", () => {
    const report = analyzeClubNames(
      csv(["Liga 2022,1,Alpha,99,98,Beta,2", "Liga 2022,2,Beta,97,96,Alpha,1"]),
      clubs,
      lookalikes,
    );
    expect(report.distinctNames).toEqual(["Alpha", "Beta"]);
    expect(report.resolved).toEqual({ Alpha: "alpha", Beta: "beta" });
    expect(JSON.stringify(report)).not.toContain("99");
    expect(report.exitCode).toBe(0);
  });

  it("reports unresolved names only for recent tournaments (2022 or later)", () => {
    const report = analyzeClubNames(
      csv([
        "Campeonato 1931,1,Old Club,0,0,Alpha,2",
        "Liga Profesional 2022,3,New Club,0,0,Beta,4",
        "Liga Profesional 2018/2019,5,Mid Club,0,0,Beta,4",
      ]),
      clubs,
      lookalikes,
    );
    expect(report.unresolvedRecent).toEqual(["New Club"]);
    expect(report.unresolvedOld).toEqual(["Mid Club", "Old Club"]);
    expect(report.exitCode).toBe(0);
  });

  it("fails when a lookalike name resolves", () => {
    const withBadAlias = [{ id: "alpha", aliases: ["Alpha", "Alpha (X)"] }];
    const report = analyzeClubNames(
      csv(["Liga 2023,1,Alpha (X),0,0,Alpha,2"]),
      withBadAlias,
      lookalikes,
    );
    expect(report.lookalikeHits).toEqual(["Alpha (X)"]);
    expect(report.exitCode).toBe(1);
  });

  it("fails in strict mode when a recent name is unresolved", () => {
    const rows = csv(["Liga 2023,1,Ghost,0,0,Alpha,2"]);
    expect(analyzeClubNames(rows, clubs, lookalikes).exitCode).toBe(0);
    expect(analyzeClubNames(rows, clubs, lookalikes, { strict: true }).exitCode).toBe(1);
  });

  it("fails when a required name is missing from the file or resolves to another club", () => {
    const rows = csv(["Liga 2023,1,Alpha,0,0,Beta,2"]);
    const ok = analyzeClubNames(rows, clubs, lookalikes, { expected: { Alpha: "alpha" } });
    expect(ok.exitCode).toBe(0);
    const wrong = analyzeClubNames(rows, clubs, lookalikes, { expected: { Alpha: "beta" } });
    expect(wrong.expectedProblems).toEqual(["Alpha: expected beta, got alpha"]);
    expect(wrong.exitCode).toBe(1);
    const missing = analyzeClubNames(rows, clubs, lookalikes, { expected: { Zed: "alpha" } });
    expect(missing.expectedProblems).toEqual(["Zed: not found in the file"]);
  });

  it("throws a clear error when a required column is missing", () => {
    expect(() => analyzeClubNames("a,b\n1,2", clubs, lookalikes)).toThrow(/Missing column/);
  });

  it("handles CRLF line endings, blank lines and quoted names", () => {
    const text = `${HEADER}\r\nLiga 2023,1,"Alpha FC",0,0,Beta,2\r\n\r\n`;
    const report = analyzeClubNames(text, clubs, lookalikes);
    expect(report.distinctNames).toEqual(["Alpha FC", "Beta"]);
    expect(report.resolved["Alpha FC"]).toBe("alpha");
  });

  it("formats a report with names and counts but no scores", () => {
    const report = analyzeClubNames(csv(["Liga 2023,1,Alpha,55,66,Ghost,2"]), clubs, lookalikes);
    const text = formatReport(report);
    expect(text).toContain("Distinct names: 2");
    expect(text).toContain("Ghost");
    expect(text).not.toContain("55");
    expect(text).not.toContain("66");
  });
});
