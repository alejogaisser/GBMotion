# 0007. Landing and editor as a Vite MPA, no router
- Date: 2026-10-11
- Status: accepted
- Decision: Three documents: `/` landing (`index.html`), `/editor/` (`editor/index.html`, entry `src/main.tsx`) and `404.html`, configured with `appType: 'mpa'` and `build.rolldownOptions.input` (input and `manualChunks` moved together). No router and no SPA shell. The landing demo never reads or writes the editor's `localStorage`/IndexedDB and never calls `/api/*`.
- Reason: It isolates the editor's global CSS (`overflow:hidden`, Inter) and its 51 fonts from the landing, gives real HTML for LCP/SEO, keeps the autosave on the same origin, and needs no new package (see 0003). AC1, AC5 and AC6 passed in the final run.
