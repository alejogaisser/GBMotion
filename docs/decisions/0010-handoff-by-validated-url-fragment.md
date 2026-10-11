# 0010. Landing-to-editor handoff and style sharing by validated fragment
- Date: 2026-10-11
- Status: accepted
- Decision: `src/utils/handoff.ts` encodes a v1 payload as base64url JSON in the URL fragment: `#demo=` (from the landing, may carry the phrase) and `#estilo=` (shared link, never the phrase). `decodeHandoff` enforces at most 4096 characters, built-in presets by id, a font in the registry, numeric ranges, `availableWeights` and a whitelist for nested typography, and returns `{ok:false, reason}` otherwise. The editor reads it once, then `history.replaceState` removes it. Never a query string, never storage, never the whole project. Sharing only covers the look plus built-in motion and highlight, and the UI never copies a link that `decodeHandoff` would reject.
- Reason: A query string leaks text into logs and the Referer; storage would touch the autosave. The fragment never leaves the browser. AC21, AC22, AC23 and AC26 passed.
