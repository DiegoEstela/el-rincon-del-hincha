import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { clubSchema, FILE_SCHEMAS, type DatasetFile } from "@/data-model/schemas";
import { loadModel } from "./migrations";

// Deleting any foreign key, index or shape check from the migrations must turn a test red. The
// expectations come from the Zod schemas (column names) and from the plan (indexes), not from the SQL.

const { model } = loadModel();
const plan = readFileSync(join(process.cwd(), "docs", "plans", "0006-supabase-schema.md"), "utf8");

type Def = { type: string; innerType?: ZodType; shape?: Record<string, ZodType> };
const defOf = (f: ZodType): Def => (f as unknown as { _zod: { def: Def } })._zod.def;

/** Which table a reference column points at (naming convention of the data model, ADR 0009). */
function target(column: string): string | null {
  if (["club_id", "home_id", "away_id", "club_a", "club_b"].includes(column)) return "clubs";
  if (column === "competition_id") return "competitions";
  if (column === "season_id") return "seasons";
  return null;
}

describe("foreign keys", () => {
  const entries = Object.entries(FILE_SCHEMAS) as [DatasetFile, ZodType][];
  it("references at least the 15 columns the data model has", () => {
    const count = entries.flatMap(([, s]) => Object.keys(defOf(s).shape!).filter(target)).length;
    expect(count).toBe(15);
  });
  const withRefs = entries.filter(([, s]) => Object.keys(defOf(s).shape!).some(target));
  describe.each(withRefs)("%s", (file, schema) => {
    const name = file.replace(/\.json$/, "");
    const table = model.tables.get(name)!;
    for (const column of Object.keys(defOf(schema).shape!)) {
      const to = target(column);
      if (to === null) continue;
      it(`${column} references ${to} (id)`, () => {
        const pattern = new RegExp(`^${column} .*references public\\.${to} \\(id\\)$`);
        expect(table.constraints.some((c) => pattern.test(c))).toBe(true);
      });
    }
  });
  it("titles ties season and competition together with a composite foreign key", () => {
    const titles = model.tables.get("titles")!;
    expect(titles.constraints).toContain(
      "foreign key (season_id, competition_id) references public.seasons (id, competition_id)",
    );
  });
  it("seasons has the unique (id, competition_id) the composite key points at", () => {
    expect(model.tables.get("seasons")!.constraints).toContain("unique (id, competition_id)");
  });
});

describe("indexes listed by the plan", () => {
  const line = plan.split("\n").find((l) => l.startsWith("Every reference table:"))!;
  const listed = [...line.slice(line.indexOf(" Indexes ")).matchAll(/`(\w+) \(([^`]*)\)`/g)].map(
    (m) => ({ table: m[1]!, columns: m[2]!.split(",").map((c) => c.trim()) }),
  );
  const unique = /Unique index `(\w+) \((.*?)\)`\./.exec(line)!;

  it("the plan lists eleven plain indexes", () => {
    expect(listed).toHaveLength(11);
  });
  it.each(listed.map((i) => [`${i.table} (${i.columns.join(", ")})`, i] as const))(
    "exists: %s",
    (_label, wanted) => {
      const found = model.indexes.some(
        (i) => i.table === wanted.table && i.columns.join(",") === wanted.columns.join(","),
      );
      expect(found).toBe(true);
    },
  );
  it("the unique fixture index exists", () => {
    const columns = unique[2]!.replace(/\(([^)]*)\)/g, "($1)").split(/,\s*(?![^(]*\))/);
    const found = model.indexes.find((i) => i.unique && i.table === unique[1]);
    expect(found?.columns).toEqual(columns);
  });
});

describe("clubs colors", () => {
  const checks = model.tables.get("clubs")!.checks;
  // `colors` is optional since opponents have none (ADR 0022); the keys of the object are the same.
  const colors = defOf(defOf(defOf(clubSchema).shape!["colors"]!).innerType!).shape!;
  const keys = Object.keys(colors);
  const required = keys.filter((k) => defOf(colors[k]!).type !== "optional");

  it("must be a jsonb object", () => {
    expect(checks).toContain("jsonb_typeof(colors) = 'object'");
  });
  it("require the keys the schema requires", () => {
    const list = required.map((k) => `'${k}'`).join(", ");
    expect(checks).toContain(`colors ?& array[${list}]`);
  });
  it("allow no other key than the schema keys", () => {
    const removals = keys.map((k) => ` - '${k}'`).join("");
    expect(checks).toContain(`(colors${removals}) = '{}'::jsonb`);
  });
  it.each(keys)("%s must be a #RRGGBB hex that behaves like the Zod regex", (key) => {
    const check = checks.find((c) => c.includes(`colors ->> '${key}' ~ `));
    expect(check, `hex check for ${key}`).toBeDefined();
    const sqlPattern = /~ '([^']+)'/.exec(check!)![1]!;
    const re = new RegExp(sqlPattern);
    const optional = defOf(colors[key]!).type === "optional";
    expect(check!.startsWith(`colors ->> '${key}' is null or `)).toBe(optional);
    const zodHex = optional ? defOf(colors[key]!).innerType! : colors[key]!;
    for (const value of ["#112233", "#aAbBcC", "#GGGGGG", "112233", "#12345", "#1234567", ""]) {
      expect(re.test(value), value).toBe(zodHex.safeParse(value).success);
    }
  });
});

describe("clubs opponents (ADR 0022)", () => {
  const clubs = model.tables.get("clubs")!;
  it("keeps the kit data nullable and the opponent columns nullable", () => {
    for (const name of ["colors", "jersey_pattern", "founded", "city", "selectable", "country"]) {
      expect(clubs.columns.find((c) => c.name === name)?.nullable, name).toBe(true);
    }
  });
  it("asks for the kit data of a selectable club, as the Zod refinement does", () => {
    expect(clubs.checks).toContain(
      "selectable is false or (colors is not null and jersey_pattern is not null and founded is not null and city is not null)",
    );
  });
  it("gives a country to opponents only, as an ISO alpha-2 code", () => {
    expect(clubs.checks).toContain("(selectable is false) = (country is not null)");
    expect(clubs.checks).toContain("country ~ '^[A-Z]{2}$'");
  });
});
