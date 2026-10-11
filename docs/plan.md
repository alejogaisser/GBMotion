<!-- dev-team plan -->
# GB Motion · Corrida 4: editor «Sala de edición» (alcance Look + UX)

Pedido de Alejo: «Amé la landing, ¿podrías ajustar el editor? Quedó muy desactualizado.» Alcance elegido: identidad de la landing en el editor + reorden de header, herramientas, paneles y línea de tiempo al estilo de editores pro, sin cambiar funciones. Rama `claude/editor-redesign` (base `main` 7e9c16b). Plan anterior: `docs/plan-landing-pro.md` (sus criterios se citan como LP-ACn).

## Handoff

### Goal
Alejo abre `/editor/` y encuentra un editor con la identidad de la landing: negro cálido, hueso y lima; Anton, Archivo y JetBrains Mono; timecodes, pistas V1/T1/A1 y playhead lima. La disposición es la de un editor pro: el panel queda pegado a su barra de herramientas, la barra de reproducción va debajo del visor y la línea de tiempo tiene pistas y un solo cabezal. Hace exactamente lo mismo que hoy: mismas funciones, mismo motor, mismos exports y mismo proyecto/autosave.

### Context
- `src/styles/tokens.css:13-57`: paleta gris azulada, `--accent #5B8CFF`, Inter global, reduced-motion que acorta animaciones pero no las quita.
- `src/styles/modal.css:55-140`: apéndice «Editor refinements» que pisa reglas de layout, timeline y controles; `modal.css:8` `backdrop-filter: blur(3px)`; `layout.css:143-145` degradado radial azul detrás del lienzo.
- `src/styles/{layout,panels,controls,timeline,canvas}.css`: azules hardcodeados (`rgba(91,140,255,…)`, `#7FA6FF`, `#061027`, `#08101F`, `#3FE494`, `#74c9b4`, `#14181F`…), textos de 9 a 11,5 px, radios de 7 a 14 px.
- `src/App.tsx:422-753`: orden del DOM rail → visor → panel (el panel queda a unos 950 px de su herramienta a 1366), `stage-toolbar` arriba, «Acomodar paneles» con dos sliders dentro del encabezado del panel, `back-link` + `brand` en el header, botón Exportar con ícono Play.
- `src/components/TimelineDock.tsx`: `clock()` (MM:SS) alimenta el `aria-label` de los clips; hay un `.dock-playhead` por fila, la forma de onda arriba de las frases y `dock-clock` en la cabecera.
- `src/components/StyleGallery.tsx:30-37` y `OutputPanel.tsx:38`: fondos de muestra azulados/violetas inline. `FontBrowser.tsx:98,123`, `StyleGallery.tsx:122`, `LibraryPanel.tsx:45`: muestras que se pintan con la fuente del subtítulo (pueden ser Inter legítimamente: es la fuente por defecto de `createTextLayer`).
- `src/landing/landing.css:7-29,106-123,379-423`: fuente de la identidad: tokens, botones de 2 px con sombra dura y `steps()`, `.tc`, `.rec` y pistas.
- `src/fonts.ts:39,217-218,262-264`: el editor ya registra Anton 400, JetBrains Mono 400/700 y Archivo 400/700/900, así que la UI no suma fuentes.
- `docs/decisions/0003, 0005, 0006, 0007, 0009, 0012`; `docs/lessons-learned.md`: textPaint, overlays fuera del Player, CDP para video, CSS por rangos.
- Patrones de referencia (conocimiento de producto, sin fuente nueva): CapCut desktop (barra de reproducción bajo el visor, timeline a todo el ancho), Canva video (herramientas y panel contiguos), Premiere Rush/Descript (encabezados de pista fijos, un solo cabezal).

### Constraints
- Cero dependencias nuevas (0003/0012): `package.json` y `pnpm-lock.yaml` idénticos a 7e9c16b. Los íconos salen sólo del `lucide-react` instalado.
- Sin cambio de comportamiento. No se tocan `src/hooks/**`, `src/engine/**`, `src/remotion/**`, `src/presets/**`, `src/utils/**`, `src/typography/**`, `src/fonts.ts`, `src/main.tsx`, `server/**`, `scripts/**`, `vite.config.ts`. Mismos handlers, estados, autosave y nombres accesibles (salvo las excepciones de AC15).
- Ownership (0009): todo esta corrida es de Claude. No hace falta pedirle contratos a Codex. Si aparece alguno, se pide por mensaje y no se edita.
- Identidad:
  - Las primitivas de marca salen sólo de `src/brand/tokens.css`.
  - UI en Archivo 400/700 (texto), JetBrains Mono 400/700 (timecodes, etiquetas, pistas) y Anton 400 (wordmark y títulos). Instrument Serif itálica sólo como acento del estado vacío.
  - Prohibido: Inter en la UI, azul o violeta, `backdrop-filter` y degradados decorativos. En `src/styles` sólo se permite `repeating-*-gradient` para patrones funcionales (regla, rayas, damero). Los únicos degradados lineales permitidos son los fondos cálidos que imitan video en `StyleGallery` (inline).
- Forma: radio de 2 px, sombras duras sin blur, `font-weight` sólo 400/700 en la UI, texto visible ≥11 px y contraste AA.
- Semántica de color: lima = lo actual, seleccionado o acción primaria; hueso = énfasis secundario; resaltado `#FFE94A` = foco y avisos; `--rec` sólo en puntos REC; errores en `--danger` `#FF6A5C`.
- Motion: sólo CSS (`transform`, `opacity`, `clip-path`) con `steps()` como la landing, todo bajo `@media (prefers-reduced-motion: no-preference)`. Con `reduce` no queda ninguna animación ni transición. Ninguna animación infinita en reposo; el parpadeo REC dura ≤3 ciclos (<5 s, WCAG 2.2.2).
- Rendimiento: nada de `filter`, `backdrop-filter` ni `mix-blend-mode` sobre el lienzo o a su alrededor; overlays fuera del Player (lección 2026-10-05); no se toca `textPaint.ts`.
- Idioma y mayúsculas: UI en español rioplatense. `text-transform: uppercase` va sólo en títulos y eyebrows decorativos, nunca en botones, estados o enlaces que los ACs leen por texto.
- Sólo PC ≥1024 px (`DesktopOnlyNotice` sin cambios).
- Proceso: un commit por fase (0005), sin merge a `main` sin acuerdo, puertos de Claude 4174 (dev) y 4184 (runtime).

### Files to touch
- `src/brand/tokens.css` (create): primitivas de marca compartidas, sólo custom properties (§Tokens).
- `src/landing/landing.css` (modify): primera línea `@import '../brand/tokens.css';`. Se borran de su `:root` las 7 primitivas y las 4 pilas de fuente que pasan al archivo de marca; nada más.
- `src/styles/tokens.css` (modify): importa la marca; tokens semánticos remapeados; fuente de UI, foco, scrollbars y bloque reduced-motion nuevo.
- `src/styles/layout.css` (modify): header, wordmark, rail, workbench (rail · panel · visor), visor, barra de reproducción, resizers, menú Proyecto, chips de estado, servidor y tarea, y primitivas de botón.
- `src/styles/panels.css` (modify): contenido del panel (bloques, galerías, plantillas, revisión, guion, compartir).
- `src/styles/controls.css` (modify): campos, segmentados, rangos, swatches, tuner, Exportar, guía, explorador de fuentes (movido desde canvas.css).
- `src/styles/timeline.css` (modify): dock, regla, pistas T/V/A, clips, cabezal único, pie Inicio/Duración.
- `src/styles/canvas.css` (modify): overlay del lienzo, guías, zonas seguras y estado vacío.
- `src/styles/modal.css` (modify): modales sin blur, toast, aviso de handoff y aviso móvil. El apéndice «Editor refinements» se reparte en F0 y desaparece.
- `editor/index.html` (modify): `theme-color` #0E0E0C, `<meta name="color-scheme" content="dark">` y `<style>html,body{background:#0E0E0C}</style>` contra el flash blanco.
- `src/App.tsx` (modify): header nuevo, orden rail → panel → visor, barra de reproducción, eyebrow del panel, resizers en lugar de «Acomodar paneles», orden de bloques en Texto y Estilo, `guideName` a `TimelineDock`.
- `src/components/timecode.ts` (create): `formatTimecode` y `formatClock`, funciones puras.
- `src/components/Resizer.tsx` (create): separador accesible para arrastre y teclado.
- `src/components/TimelineDock.tsx` (modify): pistas T/V1/A1, cabezal único, scrubber sobre la regla, sin `dock-clock`, prop `guideName?`.
- `src/components/StyleGallery.tsx` (modify): fondos de muestra cálidos y `data-font-preview` en `.style-card-frame`.
- `src/components/FontBrowser.tsx` (modify): `data-font-preview` en las dos muestras (líneas 98 y 123).
- `src/components/LibraryPanel.tsx` (modify): `data-font-preview` en `.library-preview`.
- `src/components/OutputPanel.tsx` (modify): damero del swatch «Cuadros» en tonos cálidos.
- `src/components/EmptyState.tsx` (modify): pasos `01/02/03` y título con acento serif; mismos botones y textos de acción.

### Out of scope
- Funciones o atajos nuevos.
- Cambios de flujo de datos, de motor, de render, de export, de STT, del modelo de proyecto o del autosave.
- Cambios en presets, estilos o fuentes de subtítulo (incluida Inter como fuente por defecto de `createTextLayer`).
- Editor móvil o tablet (<1024), tema claro y persistir el tamaño de los paneles.
- Dividir el panel en biblioteca + inspector, arrastrar desde la galería al lienzo y miniaturas de video en V1.
- Cambios en la landing fuera del `@import` de tokens.
- Archivos de Codex.

### Acceptance criteria
Convenciones:
- «Build», «Runtime» y «CDP»: como en `docs/plan-landing-pro.md`. El Runtime corre en 4184.
- «Base»: 7e9c16b extraído con `git archive 7e9c16b` en `tmp/qa/editor-redesign/base/` y construido ahí. Node resuelve el `node_modules` del worktree subiendo directorios; si no lo encuentra, se usa `mklink /J`. Nunca se instala nada. Base y rama se miden en serie en 4184, en el mismo equipo y con perfil limpio.
- «Semilla»: `tmp/qa/editor-redesign/seed.mjs` (CDP, sólo roles y nombres accesibles) hace «Empezar de nuevo», crea 3 frases `HOLA ÑANDÚ`, `¿QUÉ PASÓ?`, `TERCERA FRASE` y aplica «Amarillo impacto» a todas.
- «Muestras»: descendientes de `.stage-frame`, `[data-font-preview]`, `.real-motion-preview` y `.handoff-preview`.
- «Recorrido»: las 6 herramientas del rail, el menú Proyecto abierto, Biblioteca, el explorador de fuentes abierto, «Guardar en mi biblioteca» y Subtítulos → Revisión.

Criterios:
- AC1: No hay Inter en la UI. Check: CDP 1366×768 en `/editor/` con la semilla; en cada vista del recorrido, `getComputedStyle(el).fontFamily` de todo elemento con `checkVisibility()` fuera de las muestras. Pass: 0 elementos con la familia `Inter` (`/(^|,)\s*"?Inter"?\s*(,|$)/i`); `body` empieza por `Archivo`.
- AC2: La tipografía de marca está aplicada. Check: con el mismo CDP, `getComputedStyle` de `.wordmark`, `.panel-head h2`, `.viewer-time`, `.dock-ruler span`, la primera `.track-code` y un botón del rail; además `rg -n "font-weight:\s*(100|200|300|500|600|650|800)" src/styles`. Pass: wordmark y h2 → `Anton`; viewer-time, regla y track-code → `JetBrains Mono`; rail → `Archivo`; rg 0 líneas.
- AC3: No quedan azules, violetas ni restos de la paleta vieja. Check: `rg -n -i "5B8CFF|7FA6FF|33477F|91, ?140, ?255|061027|08101F|3FE494|22D97E|04150C|74c9b4|102822|2c3a56|2c1c3d|0f1a2e|1D232E|14181F|121720|080b12|08090c|0A0C10|13161C|1A1E26|232833|262B35|343B49|E9ECF2|A7B0C1|7E8797|a2aab9|3a3f4a|23262d|FFC53D|7c3aed|8b5cf6|a855f7" src/styles src/components src/App.tsx editor/index.html` y `rg -n -i -o "#[0-9a-f]{3,8}\b|rgba?\([^)]*\)" src/styles --glob "!tokens.css" | rg -v -i "#000\b|#000000|#fff\b|#ffffff|#00ff00|rgba\((0, ?0, ?0|14, ?14, ?12|242, ?239, ?230|214, ?255, ?75|255, ?233, ?74|255, ?59, ?47),"`. Pass: 0 líneas en ambos comandos.
- AC4: La landing y el editor comparten tokens. Check: leer `src/brand/tokens.css`; `rg -n -i "#0E0E0C|#F2EFE6|#D6FF4B|#FFE94A|#FF3B2F|#1A1A17" src/landing/landing.css src/styles`; `rg -n "@import '../brand/tokens.css'" src/landing/landing.css src/styles/tokens.css`; CDP en `/` y en `/editor/` con `getComputedStyle(document.documentElement).getPropertyValue(v).trim()` para `--negro --hueso --lima --resaltado --rec --f-texto --f-mono --f-titulo`. Pass: el archivo define exactamente las 11 propiedades de §Tokens; el primer rg da 0 líneas; el segundo da 2 (la primera regla de cada archivo); los valores son idénticos en las dos páginas.
- AC5: La landing no cambia. Check: Runtime de base y de rama; CDP con `prefers-reduced-motion: reduce`, esperando `document.fonts.ready`; captura full-page de `/` a 1440×900 y 390×844 en ambos; LP-AC2 y LP-AC31 sobre la rama. Pass: 0 píxeles distintos entre base y rama en las dos capturas; LP-AC2 y LP-AC31 PASS.
- AC6: El layout cumple las medidas a 1366×768. Check: CDP con la semilla, herramienta Texto y tamaños por defecto; `getBoundingClientRect()` de `.topbar`, `.rail`, `.panel`, `.stage`, `.stage-frame`, `.viewer-bar`, `.dock`, `.dock-head`, el botón «Exportar» y los 6 botones del rail; `scrollWidth`/`clientWidth` de `documentElement` y `.topbar`. Pass:
  - topbar de 48±1 de alto; rail en x=0 con 64±1 de ancho.
  - `panel.left = rail.right` ±1 y panel de 360±1; `stage.left = panel.right` ±1 y `stage.right` = 1366±1.
  - `.stage-frame` de ≥400 de alto y dentro de `.stage-viewport`; `.viewer-bar` de 44±1 de alto y debajo del frame.
  - dock en x=0, 1366 de ancho, bottom 768±1 y 220±1 de alto; `.dock-head` de ≤40 de alto.
  - `Exportar.right` ≤1358; los 6 botones del rail enteros en el viewport.
  - ningún `scrollWidth` mayor que su `clientWidth`.
- AC7: El layout aguanta 1920×1080 y 1024×768. Check: lo mismo que AC6 en esos dos tamaños. Pass: a 1920×1080, panel de 360, `.stage-frame` de ≥720 de alto y dock de 220; a 1024×768, sin scroll horizontal en el documento ni en el topbar, Exportar entero, stage de ≥560 de ancho y el botón de biblioteca conserva el nombre accesible «Biblioteca».
- AC8: Los resizers funcionan con teclado y mouse. Check: CDP a 1366×768.
  - Separador «Ancho del panel»: llegar con Tab y leer `role`, `aria-orientation`, `aria-valuemin`/`max`/`now`; ArrowRight ×3, End, Home y arrastre de +100 px.
  - Separador «Alto de la línea de tiempo»: ArrowUp ×2, End, Home y arrastre de −60 px en Y.
  - Comparar `localStorage['gb-motion:project']` antes y después.

  Pass: `role="separator"` con orientación `vertical`/`horizontal` y límites 300–520 y 180–360. El panel pasa por 408 → 520 → 300 → 400 y el timeline por 252 → 360 → 180 → 240, siempre con `aria-valuenow` igual a la medida real. Ambos muestran foco amarillo visible y el autosave queda idéntico.
- AC9: Las pistas y el cabezal único funcionan. Check: semilla + video de guía subido por la UI (Runtime, mp4 de prueba en `tmp/qa/`), modo «Pistas» y después «Subtítulos». Con el slider «Posición del video», seek con teclado a los frames 0, 45 y el último; poner «Inicio» de la frase 2 en 2 s (F=60), seek a 60 y arrastrar el clip 2 con el mouse. Pass:
  - Se ven los encabezados `T1`, `T2`, `T3`, `V1` y `A1` (incluido el `::before`).
  - Hay exactamente un `.dock-playhead`, de color `rgb(214, 255, 75)`, y va de la regla hasta el fondo de A1.
  - En F, el centro del cabezal queda a ±2 px del borde izquierdo del clip 2. Tras el arrastre cambia «Inicio».
  - Con scroll vertical de las frases, la regla y V1/A1 siguen visibles (sticky).
  - Los nombres accesibles de las filas y los clips coinciden con base (AC15).
- AC10: La barra de reproducción funciona. Check: CDP con el slider en el frame 45; leer `.viewer-time` y el total; «Reproducir», esperar 1 s y «Pausar»; Espacio con foco en `body`; «Ver entrada» con la frase 3 activa; botón de audio. Pass:
  - `.viewer-time` muestra `00:00:01:15` y el total es `formatTimecode(duración)`.
  - Reproducir/Pausar alterna su nombre, el tiempo avanza y Espacio también alterna.
  - «Ver entrada» salta al inicio de la frase 3 y reproduce.
  - El audio alterna «Activar audio»/«Silenciar audio».
  - Los selects «Zoom del lienzo» y «Zona segura» están en la barra.
- AC11: Los flujos clave dan lo mismo en base y rama. Check: `tmp/qa/editor-redesign/flows.mjs` (CDP, sólo roles y nombres accesibles) corre igual contra base y rama desde perfil limpio:
  1. Semilla.
  2. Editar el texto de la frase 2 en Texto.
  3. Aplicar un estilo de Estilo → Todos.
  4. Elegir un efecto de entrada en Efectos.
  5. Llevar el slider al frame 20, activar la frase 1 y «Dividir aquí».
  6. Ctrl+Z.
  7. Ocultar la frase 3 y bloquear la frase 1 en «Pistas».
  8. Exportar → «Subtítulos .srt» y «.vtt».
  9. Proyecto → «Descargar proyecto».

  Pass: el `localStorage['gb-motion:project']` final y los `.srt`, `.vtt` y `.json` descargados son byte-idénticos entre base y rama (normalizando campos de fecha si existen), con 0 errores en la consola de la rama.
- AC12: Los ACs previos del editor siguen en pie. Check: re-ejecutar sobre la rama LP-AC3, LP-AC7, LP-AC10 (parte UI), LP-AC15, LP-AC20, LP-AC22, LP-AC23 (parte UI), LP-AC24, LP-AC25, LP-AC26, LP-AC32 y LP-AC36, tal como están en `docs/plan-landing-pro.md`. Pass: todos PASS; los BLOCKED históricos se declaran igual.
- AC13: El motion respeta reduced-motion. Check: CDP con `prefers-reduced-motion: reduce`: cargar, recorrer las 6 herramientas, abrir y cerrar Proyecto, hover en botones y tarjetas, provocar un toast e iniciar un export verde corto (Runtime); 300 ms después de cada acción contar `document.getAnimations().length`. Sin emulación: 10 s de reposo después de cargar, y después durante un export. Además, `rg -n "animation(-name)?\s*:" src/styles` y revisar cada línea. Pass: 0 animaciones en todos los conteos con `reduce`; sin emulación, 0 animaciones con `iterations === Infinity` en reposo; durante el export, el REC del wordmark tiene `iterations ≤ 3`; toda declaración `animation` está dentro de `no-preference`.
- AC14: El contraste cumple AA. Check: `tmp/qa/editor-redesign/contrast.mjs` (CDP, 1366×768) sobre el recorrido y sobre los estados sin servidor, export con error y frase bloqueada. Para cada nodo de texto visible fuera de las muestras, sin `disabled`/`aria-disabled` en sus ancestros ni `aria-hidden`, compara el color con el fondo efectivo: el primer ancestro con `background-color` no transparente, con su alfa compuesta sobre `--negro`. Pass: 0 pares por debajo de 4,5:1 (3:1 si mide ≥24 px, o ≥18,66 px con peso 700); el reporte incluye la tabla de §Tokens con los ratios.
- AC15: Se conservan el foco y los nombres accesibles. Check: `Accessibility.getFullAXTree` en cada vista del recorrido, en base y en rama, con los nombres de los roles button, link, textbox, combobox, slider, checkbox, separator, tab, menuitem y spinbutton; en la rama, Tab ×40 desde el inicio leyendo outline/box-shadow de `document.activeElement`. Pass: todo nombre de base existe en la rama, salvo `← GB Motion`, que pasa a `GB Motion, inicio`; los nombres nuevos son sólo los de §Copy; cada elemento enfocado muestra un outline sólido ≥2 px de `rgb(255, 233, 74)` o, en clips sobre hueso o lima, un indicador ≥2 px con ≥3:1 contra el clip.
- AC16: El tiempo de carga no empeora más de 10 %. Check: Runtime de base y de rama, en serie en 4184; CDP con perfil limpio, sin caché y a 1366×768; 7 cargas de `/editor/` por lado midiendo `loadEventEnd`, `t_ready` (momento en que existen `.rail` y `.dock` y ya resolvió `document.fonts.ready`) y los bytes transferidos de CSS y JS; además `gzip -9` del CSS y del JS inicial que referencia `dist/editor/index.html`. Pass: medianas de la rama ≤ base × 1,10 en `loadEventEnd` y `t_ready`; CSS gzip ≤ base + 6 KB; JS inicial gzip ≤ base + 3 KB; el reporte trae los números.
- AC17: El preview mantiene sus FPS y nada filtra el lienzo. Check:
  - Con la semilla, reproducir 5 s en base y en rama (3 corridas por lado), contando los `frameupdate` del Player y los frames de `requestAnimationFrame`.
  - Script que lista elementos con `filter`, `backdrop-filter` o `mix-blend-mode` distintos de `none`, fuera de las muestras.
  - `rg -n "backdrop-filter|mix-blend-mode" src/styles` y `rg -n -P "(?<!repeating-)(linear|radial|conic)-gradient\(" src/styles`.

  Pass: mediana de FPS de la rama ≥ 0,95 × base; 0 elementos en el script; 0 líneas en ambos rg.
- AC18: Build y validadores en verde. Check: Build. Los 9 validadores: `node --experimental-strip-types scripts/validate-{font-registry,motion-engine,editor,captions,server,product,lifecycle,caption-review,handoff}.mjs`. `validate-webm-alpha` en turno de render coordinado y `node scripts/validate-reproducible-install.mjs` (Codex o el tester con su protocolo aislado). Pass: exit 0 e impresión `*_OK` en todos, sin warning de chunk grande.
- AC19: No hay dependencias nuevas ni cambios fuera de la UI. Check: `git diff 7e9c16b --stat -- package.json pnpm-lock.yaml vite.config.ts src/hooks src/engine src/remotion src/presets src/utils src/typography src/fonts.ts src/main.tsx server scripts` y `git diff 7e9c16b --name-only`. Pass: el primero sale vacío; el segundo lista sólo archivos de §Files to touch y de `docs/`.
- AC20: Los estados de borde se ven bien. Check:
  - (a) Servir `dist` sin API (como LP-AC7) a 1366×768 y a 1024×768.
  - (b) Bloquear `/api/render` con 503 por CDP y exportar.
  - (c) STT mock en curso (Runtime con mock).
  - (d) Frase bloqueada activa en Texto.

  Pass:
  - (a) «Modo navegador», su motivo y «Reintentar» quedan visibles dentro del header (`right` ≤ viewport), el header mide 48±1 de alto y no hay scroll horizontal.
  - (b) `.export-status.error` con borde y texto en `--danger`, contraste ≥4,5.
  - (c) El chip de tarea muestra «Cancelar» y el header sigue en una sola fila (48±1).
  - (d) El clip bloqueado tiene patrón rayado y conserva el nombre accesible de base.
- AC21: El estado vacío y los diálogos tienen la identidad nueva. Check: Proyecto → «Empezar de nuevo» y aceptar; leer `.empty-state`; con ajustes finos, abrir «Guardar en mi biblioteca», «Biblioteca» y un `#estilo=` válido con proyecto existente (HandoffDialog); cerrar cada uno con Cancelar/Cerrar. Pass: `.empty-state h2` computa `Anton` y su `em` computa `Instrument Serif` itálica; «Elegir un video» tiene fondo `rgb(214, 255, 75)`; `.modal-backdrop` tiene `backdrop-filter: none` y alfa ≥0,8; `.modal` tiene `border-radius` ≤2px; cada diálogo cierra igual que en base y el autosave no cambia.
- AC22: Hay capturas para Alejo. Check: capturas a 1366×768 y 1920×1080 de las 6 herramientas con la semilla, del estado vacío y del modo navegador en `tmp/qa/editor-redesign/shots/`. Pass: existen las 16 capturas y el reporte las enumera. La revisión visual de Alejo es el gate humano.

## Diseño y trade-offs
- **Panel pegado al rail (izquierda) y visor a la derecha.** Hoy el rail está a la izquierda y su panel a la derecha, con el lienzo en el medio: cada cambio de herramienta obliga a cruzar la pantalla con la vista. Canva y CapCut ponen las pestañas pegadas a su contenido. Es un cambio del grid y del orden del DOM (rail → panel → visor, que también ordena el Tab). Rechazados:
  - Panel a la derecha (statu quo): no resuelve la distancia.
  - Biblioteca a la izquierda + inspector a la derecha, como CapCut: exige mostrar dos herramientas a la vez, o sea, cambiar el flujo.
  - Pestañas horizontales arriba: roban alto a 768.
- **Una sola barra de reproducción bajo el visor (estilo CapCut).** Se juntan los controles de transporte (antes arriba) y el timecode (antes en el timeline): `timecode | Ver entrada · Play · Audio | Vista · Zona segura · formato`. Ahorra unos 40 px de alto para el lienzo.
- **Timeline con pistas.** T1…Tn son las frases, V1 el video de guía (sólo visual) y A1 la forma de onda. Hay un cabezal único lima sobre todas las pistas; la regla es sticky arriba, V1/A1 sticky abajo y los encabezados sticky a la izquierda; el slider «Posición del video» queda superpuesto a la regla. El prefijo «T» sale de `::before { content: 'T' / '' }`, así los nombres accesibles no cambian.
- **Resizers en lugar de «Acomodar paneles».** Son los mismos estados (`panelWidth` 300–520, `timelineHeight` 180–360, sin persistir) y los mismos nombres accesibles, pero con `role="separator"`, arrastre y teclado. El encabezado del panel queda sin ruido.
- **Tokens:**
  - `src/brand/tokens.css` lleva sólo custom properties en `:root`. Lo importan la landing y el editor y no rompe el aislamiento de 0007, porque no trae selectores de elementos.
  - El editor conserva sus nombres semánticos (`--bg`, `--surface`, `--accent`…) remapeados a la marca para minimizar el churn.
  - Rechazados: copiar valores (deriva entre landing y editor) y renombrar todo (churn sin beneficio).
- **Primitivas congeladas en F0:** `.button`, `.ghost-button`, `.icon-button`, `.linklike`, `.segmented`, inputs/selects base, `input[type=range]`, `.tuner` y foco. Así A y B (F1) construyen sobre lo mismo sin pisarse.
- **Contratos a Codex: ninguno.** El timecode, el eyebrow y V1 salen de estado que App ya tiene (`currentFrame`, `duration`, `activeLayer`, `guideName`, `guide.durationInFrames`).
- **Firmas nuevas:**
  - `formatTimecode(frame: number, fps = 30): string`: `HH:MM:SS:FF` con frames negativos como 0 (45 → `00:00:01:15`).
  - `formatClock(frame: number, fps = 30): string`: `MM:SS`, idéntico al `clock` actual (lo usan los `aria-label`).
  - `Resizer(props: { label: string; orientation: 'vertical' | 'horizontal'; value: number; min: number; max: number; onChange: (v: number) => void; invert?: boolean; className?: string })`: ±16 con flechas (horizontal: ArrowUp suma con `invert`), ×4 con Shift, Home/End a los límites, arrastre con `setPointerCapture` y `aria-valuenow={value}`.
  - `TimelineDock` Props: `+ guideName?: string`.

## Dirección de arte
- **Header** (48 px, `--negro`, borde inferior `--line-2`; grid `auto 1fr auto`):
  - Izquierda: wordmark Anton 20 px «GB MOTION» con punto REC de 8 px. Es un link a `/` con nombre «GB Motion, inicio» y title «Volver a la página de GB Motion». Con `.is-rec` (export o STT en curso) el punto parpadea 3 veces y queda fijo. Siguen un divisor de 1 px, «Proyecto» (ghost + `ChevronDown` 14) y Deshacer/Rehacer (32×32).
  - Centro: nombre del proyecto en Archivo 700 14 px, centrado, máx. 280 px, con borde `--line-2` en hover/foco. Al lado, el estado en mono 11 px mayúsculas con punto: lima «Guardado», `--text-3` «Guardando…», `--danger` «Sin guardar» (mismos textos; bajo 1180 px el texto pasa a `.sr-only`).
  - Derecha: chip STT (mono 12, punto REC, «Cancelar»); `ServerStatus` como chip de 2 px (punto lima listo, `--danger` sin servidor); «Biblioteca» con ícono `Library` (sólo ícono bajo 1280, con `aria-label="Biblioteca"`); Ajustes finos (lima si está activo); Guardar en biblioteca; y «Exportar» primario lima de 36 px con ícono `Download` y empujoncito al hover.
- **Rail** (64 px, `--negro`, borde derecho `--line`): botones de 56×56, ícono 20 y etiqueta Archivo 700 11 px en `--text-2`. El activo lleva fondo `--surface-2`, texto hueso, ícono lima y barra lima de 3 px a la izquierda (`::before`, `scaleY` en `steps(3)`). Orden y nombres según 0006.
- **Panel** (`--surface` #1A1A17, borde derecho `--line-2`, resizer de 6 px sobre ese borde):
  - Encabezado: eyebrow mono 11 en `--text-2` (`T2 · Frase 2`, `V1 · <video>`/`V1 · Sin video`, `3 frases`, `1080 × 1920 · 30 fps`), h2 Anton 22 px en mayúsculas, hint 12 px en `--text-3` y tira de acciones ghost tiny (copiar/pegar y selección múltiple, sin cambios).
  - Cuerpo con `scrollbar-gutter: stable`. Los `panel-block` van separados por 1 px; el h3 es mono 11 en mayúsculas con una línea que completa el ancho.
  - Controles de 32 px, fondo `--negro` y borde `--line-2`; con foco, borde lima + outline amarillo. Los segmentados marcan el activo en hueso con texto negro. El `tuner` usa summary mono y `+`/`−`.
  - Galerías en 2 columnas, tarjetas de 2 px; la seleccionada lleva borde lima de 2 px y nombre lima, el hover un empujoncito con sombra dura hueso. Plantillas: nombre en Archivo 700 13 y descripción 12. Revisión: timecode mono en resaltado. Guion: textarea negro.
  - Exportar: primario lima, secundarios outline, barra lima de 3 px y «Videos anteriores» en lista mono.
  - Orden de Texto: `TextPanel` → `WordTimingPanel` (details al final). Orden de Estilo: Plantillas → galería → Combinaciones → Aplicar a todas → `StyleTuner` → Compartir.
- **Visor:**
  - Fondo `--negro` plano. `.stage-frame` sin radio, con `box-shadow: 0 0 0 1px var(--line-2)` y sin blur.
  - Overlay: la caja activa lleva 1 px lima + 1 px negro por fuera; el hover, lima al 50 %; la etiqueta, lima con texto negro en mono 11. Handles de 20 px, negros con borde lima (rotar = círculo, escalar = cuadrado). Guías lima de 1 px.
  - Zonas seguras con relleno `rgba(255,59,47,.14)` y borde punteado al 0,7.
  - `.viewer-bar` (44 px, `role="group"`, «Reproducción»), grid `1fr auto 1fr`. A la izquierda, `.viewer-time` mono 14 hueso + `/ total` mono 12 en `--text-3`. En el centro, «Ver entrada», Play lima de 40×32 y audio. A la derecha, Vista, Zona segura y un chip mono con el formato.
- **Línea de tiempo** (ancho total, `--surface`, borde superior `--line-2` + resizer de 6 px que no suma alto):
  - Cabecera de 40 px: «Tus frases» mono + conteo y, en una fila, Subtítulos/Pistas, «Imán …» (`Magnet`; lima si está activo), Zoom, «Dividir aquí» (`Scissors`), «Duración automática» y «Agregar frase» (outline lima).
  - Regla sticky: mono 11 con ticks de 1 px (`repeating-linear-gradient`).
  - Encabezados de 200 px (`--timeline-label`), sticky y opacos: chip `.track-code` mono, nombre Archivo 12 y acciones en hover o fila activa. La fila activa lleva `--surface-2` + borde lima de 2 px.
  - Carriles `--negro` de 34 px con línea `--line`. Clips: hueso con texto negro en Archivo 700 12; el activo, lima con borde interno negro; el bloqueado, `--surface-3` con rayas `repeating-linear-gradient`; el oculto, al 38 %. Entrada/salida: zonas negras al 28 % con rayas y tiradores negros.
  - V1 (si hay video): bloque `--surface-3` con el nombre en mono, `role="img"` y nombre «Video de referencia: …». A1: onda en `--text-2`.
  - Cabezal: lima de 2 px con una bandera de 10 px (`clip-path`) sobre la regla, `pointer-events: none`.
  - Pie de 32 px con «Inicio» y «Duración» en mono 13.
- **Estados vacíos:**
  - `EmptyState` como claqueta: tarjeta `--surface` con borde hueso y sombra dura lima de 6 px. h2 Anton 32 «Subí tu <em>video</em>» (em en Instrument Serif itálica, sin mayúsculas). Pasos `01/02/03` en cuadrados lima/negro, «Elegir un video» en primario y «Escribir a mano» en ghost.
  - `.empty` del panel: mono 12 en `--text-3` con borde punteado `--line-2`.
- **Diálogos:**
  - Backdrop `rgba(14,14,12,.86)` sin blur; caja `--surface` con borde `--line-2`, radio 2 y `8px 8px 0 rgba(0,0,0,.6)`; eyebrow mono lima; h2 Anton 24; primario lima a la derecha.
  - Menú Proyecto y explorador de fuentes: `--surface-2` con sombra dura.
  - Toast negro con borde hueso, ubicado en `bottom: calc(var(--timeline-height) + 12px)`.
  - Aviso de handoff con borde `--danger`; aviso móvil sobre negro opaco.

## Tokens
`src/brand/tokens.css` (texto exacto):
```css
/* GB Motion · marca «Sala de edición». Sólo custom properties: lo importan la landing y el editor. */
:root {
  --negro: #0E0E0C; --hueso: #F2EFE6; --lima: #D6FF4B; --resaltado: #FFE94A; --rec: #FF3B2F;
  --verde: #00FF00; --panel: #1A1A17;
  --f-titulo: 'Anton', 'Arial Narrow', Impact, sans-serif;
  --f-serif: 'Instrument Serif', Georgia, serif;
  --f-texto: 'Archivo', system-ui, Arial, sans-serif;
  --f-mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
}
```
Editor (`src/styles/tokens.css`, después del `@import`):

| Token | Valor | Uso | Contraste del texto |
|---|---|---|---|
| `--bg` | `var(--negro)` | rail, visor, carriles, inputs | |
| `--surface` | `var(--panel)` | panel, dock, modales | |
| `--surface-2` | `#22221E` | hover, fila activa, menús | |
| `--surface-3` | `#2C2C27` | V1, clip bloqueado | |
| `--line` / `--line-2` | `rgba(242,239,230,.12)` / `.24` | bordes | |
| `--text` | `var(--hueso)` | texto | 15,2:1 sobre `--surface` |
| `--text-2` | `#BDBAAE` | etiquetas | 7,2:1 sobre `--surface-3` |
| `--text-3` | `#A3A094` | hints | 5,3:1 sobre `--surface-3` |
| `--accent`, `--go` | `var(--lima)` | primario y selección | |
| `--accent-soft` / `--accent-line` | `rgba(214,255,75,.12)` / `.45` | fondos y bordes de selección | |
| `--on-accent` | `var(--negro)` | texto sobre lima | 16,8:1 |
| `--highlight` | `var(--resaltado)` | foco, avisos y favoritos | |
| `--danger` | `#FF6A5C` | errores | 5,0:1 sobre `--surface-3` |
| `--radius` | `2px` | | |
| `--header-h`, `--rail-w`, `--viewer-h`, `--timeline-label` | `48px`, `64px`, `44px`, `200px` | medidas | |

Escala tipográfica: 11 (mono, regla, etiquetas), 12 (hints, tiny), 13 (controles), 14 (inputs, timecode), 20–22 (Anton en wordmark y h2), 24–32 (Anton en modal y estado vacío). Foco: `outline: 2px solid var(--highlight); outline-offset: 2px`. En clips, por el `overflow` del carril: `outline-offset: -4px` en negro + `box-shadow: inset 0 0 0 2px var(--highlight)`.

## Motion
- Todo dentro de `@media (prefers-reduced-motion: no-preference)`. El bloque `reduce` de `tokens.css` queda `*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}`.
- Empujoncito hover (botones primarios y secundarios, tarjetas): `translate(-1px,-1px)` + sombra dura, `.12s steps(2,end)`.
- `ed-panel-in`: `.panel-body > *` al montar, opacity 0→1 y `translateY(4px)`→0, `.16s steps(4,end)`.
- Barra del rail: `scaleY` en `.12s steps(3,end)`. Toast: `ed-toast-in` con `translateY(8px)`, `.16s`.
- REC: `rec-blink` de la landing (opacity `steps(1)`) con `animation-iteration-count: 3` en `.wordmark.is-rec .rec` y `.task-chip .rec`.
- Se mantienen `.spin` y las vistas previas `fx-*` de las tarjetas de efectos (hover), sólo en `no-preference`. Las `fx-*` imitan efectos del motor (por eso `fx-blur` usa `filter`) y viven en el panel, lejos del lienzo.
- Nada anima propiedades de layout, `filter` ni sombras con blur, y nada corre en reposo.

## Copy nuevo (nombres accesibles y textos)
- «GB Motion, inicio» (link del wordmark).
- «Reproducción» (grupo).
- `aria-label` «Tiempo actual» y «Duración total».
- «Ancho del panel» y «Alto de la línea de tiempo» (los mismos nombres que antes, ahora como separadores).
- «Video de referencia: <nombre>».
- Eyebrows: `T<n> · <nombre>`, `V1 · <video>`, `V1 · Sin video`, `<n> frases`, `<ancho> × <alto> · 30 fps`.
- Encabezados: `V1 · Video` y `A1 · Audio`.
- Estado vacío «Subí tu video» con «video» en serif (mismas palabras) y pasos `01`, `02`, `03`.

## Riesgos y casos borde
- **Memoria muscular:** Alejo puede extrañar el panel a la derecha. Volver atrás es reversible (grid + orden del DOM), queda como pregunta abierta 1.
- **Reescribir CSS puede dejar selectores sin estilo.** Antes de F1 se arma un inventario: `rg -o "className=\"[^\"]+\"|className=\{\`[^\`]+\`\}" src` → `tmp/qa/editor-redesign/classes.txt`. Cada coder marca sus clases y el tester revisa capturas (AC22).
- **`text-transform` puede alterar nombres accesibles en Chromium:** sólo se usa en h2/h3 y eyebrows (AC15).
- **Outline recortado por el `overflow: hidden` de los carriles:** foco interno en los clips (§Tokens). Los encabezados sticky necesitan fondo opaco para tapar los clips cuando hay zoom horizontal.
- **Geometría del cabezal único:** tiene que mapear el mismo `span` que los clips y el scrubber. `begin()` sigue midiendo el primer `.dock-lane` dentro de `lanesRef`, así que V1/A1 van fuera de `lanesRef` (AC9).
- **Fuentes:** la UI ahora pide Archivo 400/700 + JetBrains Mono 400 + Anton al cargar, e Inter sigue llegando para el subtítulo por defecto: unos +3 woff2. Lo mide AC16. Los pesos 500/600 sin cara caerían en 700: se normalizan a 400/700 (AC2).
- **Pixel-identidad de la landing** (AC5): puede variar por timing de fuentes. Se captura tras `fonts.ready` y se repite una vez antes de declarar FAIL.
- **Dos coders en el mismo worktree:** cada uno hace `git add` sólo de sus archivos y corre `tsc` al commitear. Si falla por WIP del otro, avisa en vez de tocar ese archivo.
- **Cascada del F0:** mover reglas cambia el orden de la cascada. Se acepta deriva visual en F0, porque los ACs se evalúan después de F2.
- **Arrastres:** el arrastre de clips depende de la geometría y no entra en AC11 (por eso AC9 lo prueba aparte).

## Pasos
Un commit por fase con hash anunciado (0005). Baseline antes de tocar nada: el tester exporta la base, la construye y guarda en `tmp/qa/editor-redesign/base-*`: capturas de `/` y `/editor/`, árbol AX del recorrido, `flows.mjs`, mediciones de carga y FPS.

**F0 · Base común** (un solo coder, secuencial; commit «F0 tokens, primitivas y contratos»):
1. Crear `src/brand/tokens.css` (§Tokens). En `landing.css`, poner el `@import` como primera regla y borrar de `:root` `--negro --hueso --lima --resaltado --rec --verde --panel --f-*`.
2. `src/styles/tokens.css`:
   - `@import '../brand/tokens.css';` + tabla de §Tokens.
   - `:root { font-family: var(--f-texto); font-size: 13px }`.
   - Foco amarillo y scrollbars `--line-2` cuadradas.
   - Nuevo bloque `reduce`.
   - Agregar `.sr-only`.
3. Repartir el CSS sin cambiar los selectores:
   - El apéndice de `modal.css:55-140` va al final de su archivo dueño: `.workbench`, `.stage*`, `.project-name`, `.saved`, `.rail button`, `.icon-button:disabled` → layout; `.panel-head*`, `.hint`, `.style-card*`, `.real-motion-preview`, `.motion-tag` → panels; `.field*`, `.chips`, `.loop-chip`, `.caption-tools`, `.inline-error`, `.template-list`, `.appearance-actions`, `fieldset.tuner-block`, `.word-timing-table*`, `.key-list`, `.easing-preview*`, `.selection-tools`, `.layer-select` → controls; `.dock*`, `.timeline-*`, `.clip-times*`, `.waveform*`, `.dock-row.multi-selected`, `.lane-*` → timeline; `.library-*` queda en modal.
   - `canvas.css:55-131` (explorador de fuentes y `.field-label`) → final de `controls.css`.
   - `panels.css`: `.back-link`, `.server-*` y `.task-chip` → layout; `.handoff-*` y `.desktop-notice*` → modal; `.panel`, `.panel-head`, `.panel-body` → layout.
4. Restyle de las primitivas (después quedan congeladas): `.button(.primary/.secondary/.block)`, `.ghost-button(.tiny)`, `.icon-button(.on)` y `.linklike` en layout.css; `.segmented`, `.field select/input`, `.caption-input`, `input[type=range]` (`accent-color: var(--lima)`), `.range-control`, `.time-field`, `.tuner` y `.chips button` en controls.css.
5. Crear `src/components/timecode.ts` (§Diseño). En `TimelineDock`, reemplazar `clock` por `formatClock` (mismo resultado) y sumar `guideName?: string` a Props (todavía sin uso). En App, pasar `guideName={guideName || undefined}`.
6. `editor/index.html` según §Files to touch.
7. Build + 9 validadores, commit y anunciar el hash. Desde acá, A y B en paralelo.

**F1-A · Shell** (coder A; archivos: `src/App.tsx`, `src/components/Resizer.tsx`, `src/components/EmptyState.tsx`, `src/components/LibraryPanel.tsx`, `src/styles/{layout,modal,canvas}.css`):
1. Header: reemplazar `back-link` + `brand` por el wordmark. Grupos `.topbar-left`/`-center`/`-right`. Punto + `.saved-label`. «Biblioteca» con ícono y `aria-label`. Exportar con `Download`. `.is-rec` cuando `exportState.status === 'rendering' || transcription.running`.
2. Workbench en orden `nav.rail`, `aside.panel`, `main.stage`, con grid `var(--rail-w) var(--panel-width) minmax(0,1fr)` y `aside` en `position: relative`. `<Resizer label="Ancho del panel" orientation="vertical" min={300} max={520}>` como último hijo del aside, con hit de 6 px sobre el borde. `<Resizer label="Alto de la línea de tiempo" orientation="horizontal" invert min={180} max={360}>` entre el workbench y `TimelineDock`, sin sumar alto (AC6: dock de 220). Borrar `details.workspace-options`.
3. Encabezado del panel: `<p className="panel-eyebrow">` con el texto según la herramienta (§Dirección de arte). Mantener `selection-tools` y `appearance-actions` con los mismos handlers.
4. Visor: borrar `.stage-toolbar` y crear `.viewer-bar` debajo de `.stage-viewport`. Los botones, selects y handlers se mueven tal cual; se suman `.viewer-time` (`formatTimecode(currentFrame)`) y el total (`formatTimecode(duration)`).
5. Reordenar los bloques de Texto y Estilo (mismos props).
6. CSS de layout, modal y canvas según §Dirección de arte. `EmptyState` con `<b>01</b>`… y `<h2>Subí tu <em>video</em></h2>`. `LibraryPanel` con `data-font-preview` en `.library-preview`. Borrar las reglas muertas (`.back-link`, `.brand*`, `.stage-toolbar`, `.workspace-options`, el `@media` de 680 px). Bajo 1024 sólo `--panel-width: min(var(--panel-width), 40vw)`.
7. Build, commit «F1-A shell».

**F1-B · Timeline y contenido del panel** (coder B; archivos: `src/components/{TimelineDock,StyleGallery,FontBrowser,OutputPanel}.tsx`, `src/styles/{timeline,panels,controls}.css`):
1. `TimelineDock`:
   - Borrar `dock-clock`/`dock-total`; la cabecera queda con título + `lane-count` + herramientas (íconos `Magnet`, `Scissors`).
   - Estructura: `.timeline-content` (relative) > fila de regla sticky (celda vacía + regla + `input.dock-scrubber` superpuesto) > `.dock-rows` (`lanesRef`, sólo T) > `.dock-media` sticky abajo (V1 si `guideDuration`, A1 si `waveform`, con el mismo `aria-label` de la onda) > un único `<span className="dock-playhead" style={{'--p': f/span}}>` con `left: calc(var(--timeline-label) + (100% - var(--timeline-label)) * var(--p))`.
   - Borrar los cabezales por fila.
   - `<b className="track-code">{index + 1}</b>` (mismo texto) con el `::before` `'T' / ''`. En modo carril, `<b className="track-code" aria-hidden="true">1</b>` antes de «Subtítulos».
2. `timeline.css` según §Dirección de arte (encabezados sticky `left: 0` opacos, regla sticky `top: 0`, `.dock-media` sticky `bottom: 0`).
3. `panels.css` y `controls.css`: todo lo que va dentro de `.panel-body`, más el explorador de fuentes. Favoritos en `--highlight`; nada de `#FFC53D`. Además:
   - `.swatch.custom` deja el `conic-gradient` arcoíris (tiene `#B36BFF` violeta y rompe AC3/AC17): fondo transparente, borde punteado hueso y `::before { content: '+' / '' }` mono.
   - `.motion-card-frame` pasa a `--surface-2` plano.
   - Las rayas de `.clip-fx::after` (timeline.css) pasan a `rgba(14,14,12,.18)`.
4. `StyleGallery`: `backdrops` = `linear-gradient(155deg,#3a372f,#141412 58%,#2a2420)`, `(155deg,#3d2a1c,#150f0b 60%,#2d2418)`, `(155deg,#2b3326,#10130e 60%,#262a1f)`, `(155deg,#3a2422,#140d0c 60%,#2e1d1a)`, `(155deg,#33302a,#0f0f0d 65%,#24221d)`, `(155deg,#33241a,#141010 60%,#2b1519)`. Sumar `data-font-preview` al botón `.style-card-frame`. `FontBrowser`: `data-font-preview` en el `span` (98) y el `strong` (123). `OutputPanel`: `repeating-conic-gradient(#4A4943 0% 25%, #2A2A26 0% 50%) 50% / 12px 12px`.
5. Build, commit «F1-B timeline y panel».

**F2 · Integración** (un coder, después de A y B; cualquier archivo de §Files to touch): revisar en el navegador la unión panel/visor/timeline a 1024, 1366 y 1920. Ajustar huecos, correr AC1–AC21 con el tester y generar las capturas de AC22. Corregir y cerrar con el commit «F2 integración». Si un AC falla por diseño, vuelve al architect como revisión.

En paralelo sólo F1-A ∥ F1-B, con archivos disjuntos y primitivas y tokens congelados en F0. Contratos A↔B: A es dueño de `.app .topbar* .wordmark .rail* .workbench .panel .panel-head* .panel-eyebrow .panel-body .stage* .viewer-* .resizer* .toast .modal* .project-* .saved* .server-* .task-chip .canvas-* .smart-guide .safe-zone* .empty-state* .desktop-notice* .handoff-* .library-*`. B es dueño del resto de las clases del timeline y del contenido del panel. Variables compartidas (sin cambios): `--panel-width` y `--timeline-height` inline en `.app`, más `--timeline-label`.

## Preguntas abiertas y supuestos
1. **Panel a la izquierda, pegado al rail.** Supuesto: sí (patrón Canva/CapCut). Si Alejo lo quiere a la derecha se revierte con dos líneas del grid y el orden del DOM; AC6 cambiaría sus x.
2. **«9 validadores».** Supuesto: font-registry, motion-engine, editor, captions, server, product, lifecycle, caption-review y handoff; webm-alpha corre en turno de render y reproducible-install con su protocolo aislado.
3. **Tamaños por defecto.** Supuesto: se mantienen panel 360 y timeline 220 (a 768 de alto el lienzo queda en unos 424 px) y no se persisten.
4. **Instrument Serif.** Supuesto: sólo una palabra en el estado vacío; más serif volvería «editorial» un editor de trabajo.

## Memory
- Decisiones candidatas (se registran al cerrar la corrida):
  - Primitivas de marca en `src/brand/tokens.css` (sólo custom properties), importadas por la landing y el editor; el editor mapea sus tokens semánticos sobre ellas. Complementa 0007.
  - Layout del editor: rail + panel contiguos a la izquierda, barra de reproducción bajo el visor, timeline a todo el ancho con pistas T/V/A y cabezal único. Actualiza la parte de layout de 0006 (el orden del rail no cambia).
- Lecciones candidatas:
  - Para probar «sin cambio de comportamiento» en un rediseño visual, correr el mismo script CDP guiado por roles y nombres accesibles contra base y rama, y comparar el autosave y los archivos exportados.
  - `content: 'T' / ''` agrega prefijos visuales sin cambiar el nombre accesible.
