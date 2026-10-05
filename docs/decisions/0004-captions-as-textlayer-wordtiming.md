# 0004. AI captions map onto TextLayer + wordTiming
- Date: 2026-10-04
- Status: accepted
- Decision: Each AI caption page becomes a normal `TextLayer` with a manual `durationFrames` and real `wordTiming`. The grouping is our own Spanish-aware code in `src/captions/`, with no `@remotion/captions` dependency. `WordTiming.mode` adds `karaoke`, `reveal` (unspoken words use `visibility:hidden`) and `scale` (the scaled word carries `paintFillCss`, not the full `paintCss`). MAX_LAYERS goes to 400, and `EditorHistory` keeps snapshots by reference.
- Reason: There is no second render path, so every existing style, effect and export applies unchanged. Run 1 verified this with AC5, AC28, AC30 and AC31.
