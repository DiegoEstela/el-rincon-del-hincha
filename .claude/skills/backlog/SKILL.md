---
name: backlog
description: Walks through the open issues of the current milestone and runs the full cycle for each. Usage: /backlog [milestone]
---

For each open issue of the milestone, in priority order (labels p0 > p1 > p2) and respecting dependencies:
/plan -> /build -> /review -> /ship.
Stop only at the human checkpoints defined in CLAUDE.md. At the end, show a table with the closed issues, the PRs and the resulting version.
