<!-- dev-team plan -->
# GB Motion: redesign, fixes, AI auto-subtitles and burned-in export

## Handoff

### Goal
GB Motion becomes a full subtitle tool in Spanish. You upload a video, AI transcribes it with word timings, and every caption picks up your own styles, effects and word highlighting. You then export either the green MP4 for CapCut or the final video with the subtitles burned in. Every existing feature stays, and the known bugs are fixed.

### Context
- `src/App.tsx`: all editor state, export (`exportVideo`), guide-video logic, presets, captions import, split, undo. Most behavior changes start here.
- `vite.config.ts`: dev-server middleware `/api/render`, `/api/exports`, `/exports/*`. The render runs as a job with progress and cancel.
- `src/remotion/TextComposition.tsx`, `Root.tsx`: the composition shared by the Player and the Renderer, plus the guide `<Video>`.
- `src/engine/textPaint.ts`: the paint rules (lessons below). `textLayout.ts` is the auto-fit heuristic. `layerAnimation.ts` holds the in/hold/out phases.
- `src/utils/{editor,project,subtitles,storage}.ts`: MAX_LAYERS, history, keyword remap, project sanitizing, SRT/VTT, combo storage (currently unused).
- `src/components/*`: GuidePanel, OutputPanel, WordTimingPanel, TimelineDock, CanvasOverlay, MotionPanel, StyleGallery/Tuner, TextPanel, CaptionTools, LibraryPanel, SavePresetModal, KeyframePanel, FontBrowser.
- `scripts/validate-*.mjs`, `scripts/render-editor-smoke.mjs`: the existing tests and the smoke render.
- `docs/V2_AUDIT.md`, `REVISION_2026-09-02.md`, `MEJORAS_2026-09-09.md`, `FASE_7.md`: earlier audits and open items.
- `node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.518/node_modules/@remotion/compositor-win32-x64-msvc/{ffmpeg,ffprobe}.exe`: the bundled ffmpeg.
- Docs: Remotion OffthreadVideo https://www.remotion.dev/docs/offthreadvideo · ElevenLabs STT https://elevenlabs.io/docs/api-reference/speech-to-text/convert · Groq STT https://console.groq.com/docs/speech-to-text · Vite env https://vite.dev/config/#using-environment-variables-in-config

### Constraints
- Keep React 19 + TypeScript + Vite 8 + Remotion 4.0.518. Do not migrate the stack, add no UI framework (Tailwind, shadcn) and no state library.
- **Zero new npm packages.** Use Node 24 built-ins (`fetch`, `FormData`, `Blob`, `child_process`, `AbortSignal.timeout`), the bundled ffmpeg/ffprobe, and `OffthreadVideo`/`useRemotionEnvironment` from `remotion`. **Never run `pnpm install/add`.** The lockfile does not contain the hand-unpacked packages (for example `@fontsource/big-shoulders-display`), so pnpm would prune them.
- The environment has no git. Phase 0 makes a full backup before any edit.
- All UI text is in Spanish (rioplatense "vos", as today). Times are shown in seconds, never in frames.
- API keys are read only server-side, through `loadEnv(mode, cwd, '')` in `vite.config.ts`. Variable names are not prefixed with `VITE_`. A key never appears in a response, a log, an error message or `dist/`.
- Render lessons from `textPaint.ts` (do not regress):
  - The outer stroke uses `text-shadow`, never chained `drop-shadow`.
  - Stroke ring steps scale with the stroke width.
  - Paint goes on the span that holds the text. **Any element that gets its own `transform`/`filter` must carry `paintCss` itself.**
  - Use `visibility`, not `opacity`, to hide words.
  - A preset imposes its own `mode`.
  - The guide blob URL is revoked only on unmount, through a ref.
- Verify render changes with a real export plus ffprobe or frame extraction, not with in-browser timing.
- Keep the build green and all validators passing after **every** phase.

### Files to touch
- `backups/before-redesign-20261003/` (create): copy of `src/`, `scripts/`, `docs/`, `vite.config.ts`, `package.json`, `tsconfig*.json`, `index.html`, `README.md`, `INICIAR_GB_MOTION.cmd`.
- `server/http.ts` (create): `readBody`, `json`, `isAllowedOrigin`, `parseRange`.
- `server/ffmpeg.ts` (create): binary resolution, `probe`, `extractAudio`.
- `server/media.ts` (create): upload, serving with Range, HEAD.
- `server/render.ts` (create): the render jobs moved out of the config, plus burn-in, format validation, and one job at a time.
- `server/transcribe.ts` (create): providers, jobs, result cache, error mapping.
- `server/plugin.ts` (create): the Vite plugin that wires every route.
- `vite.config.ts` (modify): slimmed down. Uses `loadEnv`, `server.watch.ignored`, and the new plugin.
- `tsconfig.node.json` (modify): include `server/**/*.ts` and `src/captions/**/*.ts`.
- `src/captions/{types,group,toLayers,providers}.ts` (create): pure caption logic, shared by the server and the tests.
- `src/engine/wordHighlight.ts` (create): per-word highlight CSS for every mode.
- `src/types/motion.ts`, `src/utils/editor.ts`, `src/utils/project.ts`, `src/engine/layerAnimation.ts`, `src/engine/textLayout.ts` (modify): the fixes and the new fields.
- `src/remotion/TextComposition.tsx`, `src/remotion/Root.tsx` (modify): highlight modes, `OffthreadVideo` at render time, video length in the duration.
- `src/utils/mediaClient.ts` (create): upload through XHR with progress, polling of transcription jobs.
- `src/components/AutoCaptionsPanel.tsx` (create). `GuidePanel.tsx`, `OutputPanel.tsx`, `WordTimingPanel.tsx`, `CanvasOverlay.tsx`, `src/App.tsx` (modify).
- Run 2: `src/hooks/{useProject,useGuide,useExport,useTranscription}.ts`, `src/components/{SubtitlesPanel,EmptyState,SafeZoneOverlay}.tsx` (create). `TimelineDock.tsx`, `App.tsx` (modify). `src/styles/*.css` (create), with `src/styles.css` reduced to `@import` lines.
- `scripts/validate-captions.mjs`, `scripts/validate-server.mjs`, `scripts/fixtures/{elevenlabs-es,groq-es}.json` (create). `package.json` (modify: test scripts only).
- `.env.example` (create). `.gitignore` (modify: `.env`, `.env*.local`, `media/`, `exports/*.mov`). `README.md` (modify).

### Out of scope
- Local whisper.cpp provider, translation or dubbing, automatic emoji, LLM keyword picking, silence cutting, b-roll, auto-zoom, 4K or 60 fps output, cloud deployment.
- Replacing the heuristic auto-fit with real font measurement.
- Moving autosave from localStorage to IndexedDB.
- Changing any existing preset, style or font.

### Acceptance criteria
Run 1 covers AC1–AC31. Run 2 covers AC32–AC42. Steps marked UI use `http://127.0.0.1:4173` with the dev server running. Test media: any Spanish talking clip of 20–60 s (`S.mp4`). Without one, generate `T.mp4` with `ffmpeg -f lavfi -i testsrc2=s=1080x1920:r=30 -f lavfi -i sine=f=440 -t 8 -c:v libx264 -c:a aac T.mp4`.
- AC1: A full backup exists before the first code edit. Check: `find backups/before-redesign-20261003/src -type f | wc -l` vs `find src -type f | wc -l`, run before Phase 1. Pass: the two counts are equal.
- AC2: TypeScript compiles. Check: `node node_modules/typescript/bin/tsc -b --pretty false`. Pass: exit 0, no output.
- AC3: The production build succeeds. Check: `node node_modules/vite/bin/vite.js build`. Pass: exit 0.
- AC4: The existing validators pass. Check: `node --experimental-strip-types scripts/validate-{font-registry,motion-engine,editor}.mjs`. Pass: prints `FONT_REGISTRY_OK`, `MOTION_ENGINE_OK` and `EDITOR_OK`.
- AC5: The caption logic is covered by tests. Check: `node --experimental-strip-types scripts/validate-captions.mjs`. Pass: prints `CAPTIONS_OK`. The asserts cover:
  - grouping by word count, by characters, on silence and on punctuation, and filler removal;
  - contiguous word frames;
  - `remapWordTiming` and `splitWordTiming`;
  - mapping the fixture responses of both providers, including Groq punctuation recovery;
  - the uppercase layout (AC12) and the exit anchoring (AC13);
  - the new `wordTiming` modes surviving `parseProjectFile`.
- AC6: The server helpers are covered by tests. Check: `node --experimental-strip-types scripts/validate-server.mjs`. Pass: prints `SERVER_OK`. The asserts cover:
  - `readBody` decoding a `ñ` split across 2 chunks;
  - `parseRange`;
  - `isAllowedOrigin`;
  - `isSupportedFormat` rejecting 1920×1920;
  - the provider error mapping never containing the key string.
- AC7 (B1): "Combinación completa" saves both look and motion. Check (UI):
  1. Turn on «Ajustes finos».
  2. Click Save, choose «Combinación completa», name it "Mi combo".
  3. Reload the page and open «Estilo → Combinaciones».
  4. Apply "Mi combo" to another phrase.
  Pass: "Mi combo" is listed with a delete button, and applying it sets that phrase's typography and in/out effects equal to the saved ones.
- AC8 (B2): The render endpoint only accepts the offered formats. Check: `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4173/api/render -H "Content-Type: application/json" -d '{"props":{...demo},"format":{"id":"x","width":1920,"height":1920},"kind":"green"}'`. Pass: `400`. The same request with `{"id":"portrait","width":1080,"height":1920}` returns `202`.
- AC9 (B3): Large Spanish payloads render intact. Check: smoke render with 150 layers whose text is `¿QUÉ PASÓ? ÑANDÚ ÁÉÍÓÚ` (body larger than 200 KB). Then extract frame 5 with ffmpeg. Pass: the job finishes, and the frame shows the accented text with no `�` replacement characters.
- AC10 (B4): Editing caption text keeps the word timings of unchanged words. Check (UI):
  1. Use a phrase with word timings `HOLA A TODOS`.
  2. Change the text to `HOLA A TODOS USTEDES`.
  Pass: «Sincronizar palabra por palabra» still lists the original starts for HOLA, A and TODOS, plus an added row for USTEDES.
- AC11 (B5): Splitting keeps timings on both halves. Check (UI): split a phrase that has word timings at the playhead between word 2 and word 3. Pass: the first half keeps words 1–2 with their original starts. The second half has words 3+ rebased to its own start, with the same absolute times (within ±1 frame).
- AC12 (B6): Auto-fit accounts for uppercase. Check: covered by AC5. Pass: a lowercase 60-character text yields a smaller `fontSize` with `uppercase: true` than with `uppercase: false`.
- AC13 (B7): The exit animation is anchored to the end of a manual clip. Check: covered by AC5, using a layer with manual `durationFrames=120`, in=18, out=18. Then in the UI, stretch a clip that has an exit. Pass: `getAnimationPhase(...,110).kind === 'out'` and `(...,60).kind === 'hold'`. In the preview, the exit plays in the last 0.6 s of the clip.
- AC14 (B8): Deleting a custom motion preset cleans up the layers that use it. Check (UI): save a custom motion preset, apply it as the entry effect, then delete it. Pass: the phrase's «Entrada» shows the default preset, and no layer has `animation.in.preset.id` equal to the deleted id (inspect the downloaded project JSON).
- AC15 (B15): The local API rejects foreign websites. Check: `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:4173/api/render -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{}'`. Pass: `403`. The same request with `Origin: http://127.0.0.1:4173` reaches validation and returns `400`.
- AC16: Only one render runs at a time. Check: start two exports within 1 s, using curl or two tabs. Pass: the second request gets `409` with the message `Ya hay un video en proceso. Esperá a que termine o cancelalo.`
- AC17: Uploading a video stores it and probes it. Check: `curl -s -X POST localhost:4173/api/media -H "Content-Type: application/octet-stream" -H "X-File-Name: T.mp4" --data-binary @T.mp4`. Pass: `201`, with JSON `{mediaId, durationInFrames, width, height, hasAudio}`. `durationInFrames` equals `round(ffprobe duration × 30)`, and the file exists in the media folder.
- AC18: Media is served with byte ranges. Check: `curl -s -D - -r 0-99 localhost:4173/media/<mediaId> -o part.bin`. Pass: status `206`, header `Content-Range: bytes 0-99/<size>`, and `part.bin` is 100 bytes.
- AC19: Error path for an unreadable video. Check: upload a text file named `fake.mp4`. Pass: `422` with `{"error":"No pude leer ese video. Probá con un MP4."}`, and no new file remains in the media folder.
- AC20: The video re-links after a reload. Check (UI):
  1. Load `T.mp4` in «Video» and wait for «Video guardado».
  2. Reload the page.
  Pass: «Video» shows the file loaded without re-selecting it, and the preview plays its frames.
- AC21: The burned-in export works and keeps the original audio. Check (UI):
  1. Load `T.mp4` and add 2 phrases.
  2. Click «Exportar → Video con tus subtítulos».
  3. Run `ffprobe -show_streams` on the output.
  4. Extract a frame while a phrase is visible.
  Pass:
  - the output is `gb-motion-burn-<ts>.mp4`, 1080×1920, h264, with an audio stream;
  - its duration is within ±0.1 s of max(video, captions);
  - the frame shows video pixels (not uniform) with the caption on top.
- AC22: The green export is unchanged with a video loaded. Check: same project as AC21, «Video con fondo verde», then ffprobe and a frame extraction. Pass:
  - no audio stream;
  - duration equals the captions length;
  - corner pixel (5,5) has R≤8, G≥247, B≤8.
- AC23: Error path for burn-in with no uploaded video. Check: POST `/api/render` with `kind:"burn"` and no `media`. Pass: `400` with `Subí un video en «Video» para exportarlo con subtítulos.` The UI button is disabled and shows the same hint.
- AC24: Transparency (beta) still exports. Check (UI, «Ajustes finos» on): «Transparencia (beta)», then ffprobe. Pass: codec `prores`, and the pixel format contains `yuva`.
- AC25: API keys never leak. Check:
  1. Create `.env.local` with `ELEVENLABS_API_KEY=test-key-123`.
  2. Run `vite build`, then `grep -r "test-key-123\|ELEVENLABS_API_KEY\|GROQ_API_KEY" dist/`.
  3. Call `curl localhost:4173/api/transcribe/providers`.
  Pass: grep finds 0 matches, and the JSON only contains `{providers:[{id,label,configured}]}`.
- AC26: Error path for a missing key. Check: start dev with no keys and no mock, then `POST /api/transcribe {"mediaId":...}`. Pass: `412` with `{code:"missing_key"}`. The UI shows `Falta la clave de la IA. Agregá ELEVENLABS_API_KEY o GROQ_API_KEY en .env.local y reiniciá GB Motion.`
- AC27: Error path for a rejected key or a provider failure. Check: set `ELEVENLABS_API_KEY=invalid`, then run «Generar subtítulos». Pass: the job ends `error` with `La clave de ElevenLabs no es válida.` The project layers are unchanged, and the server log contains no key text.
- AC28: The full flow works with the mock provider, without paying. Check:
  1. Start with `GB_TRANSCRIBE_MOCK=1` and load `T.mp4`.
  2. Run «Generar subtítulos» with 3 palabras and «Reemplazar».
  Pass:
  - captions are created from `scripts/fixtures/elevenlabs-es.json`;
  - each caption has ≤3 words and wordTiming word count = word count;
  - one Ctrl+Z restores the previous layers;
  - running again on the same video takes the cached result, with no provider call (logged as `cache`).
- AC29: Real transcription quality. Check: with a real key and `S.mp4`, run «Generar subtítulos». Pass:
  - accents and ¿¡ are preserved;
  - the first caption starts within 0.3 s of the first spoken word (listen while scrubbing);
  - the highlighted word follows the speech within ±0.2 s.
  If no key is available the result is BLOCKED and is not counted as a pass.
- AC30: The new highlight modes render correctly. Check: phrase `UNO DOS TRES` with even timing over 90 frames and a gradient style. Export green and extract frames 20 and 50 for each mode. Pass:
  - `reveal`: frame 20 shows only UNO;
  - `karaoke`: at frame 50, UNO and DOS are in the highlight color;
  - `scale`: at frame 50, DOS is larger, with the gradient still visible.
- AC31: Large projects stay usable. Check: «Guion» with 300 lines at 0.5 s each, then autosave, undo, and a green export with all phrases visible (about 150 s). Pass: 300 phrases are accepted (MAX_LAYERS=400), «Guardado» appears, one Ctrl+Z removes all 300, and the export completes. Generating more than the remaining capacity is refused with `Son demasiados subtítulos (N). Subí «palabras por subtítulo» o acortá el video.`
- AC32 (Run 2): The left rail shows the new workflow. Check: open the app. Pass: the rail shows exactly `Video · Subtítulos · Texto · Estilo · Efectos · Exportar`, in this order.
- AC33 (Run 2): Every existing feature survives the redesign. Check: walk the inventory F1–F42 using its "where" column. Pass: every row is reachable and behaves as before. Record any failure.
- AC34 (Run 2): The bundle is split. Check: `vite build`. Pass: the output contains no `Some chunks are larger than` warning.
- AC35 (Run 2): No horizontal page scroll. Check: viewports 1366×768 and 390×844, then `document.documentElement.scrollWidth <= clientWidth`. Pass: true for both.
- AC36 (Run 2): Transcript editing in «Subtítulos». Check:
  1. Edit row 3's text.
  2. Find and replace «pa» with «para».
  3. Click a row's time.
  Pass: the preview updates and the timings are preserved (AC10 rule). All matches across rows are replaced as one undo step. The playhead seeks to that row's start.
- AC37 (Run 2): The compact timeline lane. Check: open a project with more than 12 captions. Pass: the timeline shows a single «Subtítulos» lane by default, with a toggle back to «Pistas». Dragging and resizing a clip in the lane changes `startFrame`/`durationFrames`, and locked clips do not move.
- AC38 (Run 2): The safe-zone guides are preview-only. Check: «Zona segura: TikTok», then a green export frame. Pass: the overlay is visible in the editor and absent from the exported frame.
- AC39 (Run 2): Space toggles playback. Check: press Space with focus outside text inputs, then inside the textarea. Pass: playback toggles in the first case. In the second, a space character is typed and playback does not change.
- AC40 (Run 2): The empty state guides a new project. Check: «Empezar de nuevo». Pass: the stage shows «Subí tu video» with the 3 steps, and «Escribir a mano» dismisses it.
- AC41 (Run 2): Applying a template to all captions. Check: «Estilo → Aplicar plantilla a todos». Pass:
  - every unlocked phrase gets the active phrase's typography, in/out/loop, and highlight mode and color;
  - text, times, word starts, position and fontSize are unchanged;
  - one Ctrl+Z reverts it.
- AC42: The README documents the new setup. Check: read `README.md`. Pass: it covers creating `.env.local` with each key, the media folder location, «Generar subtítulos», both export kinds, and the restart-after-editing-env note, all in Spanish.

## Feature inventory (existing → status). "Where" is the location after Run 2.
| ID | Feature | Where / status |
|---|---|---|
| F1–F6 | Autosave and saved state, open/download project .json, «Empezar de nuevo», undo/redo (buttons + Ctrl+Z / Ctrl+Shift+Z), project name | Top bar; open, download and reset grouped in the «Proyecto» menu. Kept. History made scalable. |
| F7 | Library (IndexedDB): save project or kit, open with recovery copy, apply kit | Top bar. Kept. |
| F8–F9 | «Ajustes finos» toggle (persisted); save motion/style/combo modal | Top bar. Kept. Combo fixed (B1). |
| F10 | Play/pause, «Ver entrada», mute, canvas zoom, size label | Stage toolbar. Kept, plus Space. |
| F11 | Canvas drag, rotate with snap, resize, smart guides, double-click to edit, arrow-key nudge, "aparece en" badge, safe zone | Stage. Kept. Only active and in-window boxes are drawn. |
| F12–F14 | Multi-select align/distribute/same look; copy settings / paste look / paste motion; «Acomodar paneles» | Panel header. Kept. |
| F15–F18 | Style gallery (51 styles, categories, search, save, delete own), combos, «Aplicar look a todas», StyleTuner | «Estilo». Kept. |
| F19–F23 | In/out/loop tracks, search, categories, favorites, hover/focus preview, delete own presets, exit effect chosen as entry, timings, 11 loops, animation mode, keyframes (advanced) | «Efectos». Kept. |
| F24–F28 | Text 180 characters, multiline; FontBrowser (favorites, recents), weight, size, alignment, uppercase, italic only where the font has it; color (overrides the gradient); keyword chips and colors; position and «Volver al centro» | «Texto». Kept. |
| F29 | Word-by-word sync (prepare, color/box, color, per-word start, «Marcar aquí», remove) | «Texto». Kept, plus 3 modes and remap (B4). |
| F30–F31 | Script from the playhead; SRT/VTT import and export | «Subtítulos». Kept. |
| F32 | Guide video: pick, re-link, volume/mute, remove, change, waveform, timeline stretch | «Video». Upload and persistence added (B10). |
| F33 | 3 formats, 5 backgrounds, green / MP4 / alpha export, progress, cancel, download again, past videos | «Exportar». Kept, plus burn-in. |
| F34 | Timeline: ruler, clock, scrubber, playhead, drag/resize, in/out handles, snap, zoom 1–8×, «Dividir aquí», auto duration, add phrase, numeric start/duration, per-row select/hide/lock/duplicate/delete, lock enforcement | Dock. Kept, plus compact lane. |
| F35–F37 | Shortcuts Ctrl+C/V/D/Delete; toast | Kept. |
| F38–F41 | `remotion:studio`, `render:demo`, `/api/render*`, `/api/exports`, offline fonts and validators, responsive layout and reduced motion | Kept. |
| F42 | A new phrase inherits look and motion and starts after the active one | Kept. |

## Broken or defective today (static review; Phase 0 adds whatever the baseline run shows)
- B1: «Combinación completa» saves only the motion preset. `savePreset` handles `style`, and everything else falls through to motion, so `saveCustomComboPresets` is never called and saved combos never appear.
- B2: `/api/render` accepts 1920×1920 and any mix of 1080/1920 (V2 audit #7, still open at `vite.config.ts:122`).
- B3: `readJson` decodes each chunk on its own with `String(chunk)`, so a ñ or an accent split across chunks becomes U+FFFD. It also keeps reading after rejecting, and its 1 MB limit is too small for caption projects.
- B4: Editing a phrase wipes its `wordTiming`. That would destroy AI timings.
- B5: «Dividir aquí» drops the word timing of both halves.
- B6: `textLayout` measures lowercase widths while the render is uppercase (the default style is uppercase). The cache key also lacks `uppercase`, so long phrases can overflow or get clipped.
- B7: With a manual clip length, the exit starts at in+hold. A shortened clip cuts the exit, and a lengthened one goes blank early.
- B8: `deleteMotionPreset` resets `layer.preset` but leaves `animation.in/out` pointing at the deleted preset.
- B9: `Root.calculateMetadata` ignores the video length. This is a prerequisite for burn-in.
- B10: The guide video does not survive a reload.
- B11: MAX_LAYERS=120 is too low for auto-captions longer than about 2 minutes. `EditorHistory` deep-stringifies and clones the whole project on every change.
- B12: The probe `<video>` in `pickGuide` is never released.
- B13: The bundle is about 650 kB, so Vite warns.
- B14: The open audit item "webpack Unable to snapshot" warning: verify only, and record if it persists.
- B15: Any website can POST to `127.0.0.1:4173/api/*`: renders today, paid transcriptions once this lands.
- B16: There is no render concurrency limit.

## Competitor analysis (October 2026)
| Tool | Price | Strengths | Weaknesses for this user |
|---|---|---|---|
| Submagic | Free (3 videos/month, watermark); $12–19/month (15 videos, 2 min); Pro $23 | 48+ languages, trendy templates, emoji, zooms, b-roll, brand kit | Video and minute quotas; fixed templates |
| Captions.ai | $9.99 / $24.99 / $69.99 per month | 100+ templates, keyword emphasis, AI Edit (cuts, zooms), dubbing | Subscription; mobile-first; little motion control |
| CapCut | Auto-captions free only 10 min/month; $10–19.99 per month | Word templates, manual keyword color, the user's editor today | Captions now paywalled; highlight is manual work |
| VEED | Free 30 min/month with watermark; $12 / $24 | Browser editor, subtitle styling | Quotas, watermark |
| OpusClip | Free 60 min/month with watermark; $15 / $29 | Viral clip detection, brand templates | Built for repurposing, not for designing captions |
| Zubtitle | Free; $19 (10 videos), $49 | Simple | Dated; video caps |
| Hormozi-style generators | Free to cheap | Bold condensed font, word-by-word, yellow keyword, thick outline | Single look |
| Remotion `@remotion/captions` | MIT | `Caption` type, `createTikTokStyleCaptions`, SRT helpers. Windows whisper.cpp binaries only up to 1.6.0 | A toolkit, not a product |

**The gap GB Motion fills:**
- No watermark, quota or subscription. Transcription costs cents: Scribe v2 at $0.22/h is about $0.004 per 1-minute reel.
- The deepest motion engine of the field (47 presets × 3 tracks plus keyframes, 51 offline fonts) applied to the user's **own saved styles**.
- A Spanish-first UI and grouping, with ¿¡ and Spanish fillers handled.
- Both a green MP4 (the current CapCut habit) and a burned-in final video.
- The video stays local; only the audio goes to the STT provider.

**Missing versus the field, deferred:** b-roll, auto-zoom, silence removal, translation, auto-emoji, 4K/60 fps.

Sources:
- https://cutsnap.ai/blog/submagic-pricing-2026
- https://www.itechguides.com/best/ai-video-caption-generators/submagic/
- https://prizmad.com/review/captions-ai
- https://www.descript.com/blog/article/capcut-captions-arent-free-anymore-heres-a-better-option
- https://rendercut.io/capcut-pro-vs-free
- https://findstack.com/products/veed/pricing
- https://www.castmagic.io/blog/opus-clip-pricing
- https://zubtitle.com/pricing
- https://www.choppity.com/tools/hormozi-caption-style-generator/
- https://www.remotion.dev/docs/install-whisper-cpp/install-whisper-cpp

## AI subtitles: recommendation
| Option | Spanish quality | Word timestamps | Cost | Setup on this machine | Privacy |
|---|---|---|---|---|---|
| **ElevenLabs Scribe v2** (recommended) | Best hosted: 2.2% AA-WER overall, about 3.1% on FLEURS Spanish | Native, with punctuation and logprob | $0.22/h; Starter $6/month includes 4.5 h | One HTTPS call; accepts files up to 5 GB | Audio goes to the cloud |
| **Groq Whisper large-v3** (alternative) | About 2.8% on FLEURS Spanish; Whisper word times drift more | `verbose_json` + `timestamp_granularities[]=word` (no punctuation in `words`) | $0.111/h; free tier with a 25 MB cap | One HTTPS call | Cloud |
| OpenAI gpt-4o-transcribe / gpt-transcribe | Good | **No** word timestamps (only `whisper-1` has them) | $0.0045–0.006/min | Simple | Cloud |
| Deepgram Nova-3 | 8.9% on FLEURS Spanish | Yes | $0.0043/min, $200 credit | Simple | Cloud |
| AssemblyAI Universal | Good | Yes | $0.15/h, $50 credit | Upload, then poll | Cloud |
| whisper.cpp through `@remotion/install-whisper-cpp` | Model-dependent; CPU-slow for large models | Token-level | Free | Windows binaries only up to 1.6.0; needs a new package | Fully local |
| transformers.js in the browser | Small models only | Weak | Free | Heavy WASM download; slow | Local |

**Decision:**
- Use ElevenLabs Scribe v2 as the primary provider and Groq `whisper-large-v3` as the alternative.
- Both are plain `fetch` calls, so no dependencies.
- The provider is chosen by `GB_TRANSCRIBE_PROVIDER`, or by whichever key exists (ElevenLabs first).
- A local whisper.cpp provider (`WHISPER_CPP_BIN` + `WHISPER_MODEL` using the official Windows release zip) is the planned next increment for full privacy.
- Sources:
  - https://elevenlabs.io/pricing/api
  - https://speechtotext.dev/model/elevenlabs-scribe-v2/
  - https://console.groq.com/docs/speech-to-text
  - https://costgoat.com/pricing/openai-transcription
  - https://www.assemblyai.com/benchmarks
  - https://www.cekura.ai/blogs/deepgram-pricing
  - https://apicostcalc.com/assemblyai.html

## Design decisions and trade-offs
- **Server-side media.** Upload the picked file once to `POST /api/media` and store it in `GB_MEDIA_DIR`. The default is `%LOCALAPPDATA%\gb-motion\media`, because the project lives in **OneDrive** and multi-GB copies would sync.
  - The render resolves `mediaId` to `http://127.0.0.1:<port>/media/<id>` **server-side**; a client-sent `src` is always stripped. This keeps the blob lesson: blobs still never reach the render.
  - Rejected: copying into `public/` (watched, bundled) and `file://` URLs (not supported by OffthreadVideo).
- **Preview vs. render video.** The preview keeps today's `<Video>` with the blob, or `/media/<id>` after a reload. The render uses `<OffthreadVideo>` when `useRemotionEnvironment().isRendering`, which gives frame-exact extraction with audio.
  - Rejected: `@remotion/media` `<Video>`. It is not hoisted, would need a manual link, and falls back to OffthreadVideo anyway.
- **No `@remotion/captions`.** Keep its `Caption`-compatible shape (`text,startMs,endMs,confidence`) in `src/captions/types.ts` and write Spanish-aware grouping ourselves. It is also testable without linking a non-hoisted package.
- **Captions map onto the existing model.** One AI page becomes one `TextLayer` with manual `durationFrames` and real `wordTiming`. There is no new render path, so all styles and effects apply unchanged.
- **Word highlight modes extend `WordTiming.mode`:**
  - `'color'|'box'` (today);
  - `'karaoke'` (spoken words keep the color);
  - `'reveal'` (unspoken words get `visibility:hidden`, so layout and gradient clip stay intact);
  - `'scale'` (the active word gets `scale(1.15)` on an inline-block that **carries its own paintCss**).
- **Persistence.** History stores immutable references and does shallow field compares instead of JSON plus `structuredClone`, so 400 layers stay cheap. MAX_LAYERS goes up to 400 (about 8 minutes of speech at 3 words per caption).
- **Security.** `/api/*` POST and DELETE require `Origin` to be absent or `http://127.0.0.1:<port>` / `http://localhost:<port>`. GET `/media` stays open because the render fetches it.
- **Redesign (Run 2).** The rail follows the creator flow: Video → Subtítulos → Texto → Estilo → Efectos → Exportar.
  - Global CSS is split into `src/styles/*.css` with the existing tokens.
  - `App.tsx` state moves into custom hooks.
  - Heavy panels load lazily.
  - Rejected: Tailwind, shadcn and zustand. They need packages that cannot be installed safely, and a rewrite adds no value to the user.

## Risks and edge cases
- Remotion's custom ffmpeg may lack `libmp3lame`. `extractAudio` falls back to WAV 16 kHz mono and stops with `El audio es muy largo para Groq (máx. 13 min en WAV).` when over 25 MB.
- Large `inputProps` (about 2 MB for 400 layers). Raise the body limit to 16 MB. If Remotion warns about prop size, record it and check AC31.
- localStorage is about 5 MB. A 400-layer autosave can fail, and «Sin guardar» shows it. IndexedDB autosave is deferred.
- Source fps (29.97/60) differs from the 30 fps composition. OffthreadVideo samples by time, so the drift is negligible. Burn-in keeps the chosen format with a cover crop, the same as the preview.
- Whisper words carry no punctuation. Recover it by aligning `words` to the `text` tokens with a lookahead of 3, and keep the raw word on a mismatch.
- Clips shorter than in+out: the exit starts at `max(in, duration − out)`.
- A video with no audio stream: transcription fails with `Ese video no tiene audio.` (422).
- Restarting the dev server (for example after editing `.env.local`) loses in-flight jobs. The UI already shows a controlled error.
- A transcription cancelled after upload may still be billed. The UI says so.
- 400 timeline rows in Run 1 are heavy. Run 2's windowed compact lane fixes it.

## Implementation steps
**Phase 0: safety and baseline.**
1. Copy the set listed under Files to touch into `backups/before-redesign-20261003/` with PowerShell `Copy-Item -Recurse`.
2. Run AC2–AC4 and `render-editor-smoke.mjs green`. Append failures to B-list as B17+.

**Phase 1: fixes (B1–B8, B11–B12, B15–B16 client parts).**
1. Update `App.savePreset`:
   - `kind==='combo'` pushes a `ComboPreset` `{id:'custom-combo-<ts>', name, description:'Combinación guardada por vos.', typography, animation: cloneAnimation(activeAnimation), custom:true}` into new state from `loadCustomComboPresets`, persisted with `saveCustomComboPresets`;
   - Estilo «Combinaciones» lists built-in plus custom, with a delete button for custom ones.
2. In `deleteMotionPreset`, map `animation.in` with a matching id to `{preset: defaultPreset, overrides: overridesFor(defaultPreset)}` and `animation.out` with a matching id to `null`.
3. Add to `src/utils/editor.ts`:
   - `MAX_LAYERS = 400`;
   - `remapWordTiming(before: string, after: string, timing: WordTiming, durationFrames: number): WordTiming | undefined`:
     - matching follows the same LCS as `remapKeywords`; matched words keep start/end;
     - each run of new words splits the span between its matched neighbors evenly;
     - deleted words merge into the previous word;
     - the result is monotonic, each word ≥1 frame, and the last end equals the duration;
     - when the words don't fit, it falls back to `evenWordTiming`, and to undefined for empty text;
   - `splitWordTiming(timing, cutLocalFrame): [WordTiming|undefined, WordTiming|undefined]`.
4. App wiring:
   - `onText` uses `remapWordTiming`;
   - `splitLayer` cuts at the first word with `start >= localFrame` when timing exists (otherwise today's proportional rule) and assigns both halves.
5. Update `EditorHistory`:
   - `observe` compares `Object.keys(next)` values with `Object.is` against the current snapshot and stores references;
   - `undo`, `redo` and `reset` keep `structuredClone` on their outputs.
6. In `textLayout.ts`, measure `t.uppercase ? text.toLocaleUpperCase('es') : text`, and add `uppercase` and `fontWeight` to the cache key.
7. In `layerAnimation.getAnimationPhase`, when `typeof layer.durationFrames==='number'` and `animation.out` exists, use effective hold `max(0, durationFrames − in − out)`. Auto clips keep `holdFrames`.
8. In `pickGuide`, call `probe.removeAttribute('src'); probe.load()` in a `finally` block.
9. In `CanvasOverlay`, render only the active layer and the layers whose window contains `currentFrame`.

**Phase 2: server foundation and media.**
1. `server/http.ts`:
   - `readBody(req, limitBytes): Promise<Buffer>` collects Buffers. Over the limit it calls `req.destroy()` and rejects with `{status:413}`;
   - `readJson` = `JSON.parse(buf.toString('utf8'))`;
   - `json()`;
   - `isAllowedOrigin(origin: string|undefined, port: number): boolean`;
   - `parseRange(header, size): {start,end}|null|'invalid'`.
2. `server/ffmpeg.ts`:
   - `binDir()` checks env `GB_FFMPEG_DIR` first, then `node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@*/node_modules/@remotion/compositor-win32-x64-msvc`;
   - spawn with `cwd: binDir()` so the DLLs resolve;
   - `probe(file): Promise<{durationSec,width,height,hasAudio}>` uses `ffprobe -v error -print_format json -show_format -show_streams`;
   - `extractAudio(file, out): Promise<string>` uses `-vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 64k`, with the WAV fallback.
3. `server/media.ts`:
   - `POST /api/media` streams the raw body to `<uuid>.<ext>`. Allowed extensions: mp4, mov, m4v, webm, mkv, taken from `X-File-Name`. The cap is 4 GB.
   - It then probes the file. On failure it unlinks the file and returns 422 (AC19).
   - Success returns 201 `{mediaId, name, durationInFrames: round(sec*30), width, height, hasAudio}`.
   - `GET|HEAD /media/:id` checks the id against `^[0-9a-f-]{36}\.(mp4|mov|m4v|webm|mkv)$` and supports Range (206 / 416).
4. `server/render.ts`:
   - move `startRender` and the jobs into it;
   - `isSupportedFormat(f)` matches `formats` by id **and** size;
   - an active job leads to 409 (AC16);
   - `ExportKind = 'mp4'|'green'|'alpha'|'burn'`;
   - `burn` requires `media:{mediaId, volume}` and sets `props.guide = {src: <server URL>, name, durationInFrames: probed, volume}`;
   - other kinds delete `props.guide`;
   - filename `gb-motion-<kind>-<ts>.<ext>`.
5. `server/plugin.ts` routes everything. It applies the origin check to POST and DELETE under `/api/`, returning 403 `{error:'Origen no permitido'}`.
6. `vite.config.ts`:
   - `defineConfig(({mode}) => …)` with `const env = loadEnv(mode, process.cwd(), '')`;
   - pass `{elevenlabsKey, groqKey, provider, mediaDir, mock}` to the plugin;
   - `server.watch.ignored: ['**/exports/**','**/media/**','**/backups/**']`;
   - add `server/**` to `tsconfig.node.json`.
7. Client:
   - `src/utils/mediaClient.ts` provides `uploadMedia(file, onProgress): Promise<MediaInfo>` through XHR;
   - add `mediaId?: string` to `VideoGuide`; the project stores `guideMediaId`;
   - on load, `HEAD /media/<id>`, and if OK, set the guide with `src:'/media/<id>'`;
   - revoke only `blob:` URLs;
   - GuidePanel shows «Subiendo… N%», then «Video guardado».

**Phase 3: burned-in export.**
1. `Root.calculateMetadata` uses `Math.max(getCompositionDuration(layers), props.guide?.durationInFrames ?? 0)`.
2. `TextComposition` renders `isRendering ? <OffthreadVideo src volume style/> : <Video …/>` (same cover style).
3. `OutputPanel`:
   - a primary card «Video con tus subtítulos» (kind `burn`), disabled without `guide.mediaId` and showing the AC23 hint;
   - a range «Volumen del audio original» (0–100%, default 100), separate from the preview volume;
   - past-export label «Con video» for `-burn-`.
4. `exportVideo(kind)` sends `media` for `burn`.

**Phase 4: AI subtitles and highlight modes.**
1. `src/captions/types.ts`: `TimedWord {text,startMs,endMs,confidence:number|null}`, `CaptionPage {text,startMs,endMs,words:TimedWord[]}`, `GroupOptions`.
2. `src/captions/group.ts`: `groupWords(words, opts): CaptionPage[]`.
   - Defaults: maxWords 3 (1–8), maxChars 20 (8–42), breakOnSilenceMs 500, breakOnPunctuation true, maxDurationMs 3000, minDurationMs 300.
   - Break after `[.?!…]`, and after `[,;:]` once the page has 2 or more words.
   - `removeFillers` drops eh/ehh/em/emm/ehm/mm/mmm/hmm/ah/ahh. The meaningful "este", "bueno" and "o sea" are not removed.
3. `src/captions/toLayers.ts`: `pagesToLayers(pages, template: TextLayer, createId): TextLayer[]`.
   - Each layer is cloned from the template: text, name, `startFrame=round(ms*0.03)`, `durationFrames`.
   - Its end extends to the next start when the gap is ≤250 ms; otherwise it is `+200 ms`, never overlapping.
   - `wordTiming` takes `{mode, color}` from the template (default `color` `#ffe94a`) with contiguous relative frames.
   - Keywords are reset to `{}`.
4. `src/captions/providers.ts`: `fromElevenLabs(json)` (type `word` only, `confidence=exp(logprob)`) and `fromGroq(json)` (with punctuation recovery).
5. `server/transcribe.ts`, with jobs like the render.
   - `GET /api/transcribe/providers`.
   - `POST /api/transcribe {mediaId, language:'es'|'auto'|'en'|'pt', provider?}` returns 202 `{jobId}`, 412 `missing_key`, or 422 for no audio.
   - `GET/DELETE /api/transcribe/:id` reports or cancels a job. Stages: `extracting`, `uploading`, `transcribing`, `done`, `error`.
   - ElevenLabs: `POST https://api.elevenlabs.io/v1/speech-to-text`, header `xi-api-key`, form `model_id=scribe_v2`, `language_code`, `timestamps_granularity=word`, `tag_audio_events=false`, `file`.
   - Groq: `POST https://api.groq.com/openai/v1/audio/transcriptions`, Bearer, `model=whisper-large-v3`, `response_format=verbose_json`, `timestamp_granularities[]=word`, `language`.
   - Requests use `AbortSignal.timeout(600000)`.
   - Errors map to Spanish: 401/403 «La clave de X no es válida.»; 429 «Límite de uso de X. Probá en unos minutos.»; 413 too long; network «Sin conexión con X.».
   - Results are cached in `<mediaDir>/<mediaId>.<provider>.<lang>.json`.
   - `GB_TRANSCRIBE_MOCK=1` serves `scripts/fixtures/elevenlabs-es.json`.
6. `AutoCaptionsPanel` (inside «Video»):
   - language; provider (configured ones only); «Palabras por subtítulo»; «Máx. caracteres»; «Cortar en pausas»; «Quitar muletillas»;
   - «Resaltado» with the 5 modes and a color; «Usar el look de la frase seleccionada»;
   - «Reemplazar / Agregar» (replace keeps locked layers);
   - «Generar subtítulos», progress with «Cancelar», errors in `role=alert`.
   - Applying runs as one `recordHistory()` step, with the AC31 capacity check.
7. `src/engine/wordHighlight.ts`: `wordHighlightCss(timing, wordIndex, localFrame, paint): CSSProperties`.
   - Use it in all three paths of `TextComposition`: text-mode `richText`, unit spans, and `ReadableEffect.wordStyle`.
   - Add the 5 options to `WordTimingPanel`.
   - Accept the new modes in `project.ts` sanitize.
8. Add the validators, fixtures, `.env.example` (keys commented out), `.gitignore`, the `package.json` `test` entry, and README.

**Phase 5 (Run 2): redesign.**
1. Extract hooks from `App.tsx` with no behavior change, and re-run AC2–AC4.
2. Rail with 6 tools. «Subtítulos» = `SubtitlesPanel`:
   - virtualized list using `content-visibility:auto`;
   - per row: time (seek), editable text (remap), «Unir con la siguiente», delete;
   - find and replace as one undo step;
   - CaptionTools moved here.
3. `EmptyState`, «Proyecto» menu, Space shortcut, `SafeZoneOverlay` (Ninguna/TikTok/Reels, preview only).
4. TimelineDock «Subtítulos | Pistas» toggle. The compact lane renders only clips within the visible range and keeps drag, resize, fx handles, split and lock.
5. Split the CSS into `src/styles/{tokens,layout,controls,panels,timeline,canvas,modal}.css`. Keep the token names and refresh spacing, typography and contrast.
6. Load `LibraryPanel`, `SavePresetModal`, `KeyframePanel` and `MotionPreview` with `React.lazy`, and add `build.rollupOptions.output.manualChunks` for `remotion`/`@remotion/player`.

**Phase 6 (Run 2):** «Aplicar plantilla a todos» (AC41), then the AC33 inventory walkthrough.

## Open questions and assumptions
- **Run split.** Run 1 = Phases 0–4 (AC1–AC31); Run 2 = Phases 5–6 (AC32–AC42). One pass is too big to keep green. Assumed approved.
- **API keys.** The user must create an ElevenLabs key (Starter $6/month) and/or a free Groq key. Without one, AC29 is BLOCKED; everything else is testable with the mock.
- **Burn-in output** uses the chosen format with a cover crop and 30 fps; native resolution is not kept.
- **Media folder** defaults outside OneDrive (`%LOCALAPPDATA%\gb-motion\media`). «Quitar el video» unlinks but does not delete the copy; cleanup is manual and documented.
- **Planning limit.** No shell was available during planning, so the B-list comes from code and audits. Phase 0 confirms it at runtime.

## Memory
- Decision records to write once approved:
  - Scribe v2 as primary STT, with Groq whisper-large-v3 as the alternative and keys server-side only.
  - Media uploaded to a local dir outside OneDrive and served to the render by server-resolved URL.
  - No new npm packages; never run pnpm install (the lockfile lacks the hand-unpacked fonts).
  - Captions mapped onto `TextLayer` + `wordTiming`.
- Lessons seeded now in `docs/lessons-learned.md`: 3 render lessons. The others stay in Constraints.
