import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "../../../.claude/hooks/guard-files.mjs";

const root = resolve("proj-root");
const run = (p, unlocked = false) => evaluate(p, { root, unlocked });

describe("guard-files", () => {
  it.each([
    ".env",
    ".env.local",
    "apps/web/.env.production",
    ".claude/settings.json",
    ".claude/hooks/guard-bash.mjs",
    ".github/workflows/ci.yml",
    ".claude/AUTOPILOT_OFF",
    ".claude/GUARDRAILS_UNLOCK",
  ])("blocks %s", (p) => {
    expect(run(p)).toBeTypeOf("string");
  });

  it.each([
    "src/app/page.tsx",
    ".env.example",
    ".claude/agents/planner.md",
    ".claude/skills/plan/SKILL.md",
    ".github/pull_request_template.md",
    "docs/adr/0001-record-decisions.md",
    "",
  ])("allows %s", (p) => {
    expect(run(p)).toBeNull();
  });

  it("resolves absolute paths against the project root", () => {
    const abs = join(root, ".claude", "settings.json");
    expect(run(abs)).toBeTypeOf("string");
  });

  it("allows guardrail edits when unlocked, but never env files or switches", () => {
    expect(run(".claude/settings.json", true)).toBeNull();
    expect(run(".github/workflows/ci.yml", true)).toBeNull();
    expect(run(".env", true)).toBeTypeOf("string");
    expect(run(".claude/AUTOPILOT_OFF", true)).toBeTypeOf("string");
    expect(run(".claude/GUARDRAILS_UNLOCK", true)).toBeTypeOf("string");
  });
});
