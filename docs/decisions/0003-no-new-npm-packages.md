# 0003. No new npm packages; never run pnpm install
- Date: 2026-10-04
- Status: accepted
- Decision: New features use only Node 24 built-ins, the ffmpeg/ffprobe bundled with `@remotion/compositor-win32-x64-msvc`, and what `remotion` 4.0.518 already exports. `pnpm install` and `pnpm add` are not run; a required package is unpacked by hand, the same way as the fonts.
- Reason: `pnpm-lock.yaml` does not list the hand-unpacked packages (for example `@fontsource/big-shoulders-display`), so pnpm would prune them. Run 1 shipped server, media, transcription and burn-in with zero added dependencies.
