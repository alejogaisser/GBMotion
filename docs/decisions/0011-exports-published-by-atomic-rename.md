# 0011. Exports are published only when finished, by atomic rename
- Date: 2026-10-11
- Status: accepted
- Decision: A render writes `gb-motion-<kind>-<ts>.partial-<uuid>.<ext>` and renames it to the final name only after a successful, non-cancelled finish with the handles closed. `/api/exports` and `/exports/*` list and serve only final, non-empty files; the `.partial-*` file is removed in `finally` on cancel or error. `validateRenderInput` rejects invalid bodies with 400 before reserving a job, and `pruneFinishedJobs` limits finished jobs (20, one hour).
- Reason: The final filename used to exist during the render, so a cancelled or failed job left a listed file that looked valid. AC12, AC13 and AC19 passed.
