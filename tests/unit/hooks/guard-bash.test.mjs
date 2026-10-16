import { describe, expect, it } from "vitest";
import { evaluate } from "../../../.claude/hooks/guard-bash.mjs";

const base = { branch: "feat/1-thing", autopilotOff: false, unlocked: false };
const okSh = () => "agentes:aprobado\nother";
const run = (cmd, ctx = {}) => evaluate(cmd, { ...base, sh: okSh, ...ctx });

describe("guard-bash: must block", () => {
  it.each([
    "git push --force origin feat/x",
    "git push -f",
    "git push --force-with-lease",
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin +feat/x:refs/heads/main",
    "git commit -m x --no-verify",
    "git branch -D main",
    "git push origin --delete main",
    "gh repo delete DiegoEstela/rincon-del-hincha",
    "vercel --prod",
    "vercel deploy --prod",
    "rm -rf /",
    "rm -rf ~",
    "rm -rf *",
    "cat .env",
    "cat .env.local",
    "type apps/web/.env.production",
    "touch .claude/AUTOPILOT_OFF",
    "echo x > .claude/GUARDRAILS_UNLOCK",
    "echo x > .claude/settings.json",
    "sed -i s/a/b/ .claude/hooks/guard-bash.mjs",
    "rm .github/workflows/ci.yml",
    "Set-Content .github/workflows/ci.yml 'x'",
  ])("%s", (cmd) => {
    expect(run(cmd)).toBeTypeOf("string");
  });

  it("blocks commit/push/merge/rebase while on main", () => {
    for (const c of ["git commit -m x", "git push", "git merge feat", "git rebase main"])
      expect(run(c, { branch: "main" })).toMatch(/main/);
  });

  it("blocks push, PR create and merge when autopilot is off", () => {
    for (const c of ["git push -u origin feat/x", "gh pr create --fill", "gh pr merge 3 --squash"])
      expect(run(c, { autopilotOff: true })).toMatch(/autopilot/);
  });

  it("blocks merge without --squash", () => {
    expect(run("gh pr merge 3")).toMatch(/squash/);
  });

  it("blocks merge when required checks fail", () => {
    const sh = () => {
      throw new Error("fail");
    };
    expect(run("gh pr merge 3 --squash", { sh })).toMatch(/checks/);
  });

  it("blocks merge without the approval label", () => {
    const sh = (c) => (c.includes("checks") ? "" : "bug\nenhancement");
    expect(run("gh pr merge 3 --squash", { sh })).toMatch(/agentes:aprobado/);
  });
});

describe("guard-bash: must allow", () => {
  it.each([
    "pnpm test",
    "pnpm lint && pnpm typecheck",
    "git status",
    "git push -u origin feat/1-main-menu",
    "git push origin feat/2-thing",
    "git add .github/workflows/ci.yml",
    "git diff .claude/settings.json",
    "cat .claude/settings.json",
    "cat .env.example",
    'node -e "console.log(process.env.HOME)"',
    "rm -rf node_modules",
    "rm -rf .next",
    "gh pr create --fill",
    "gh issue create --title x",
  ])("%s", (cmd) => {
    expect(run(cmd)).toBeNull();
  });

  it("allows a squash merge with green checks and the label", () => {
    expect(run("gh pr merge 3 --squash --delete-branch")).toBeNull();
  });

  it("allows editing guardrails from the shell when unlocked", () => {
    expect(run("echo x > .claude/settings.json", { unlocked: true })).toBeNull();
  });

  it("allows local commits on a feature branch with autopilot off", () => {
    expect(run("git commit -m 'feat: x'", { autopilotOff: true })).toBeNull();
  });
});
