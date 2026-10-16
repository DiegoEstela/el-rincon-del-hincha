---
name: ship
description: Publishes the branch, opens the PR, waits for CI and squash-merges if everything is green. Usage: /ship
---

1. `git push -u origin <branch>`.
2. `gh pr create` using the template: summary, `Closes #N`, plan link, review report and mobile screenshots if there is UI.
3. If all auditors approved: `gh pr edit --add-label agentes:aprobado`.
4. Wait for CI (`gh pr checks --watch`). If it fails: diagnose, fix on the same branch, go back to /review if the change is relevant, and push.
5. With everything green: `gh pr merge --squash --delete-branch`.
6. Verify the preview deploy and then production, and tell Diego in 2 lines what shipped.
