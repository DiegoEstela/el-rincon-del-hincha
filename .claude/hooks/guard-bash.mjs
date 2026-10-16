#!/usr/bin/env node
// PreToolUse hook for Bash. Exit code 2 blocks the tool call and returns the reason to Claude.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PROTECTED = /\.claude\/(hooks|settings\.json)|\.github\/workflows/;
const WRITE_OPS =
  /(^|[^2&])>|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b|\bchmod\b|\bln\b|\btruncate\b|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|writeFile|appendFile|rmSync|renameSync|copyFile/;
// `.env`, `.env.local`, `path/.env.production` ... but not `process.env`, `import.meta.env` or `.env.example`.
const ENV_FILE = /(^|[\s/\\"'=])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s"';|&)])/;
const SWITCHES = /(GUARDRAILS_UNLOCK|AUTOPILOT_OFF)/;

export function pushesToMain(cmd) {
  const m = cmd.match(/\bgit\s+push\b([^|;&]*)/);
  if (!m) return false;
  return m[1]
    .split(" ")
    .filter((t) => t && !t.startsWith("-"))
    .some((t) => {
      const ref = t
        .replace(/^\+/, "")
        .split(":")
        .pop()
        .replace(/^refs\/heads\//, "");
      return ref === "main" || ref === "master";
    });
}

/**
 * @param {string} rawCmd
 * @param {{ branch: string, autopilotOff: boolean, unlocked: boolean, sh: (c: string) => string }} ctx
 * @returns {string | null} reason to block, or null to allow
 */
export function evaluate(rawCmd, ctx) {
  const cmd = String(rawCmd ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const hardRules = [
    [/\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/, "force push is forbidden"],
    [/--no-verify\b/, "git hooks must not be skipped"],
    [/\bgit\s+branch\s+-[dD]\s+(main|master)\b/, "main must not be deleted"],
    [/\bgit\s+push\b.*--delete\s+(origin\s+)?(main|master)\b/, "main must not be deleted"],
    [/\bgit\s+reset\s+--hard\b.*\b(main|master)\b/, "hard reset on main is forbidden"],
    [/\bgh\s+repo\s+delete\b/, "deleting the repo is forbidden"],
    [/\bvercel\b.*--prod\b/, "production is only deployed by merging to main"],
    [/\brm\s+-[a-z]*r[a-z]*\s+(\/|~|\*|\.\/?)(\s|$)/, "mass deletion is forbidden"],
    [ENV_FILE, "env files must not be accessed from the shell"],
    [SWITCHES, "the safety switches are managed by Diego only"],
  ];
  for (const [re, msg] of hardRules) if (re.test(cmd)) return msg;

  if (pushesToMain(cmd)) return "direct push to main is forbidden: use a branch and a PR";

  if (!ctx.unlocked && PROTECTED.test(cmd) && WRITE_OPS.test(cmd))
    return "guardrails (hooks, settings, workflows) cannot be modified from the shell";

  if (["main", "master"].includes(ctx.branch) && /\bgit\s+(commit|push|merge|rebase)\b/.test(cmd))
    return "you are on main: create a branch first";

  if (ctx.autopilotOff && /\bgit\s+push\b|\bgh\s+pr\s+(create|merge)\b/.test(cmd))
    return "autopilot is off (.claude/AUTOPILOT_OFF): no push, PR or merge";

  if (/\bgh\s+pr\s+merge\b/.test(cmd)) {
    if (!/--squash\b/.test(cmd)) return "merge is only allowed with --squash";
    const n = (cmd.match(/\bgh\s+pr\s+merge\s+(\d+)/) || [])[1] ?? "";
    try {
      ctx.sh(`gh pr checks ${n} --required`);
    } catch {
      return "there are pending or failing required checks";
    }
    let labels = "";
    try {
      labels = ctx.sh(`gh pr view ${n} --json labels --jq ".labels[].name"`);
    } catch {
      return "could not read the PR labels";
    }
    if (!labels.split("\n").includes("agentes:aprobado"))
      return "missing label agentes:aprobado (run /review first)";
  }
  return null;
}

function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const cmd = String(input?.tool_input?.command ?? "");
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const sh = (c) =>
    execSync(c, { cwd: root, stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
  let branch = "";
  try {
    branch = sh("git rev-parse --abbrev-ref HEAD");
  } catch {
    /* not a repo yet */
  }
  const reason = evaluate(cmd, {
    branch,
    autopilotOff: existsSync(`${root}/.claude/AUTOPILOT_OFF`),
    unlocked: existsSync(`${root}/.claude/GUARDRAILS_UNLOCK`),
    sh,
  });
  if (reason) {
    process.stderr.write(`guard-bash blocked: ${reason}\nCommand: ${cmd}\n`);
    process.exit(2);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
