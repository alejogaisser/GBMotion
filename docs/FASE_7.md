# FASE 7 — Línea de tiempo por capa

Fecha de cierre: 2026-09-02.

## Qué se implementó

### Modelo temporal
- `TextLayer` tiene `startFrame` y `durationFrames` (`src/types/motion.ts`, valores por defecto en `src/remotion/defaults.ts`).
- `src/utils/duration.ts`:
  - `getLayerDuration` respeta `durationFrames` explícito y, si falta, usa la duración de la animación + 15 cuadros.
  - `getCompositionDuration` = máximo de `startFrame + getLayerDuration` entre las capas visibles, con piso de 90 cuadros.
- `src/remotion/TextComposition.tsx`:
  - Sólo se montan las capas con `frame >= startFrame && frame < startFrame + durationFrames`.
  - Cada `AnimatedTextLayer` recibe `frame = globalFrame - startFrame`, así la entrada arranca desde su cuadro cero local.
- `src/remotion/Root.tsx` calcula `durationInFrames` con `getCompositionDuration`, la misma función que usa el `<Player>` en `src/App.tsx`. Preview y render comparten el modelo temporal.

### Panel de línea de tiempo (`src/components/Timeline.tsx`)
- Regla en segundos, playhead, contador `mm:ss:ff`.
- Scrubber (`input[type=range]`, área interactiva de 24 px) que llama `onSeek`; `onSeek` pausa el Player, hace `seekTo` y fija `seekTargetFrame` para que un `frameupdate` viejo de Remotion no haga retroceder el playhead.
- Una barra por capa: arrastre para mover el inicio, borde derecho para cambiar la duración (`begin('move' | 'resize')`). `onBeginInteraction` graba un punto de historial por gesto.
- Campos numéricos **Comienza (cuadros)** / **Duración (cuadros)** para la capa activa.
- Botones de duplicar y eliminar por fila.
- Una capa `locked` no reacciona al arrastre ni al borde derecho; `Delete` la ignora (`src/App.tsx`).
- Alineación exacta playhead ↔ scrubber: ambos mapean el cuadro con `span = max(1, lastFrame)` (el mismo rango que cubre el scrubber). El playhead agrega los 6 px de medio thumb: `left: calc(160px + (100% - 238px) * frame/span)`.
- Responsive: la regla, las pistas y los campos viven dentro de `.timeline-scroll` (`overflow-x: auto`, hijo con `min-width: 560px`). En ventanas angostas la línea de tiempo scrollea internamente y la página no se desplaza de lado.

### Otros
- `src/App.tsx`: el reproductor ya no arranca en autoplay (comportamiento de editor). El guard de atajos de teclado usa `target instanceof HTMLElement` antes de `target.matches(...)`.
- `src/styles.css`: se removió la regla global de sliders que causaba overflow horizontal; comentario que documenta el acople entre las columnas de `.timeline-row`, el inset del scrubber y el offset del playhead.

## Qué se probó automáticamente

Ejecutado desde el runtime local (`node --experimental-strip-types`):

- `scripts/validate-font-registry.mjs` → `FONT_REGISTRY_OK families=21`.
- `scripts/validate-motion-engine.mjs` → `MOTION_ENGINE_OK presets=20 ... phases=in>hold>out`.
- `tsc -b` → sin errores.
- `vite build` → build de producción correcto (`dist/`).

(`pnpm` no está disponible en este entorno; se corrieron los mismos comandos que `pnpm test` / `pnpm build` invocan.)

## Qué se verificó visualmente (navegador, dev server en 127.0.0.1:4173)

Escenario: 3 capas — "EMPEZAR DE CERO" [0, 40), "SEGUNDO" [40, 80), "TERCERO" [80, 120).

- **Ventanas de visibilidad en el preview**: cuadro 5/20 → sólo capa 1; 45/65 → sólo capa 2; 85/110 → sólo capa 3. La combinación aparece únicamente durante el solapamiento cuando lo hay.
- **Entrada local**: cada capa arranca su animación de entrada al entrar en su clip, no en el cuadro global 0.
- **Scrubbing**: contador, valor del scrubber, posición del playhead y cuadro del Player coinciden en 0/30/60/90/119 (playhead vs. centro del thumb: 0 px de diferencia). Tras varios `seek` rápidos hacia atrás y adelante, el cuadro queda estable y no rebota a un valor anterior.
- **Arrastre / redimensionado**: mover el clip ±N cuadros y estirar el borde derecho ±N cuadros modifica `startFrame` / `durationFrames` de forma proporcional; `Ctrl+Z` revierte cada gesto y `Ctrl+Shift+Z` lo reaplica.
- **Seleccionar / duplicar / eliminar** desde la línea de tiempo: OK (la copia aparece con inicio desplazado +10).
- **Bloqueo**: con la capa bloqueada, arrastre y borde derecho no hacen nada y `Delete` no la borra.
- **Ventana angosta (380 px)**: `.timeline-scroll` scrollea internamente (`scrollWidth 560 > clientWidth 302`), el `documentElement` no tiene overflow horizontal, el lane queda usable (~334 px).
- **Consola**: limpia tras recargar (los 500 de HMR y los `target?.matches` observados durante la sesión provienen de ediciones en caliente intermedias y del arnés de pruebas, no de la app).

## Export verificado

`Video con fondo verde` y `Descargar MP4` con las 3 capas separadas.

- `ffprobe` (binario incluido con `@remotion/compositor`): `1080x1920`, `30/1` fps, `nb_frames=120` — igual que `getCompositionDuration` y que el scrubber (max 119).
- Cuadros extraídos del MP4 verde (`#00ff00`): frame ~20 muestra "EMPEZAR DE CERO", ~45 y ~65 "SEGUNDO", ~85 y ~110 "TERCERO". El MP4 respeta los mismos tiempos que la vista previa.

## Limitaciones restantes

- Editar los campos numéricos **Comienza / Duración** no crea punto de deshacer (sólo lo crean el arrastre y el redimensionado). `Ctrl+Z` después de tipear un número no revierte ese cambio.
- El offset del playhead y el inset del scrubber son constantes en px acopladas a las columnas de `.timeline-row` (144 px / 62 px). Si se cambian esas columnas hay que ajustar `Timeline.tsx` y `styles.css` juntos (documentado con comentarios).
- Con muchas capas la columna lateral del workspace crece bastante más que la vista previa y deja espacio vacío a la izquierda en pantallas altas; es el layout de página única previo a esta fase, no regresión de FASE 7.
- Canal alpha sigue sin habilitarse (decisión de FASE 6): green screen es el camino estable para CapCut.
- Las flechas del teclado sobre el scrubber se probaron por la vía de `input` → `onSeek` (idéntica al arrastre); no se simuló el manejo nativo tecla por tecla del `input[type=range]`.
