import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { FILE_SCHEMAS, KEY_FIELDS, type DatasetFile } from "@/data-model/schemas";
import { loadModel } from "./migrations";
import { enumValues, type Table } from "./sql-model";

const { model } = loadModel();

type Def = {
  type: string;
  innerType?: ZodType;
  options?: string[];
  shape?: Record<string, ZodType>;
};
const defOf = (f: ZodType): Def => (f as unknown as { _zod: { def: Def } })._zod.def;

/** Strips optional/nullable wrappers; returns the inner type and whether the column may be null. */
function unwrap(field: ZodType): { inner: ZodType; nullable: boolean } {
  let inner = field;
  let nullable = false;
  for (;;) {
    const def = defOf(inner);
    if (def.type !== "nullable" && def.type !== "optional") return { inner, nullable };
    nullable = true;
    inner = def.innerType!;
  }
}

function sqlType(inner: ZodType): string {
  const { type } = defOf(inner);
  if (type === "boolean") return "boolean";
  if (type === "number") return "integer";
  if (type === "array") return "text[]";
  if (type === "object") return "jsonb";
  if (type === "enum") return "text";
  // Strings: a calendar date accepts "2020-01-01" and rejects arbitrary text.
  const isDate = inner.safeParse("2020-01-01").success && !inner.safeParse("abc").success;
  return isDate ? "date" : "text";
}

function column(table: Table, name: string) {
  const c = table.columns.find((col) => col.name === name);
  if (c === undefined) throw new Error(`${table.name}.${name} is missing`);
  return c;
}

describe.each(Object.entries(FILE_SCHEMAS) as [DatasetFile, ZodType][])("%s", (file, schema) => {
  const name = file.replace(/\.json$/, "");
  const shape = defOf(schema).shape!;
  const table = model.tables.get(name);

  it("has a table with exactly the schema keys as columns", () => {
    expect(table).toBeDefined();
    expect(table!.columns.map((c) => c.name).sort()).toEqual(Object.keys(shape).sort());
  });
  it("matches nullability and SQL type of every field", () => {
    for (const [key, field] of Object.entries(shape)) {
      const { inner, nullable } = unwrap(field);
      const col = column(table!, key);
      expect(col.nullable, `${name}.${key} nullable`).toBe(nullable);
      expect(col.type, `${name}.${key} type`).toBe(sqlType(inner));
    }
  });
  it("has the same enum values in the check constraints", () => {
    for (const [key, field] of Object.entries(shape)) {
      const { inner } = unwrap(field);
      const def = defOf(inner);
      if (def.type !== "enum") continue;
      expect(enumValues(table!, key), `${name}.${key}`).toEqual(
        (inner as unknown as { options: string[] }).options,
      );
    }
  });
  it("requires a non-blank source", () => {
    expect(table!.checks.join(" | ")).toMatch(/source ~ '\\S'/);
  });
  it("uses the same primary key as recordKey", () => {
    expect(table!.primaryKey).toEqual(KEY_FIELDS[file].fields);
  });
  it("rejects empty slugs in key columns", () => {
    for (const key of KEY_FIELDS[file].fields) {
      if (key === "from") continue;
      expect(table!.checks.join(" | "), `${name}.${key}`).toContain(`${key} <> ''`);
    }
  });
});
