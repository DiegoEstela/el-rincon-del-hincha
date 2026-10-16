#!/usr/bin/env node
// PostToolUse hook for Edit|Write|MultiEdit. Runs Prettier on the touched file. Never blocks.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const FORMATTABLE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".css",
  ".md",
  ".yml",
  ".yaml",
]);

export function shouldFormat(filePath) {
  return Boolean(filePath) && FORMATTABLE.has(extname(filePath).toLowerCase());
}

function main() {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const filePath = String(input?.tool_input?.file_path ?? "");
    if (shouldFormat(filePath) && existsSync(filePath)) {
      spawnSync("pnpm", ["exec", "prettier", "--write", filePath], {
        cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
        stdio: "ignore",
        shell: process.platform === "win32",
      });
    }
  } catch {
    /* formatting must never block */
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
