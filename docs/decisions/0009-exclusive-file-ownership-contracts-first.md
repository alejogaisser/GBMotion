# 0009. Exclusive file ownership between two agents, contracts first
- Date: 2026-10-11
- Status: accepted
- Decision: When Claude and Codex work in parallel, every file has exactly one owner and nothing is shared (`vite.config.ts` and `package.json` scripts belong to Codex for the whole run). A change outside one's own files is requested by message. Codex publishes a commit of frozen contracts and types (stubs allowed) before Claude touches `App.tsx`; Claude announces the entrypoints before Codex applies the MPA config. Route, runtime and browser tests run only on the integrated branch.
- Reason: Disjoint ownership produced no merge conflicts in the run, and the frozen contracts let the UI and the hooks and server advance in parallel. It extends 0005 (one commit per step, announced hash).
