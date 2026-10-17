# Review of plan 0008: Onboarding with club theming (issue #40)

Date: 2026-10-17 · Branch: `feat/40-onboarding` · Round: 1 of 3

## Verdicts

| Auditor                | Verdict  | Blocking findings |
| ---------------------- | -------- | ----------------- |
| code-reviewer          | APPROVED | 0                 |
| security-auditor       | APPROVED | 0                 |
| ui-designer-auditor    | APPROVED | 0                 |
| data-integrity-auditor | APPROVED | 0                 |

**Consolidated verdict: APPROVED.**

## Findings and what was done

### Fixed in this round

- **Step label before the `<legend>`** (code-reviewer: important; ui-designer-auditor: low). "Paso N de 2" sat inside the `<fieldset>` before the `<legend>`. It now sits above the fieldset, so the legend is the first child. Component tests still pass.

### Accepted, no change (non-blocking)

- **Banner flash on submit** (code-reviewer): the "¡Volviste!" banner can show for a moment between the write and the navigation. Accepted; revisit if it shows on the live site.
- **`memory` in `fan-storage.ts` is module state** (code-reviewer): only client code calls the writers. The module is documented as client-only by its header and its use.
- **Four copies of the `v === 1` plus slug check** (code-reviewer): the boot script must be a standalone string; the others are pinned by tests. Left as is.
- **Hero CTA for a returning visitor** (code-reviewer): product choice for Diego.
- **"Elegiste a X" is not announced** (ui-designer-auditor, low): the radio already announces its checked state.
- **Nested `radiogroup` inside `fieldset`** (ui-designer-auditor, low): kept on purpose so the group has the accessible name "Elegí tu club" and a programmatic focus target.
- **`.returning-slot` gap with a stale club id** (ui-designer-auditor, low): a short gap for a rare case.
- **"Ver mi historia" appears twice** (ui-designer-auditor, info): same destination in both places; the copy table was approved as is.
- **Screenshot stability and bottom bar overlap** (ui-designer-auditor, info): to check on the live site.
- **Bundle size and Lighthouse** (ui-designer-auditor): not measured here; budgets belong to issue #18 and CI.

### Follow-ups outside #40

- **Security headers and CSP** (security-auditor, low): the app sets none. When a strict CSP is added, the boot script needs a hash. Suggest a new issue.
- **`braces` advisory GHSA-vfj7-8cjw-p6xm** (security-auditor, info): dev-only transitive dependency through `eslint-config-next`, no patch yet. Not caused by this branch.
- **Ignore `coverage/` in ESLint** (code-reviewer): removes the one lint warning; separate change.
- **Note in `docs/methodology.md`** (data-integrity-auditor, optional): a future start date is valid at the `period.ts` level (empty period).

## Checks run by the auditors

`pnpm typecheck`, `pnpm lint` (0 errors), `pnpm test` (1103 passed), `pnpm data:validate` (ok). Data integrity: `data/` untouched, accent snapshot equal to the approved table, start date bounds equal to the database. The data auditor had no network access, so no external cross-check was possible; this diff adds no sports figures.
