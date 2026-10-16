# 0002 — Next.js + Vercel stack

## Context

We need a mobile-first app with SSR/ISR, dynamic OG images and a free hosting tier.

## Decision

Next.js (App Router, currently v16) with strict TypeScript, Tailwind CSS v4, Motion, Zod, Vitest and Playwright, managed with pnpm and deployed on Vercel Hobby. Data lives in Supabase (free plan) fed from a versioned dataset in `data/`.

## Consequences

- Next 16 differs from earlier versions (e.g. `cacheComponents`); the scaffolded `AGENTS.md` tells agents to read `node_modules/next/dist/docs/` first.
- pnpm 12 blocks dependency build scripts by default; allowed ones are listed in `pnpm-workspace.yaml` (`esbuild`).
- Free-plan limits (Supabase pausing on inactivity, API-Football quotas) are documented in ADR 0003 and ADR 0006 during Phase 1.
