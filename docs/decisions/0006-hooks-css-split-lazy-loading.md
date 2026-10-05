# 0006. Editor state in hooks, CSS split by section, heavy panels lazy-loaded
- Date: 2026-10-05
- Status: accepted
- Decision: Editor state lives in `src/hooks/{useProject,useGuide,useExport,useTranscription}.ts`. The hooks talk through callbacks and a ref (for example `onEdited` → `resetExportState`), not through a state library. Global CSS is split into `src/styles/*.css`, imported in the original order. LibraryPanel, SavePresetModal, KeyframePanel and MotionPreview are loaded with `React.lazy`, and remotion gets its own manual chunk. The rail is Video · Subtítulos · Texto · Estilo · Efectos · Exportar, plus a «Proyecto» menu.
- Reason: `App.tsx` held all the state, the bundle triggered the 600 kB warning, and zustand, Tailwind or shadcn would mean new packages (see 0003). Run 2 (95858c4, 2b41818) passed AC32–AC42 and the Run 1 regression ACs with no fix cycle.
