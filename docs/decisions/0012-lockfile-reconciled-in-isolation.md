# 0012. Lockfile reconciled and installs allowed only in isolated checkout and store
- Date: 2026-10-11
- Status: accepted
- Decision: Exception to 0003 approved by Alejo. `pnpm-lock.yaml` is reconciled to the versions already declared, and `pnpm install` may run only in a temporary checkout with its own store and no `node_modules` (`scripts/validate-reproducible-install.mjs`). Still forbidden: adding or changing declared versions, and installing or pruning the shared `node_modules`. The effective pnpm is 11.25.0 (fallback runtime) while the repo declares 11.19.0, and results are reported with the version actually used.
- Reason: The lockfile did not list hand-unpacked packages, so a clean install could not be reproduced. Reconciling it in isolation proves reproducibility without the prune risk that motivated 0003. AC37 passed.
