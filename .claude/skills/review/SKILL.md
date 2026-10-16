---
name: review
description: Runs in parallel the auditors that apply to the diff and consolidates a verdict. Usage: /review
---

1. Look at `git diff --name-only origin/main...HEAD` and pick the auditors:
   - always: code-reviewer and security-auditor
   - if it touches src/app, src/components or styles: ui-designer-auditor
   - if it touches data/, scripts/, src/domain, src/data or supabase/: data-integrity-auditor
2. Launch them in parallel.
3. Consolidate a report in `docs/plans/NNNN-slug.review.md` with each verdict and its findings.
4. If any says CHANGES REQUIRED: fix with TDD and repeat /review (at most 3 rounds; then stop and tell Diego).
5. If all approve: continue with /ship.
