#!/usr/bin/env node
// PreToolUse hook for Edit|Write|MultiEdit. Exit code 2 blocks the call.
import { readFileSync, existsSync } from "node:fs";
import { relative, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {string} filePath
 * @param {{ root: string, unlocked: boolean }} ctx
 * @returns {string | null} reason to block, or null to allow
 */
export function evaluate(filePath, ctx) {
  if (!filePath) return null;
  const rel = relative(ctx.root, resolve(ctx.root, filePath)).replaceAll("\\", "/");
  const name = basename(rel);

  if (/^\.env(\..+)?$/.test(name) && name !== ".env.example")
    return "env files cannot be read or written";
  if (rel === ".claude/AUTOPILOT_OFF" || rel === ".claude/GUARDRAILS_UNLOCK")
    return "the safety switches are managed by Diego only";

  const protectedPath =
    rel === ".claude/settings.json" ||
    rel.startsWith(".claude/hooks/") ||
    rel.startsWith(".github/workflows/");
  if (protectedPath && !ctx.unlocked)
    return "guardrails are locked: Diego must create .claude/GUARDRAILS_UNLOCK to change them";
  return null;
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const filePath = String(input?.tool_input?.file_path ?? "");
  const reason = evaluate(filePath, {
    root,
    unlocked: existsSync(`${root}/.claude/GUARDRAILS_UNLOCK`),
  });
  if (reason) {
    process.stderr.write(`guard-files blocked: ${reason}\nFile: ${filePath}\n`);
    process.exit(2);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
