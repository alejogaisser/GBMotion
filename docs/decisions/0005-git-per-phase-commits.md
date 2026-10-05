# 0005. The project uses git with one commit per phase
- Date: 2026-10-04
- Status: accepted
- Decision: GB Motion is a git repository (github.com/alejogaisser/GBMotion, branch `main`). Each plan phase and each fix cycle ends in its own commit (Run 1: bd21a8e F0, cc26ea2 F1, 6709d40 F2+3, 8ad3e7a F4, 471364d fix). This replaces the "no git, back up `src/` to `backups/` first" rule from the original plan.
- Reason: Per-phase commits give a reversible baseline and make regressions easy to bisect; the manual backup step is no longer needed.
