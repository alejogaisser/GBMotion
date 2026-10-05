# 0001. ElevenLabs Scribe v2 as primary transcription, Groq whisper-large-v3 as alternative
- Date: 2026-10-04
- Status: accepted
- Decision: Auto-subtitles call ElevenLabs Scribe v2 (word timestamps) as the primary provider and Groq `whisper-large-v3` as the alternative, both via plain `fetch` from `server/transcribe.ts`. Keys come only from `.env.local` through `loadEnv` (no `VITE_` prefix) and never reach the bundle, responses or logs. `GB_TRANSCRIBE_MOCK=1` serves a fixture, and results are cached per media, provider and language.
- Reason: Best hosted Spanish accuracy with native word timings at $0.22/h. OpenAI's current models have no word timestamps, and local whisper.cpp only has Windows binaries up to 1.6.0. Run 1 passed AC25–AC28 with the mock; the real-key check (AC29) is still blocked.
