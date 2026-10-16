import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMigrations, type Model } from "./sql-model";

// SUPABASE_MIGRATIONS_DIR lets a mutation run point the tests at a modified copy of the migrations.
export const MIGRATIONS_DIR =
  process.env["SUPABASE_MIGRATIONS_DIR"] ?? join(process.cwd(), "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export function loadModel(): { files: string[]; sql: string[]; model: Model } {
  const files = migrationFiles();
  const sql = files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  return { files, sql, model: parseMigrations(sql) };
}
