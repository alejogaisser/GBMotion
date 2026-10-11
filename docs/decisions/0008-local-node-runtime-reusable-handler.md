# 0008. Local Node runtime with a reusable handler and health v1
- Date: 2026-10-11
- Status: accepted
- Decision: `server/app.ts` exports `createGbMotionHandler` (services: `/api/*`, `/media/*`, `/exports/*`); `server/plugin.ts` (Vite dev) and `server/runtime.ts` (production, `node --experimental-strip-types`, `127.0.0.1` only, serves `dist`) are thin transports. `GET /api/health` returns `{version:1, mode:'local', transcriptionMode, capabilities:{upload,render,transcribe}}`; the client reads it with `useServerCapabilities({ isBusy })`, which makes no queries while an export is active. `INICIAR_GB_MOTION.cmd` starts this same entrypoint, never Vite.
- Reason: Alejo wanted GB Motion to run without Vite and to degrade with a visible reason when there is no server. Separating transport from services leaves room for a remote transport later without reusing `mode:'local'` silently. AC7, AC8 and AC32 passed.
