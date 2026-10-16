import { describe, expect, it } from "vitest";
import { validate } from "@/data-model/validate";
import { DATASET_FILES, type DatasetFile } from "@/data-model/schemas";
import { FIXED_NOW, validDataset } from "../../fixtures/data-model/dataset";

const run = (raw: Record<string, unknown>) => validate(raw, { now: FIXED_NOW });

describe("validate: baseline", () => {
  it("accepts the valid synthetic dataset", () => {
    expect(run(validDataset())).toEqual([]);
  });
  it("accepts an empty object (empty data directory)", () => {
    expect(run({})).toEqual([]);
  });
  it("accepts files with empty arrays", () => {
    expect(run({ "matches.json": [] })).toEqual([]);
  });
});

describe("validate: shape stage", () => {
  it("flags a root that is not an array", () => {
    for (const root of [{}, null, "x", 3]) {
      const issues = run({ "clubs.json": root });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ rule: "schema", file: "clubs.json", recordId: null });
    }
  });

  it("flags unknown files", () => {
    const issues = run({ "match.json": [] });
    expect(issues).toEqual([
      expect.objectContaining({ rule: "unknown-file", file: "match.json", recordId: null }),
    ]);
  });

  it.each(DATASET_FILES)("flags a missing source in %s", (file: DatasetFile) => {
    const ds = validDataset();
    const record = (ds[file] as Record<string, unknown>[])[0];
    delete record.source;
    const issues = run(ds).filter((i) => i.rule === "missing-source");
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe(file);
    expect(issues[0].recordId).not.toBeNull();
  });

  it("flags blank and non-string sources", () => {
    const ds = validDataset();
    ds["clubs.json"][0].source = "   ";
    (ds["clubs.json"][1] as unknown as Record<string, unknown>).source = 42;
    const issues = run(ds).filter((i) => i.rule === "missing-source");
    expect(issues.map((i) => i.recordId)).toEqual(["club-a", "club-b"]);
  });

  it("reports fuente as both an unknown key and a missing source", () => {
    const ds = validDataset();
    const record = ds["clubs.json"][0] as unknown as Record<string, unknown>;
    record.fuente = record.source;
    delete record.source;
    const rules = run(ds).map((i) => i.rule);
    expect(rules).toContain("schema");
    expect(rules).toContain("missing-source");
  });

  it("includes the field path in schema messages", () => {
    const ds = validDataset();
    ds["matches.json"][0].home_goals = 1.5;
    const issue = run(ds).find((i) => i.rule === "schema");
    expect(issue?.recordId).toBe("m1");
    expect(issue?.message).toContain("home_goals");
  });

  it("flags impossible calendar dates", () => {
    const ds = validDataset();
    ds["seasons.json"][0].start = "2020-02-30";
    expect(run(ds).map((i) => i.rule)).toContain("schema");
  });

  it("uses #index for records without a usable id and tolerates non-object records", () => {
    const issues = run({ "clubs.json": [null, { name: 1 }] });
    expect(issues.every((i) => i.rule === "schema" || i.rule === "missing-source")).toBe(true);
    expect(issues.map((i) => i.recordId)).toContain("#0");
    expect(issues.map((i) => i.recordId)).toContain("#1");
  });

  it("excludes invalid records from later stages (no cascade)", () => {
    const ds = validDataset();
    // Broken club: every match that references it must not add unknown-club issues.
    (ds["clubs.json"][1] as unknown as Record<string, unknown>).founded = "old";
    const issues = run(ds);
    expect(issues.map((i) => i.rule)).toEqual(["schema"]);
  });

  it("sorts output by file, record id and rule", () => {
    const ds = validDataset();
    delete (ds["titles.json"][0] as unknown as Record<string, unknown>).source;
    delete (ds["clubs.json"][2] as unknown as Record<string, unknown>).source;
    delete (ds["clubs.json"][0] as unknown as Record<string, unknown>).source;
    const issues = run(ds);
    expect(issues.map((i) => `${i.file}#${i.recordId}`)).toEqual([
      "clubs.json#club-a",
      "clubs.json#club-c",
      "titles.json#t1",
    ]);
  });
});
