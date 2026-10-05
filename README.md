# GB Motion

Aplicación local para crear kinetic typography y motion captions reutilizables. El preview usa Remotion Player en tiempo real; la exportación usa Remotion Renderer y guarda los MP4 en `exports/`.

## La interfaz

Una sola pantalla, sin scroll de página. Cuatro zonas fijas:

- **Columna izquierda** — el flujo de trabajo, en orden: **Video** (subirlo y generar los subtítulos con IA), **Subtítulos** (el guion: corregir, buscar y reemplazar), **Texto**, **Estilo**, **Efectos** y **Exportar**.
- **Centro** — el video, siempre visible. Se arrastra, se gira y se redimensiona directamente sobre el lienzo.
- **Derecha** — las opciones de la herramienta elegida. Scrollea por dentro.
- **Abajo** — la línea de tiempo: cuándo aparece cada frase.

El botón de deslizadores en la barra superior abre los **ajustes finos** (guardar presets propios y exportar con transparencia). Todos los tiempos se muestran en segundos, no en cuadros.

Atajos y ayudas de la pantalla:

- **Espacio** reproduce o pausa (si el foco está en un campo de texto, escribe un espacio como siempre).
- **Zona segura** (barra sobre el lienzo): muestra qué franjas tapa la interfaz de **TikTok** o **Reels**. Es sólo una guía de la vista previa: nunca aparece en el video exportado.
- **Proyecto** (barra superior) agrupa abrir, descargar y empezar de nuevo. Al empezar de nuevo aparece una guía de tres pasos sobre el lienzo; **Escribir a mano** la cierra.

## Requisitos

- Node.js 24 (verificado con 24.19.0; las pruebas usan el cargador nativo de TypeScript)
- pnpm según `packageManager` en `package.json`, o npm
- Chrome/Chromium; Remotion puede descargar su navegador compatible en el primer render

## Ejecutar

En Windows, también podés hacer doble clic en `INICIAR_GB_MOTION.cmd`. El acceso inicia el servidor local en segundo plano y abre la aplicación en el navegador.

Desde una terminal:

```bash
pnpm install
pnpm dev
```

Abrir `http://127.0.0.1:4173`.

## Flujo rápido

1. Escribí la frase en **Texto**.
2. Elegí un look en **Estilo** — la galería dibuja cada tarjeta con tu propia frase.
3. Elegí cómo entra en **Efectos**.
4. Descargá en **Exportar**: el video con tus subtítulos listo para publicar, o con fondo verde para componerlo en CapCut.

Si preferís que la IA escriba los subtítulos, subí el video en **Video** y usá **Generar subtítulos** (ver más abajo).

Los videos se descargan desde el navegador y también quedan en `exports/`.

## Estilos de subtítulo

**Estilo** es cómo se ve la letra; **movimiento** es cómo entra. Se eligen por separado, así que cualquier look combina con cualquier efecto.

La biblioteca trae 51 estilos en siete grupos —Básicos, Impacto, Neón, Editoriales, Manuscritas, Retro y Tech— sobre 51 tipografías. **Guardar** deja el look actual en *Mis estilos* para reusarlo en todos los videos.

Debajo de la galería, **Ajustar este estilo** (plegado) abre el control fino: relleno plano o degradado, contorno simple o doble, sombra, resplandor, caja y espaciado. La galería sigue siendo el camino principal; esto aparece sólo cuando hace falta correrse del preset.

Un estilo puede combinar:

- **Contorno**, simple o doble (dos trazos de distinto color).
- **Relleno** plano o con **degradado** recortado sobre la letra.
- **Sombra** suave o dura y corrida, que es la que da volumen 3D.
- **Resplandor** tipo neón, independiente de la sombra.
- **Caja** de color detrás del texto, una por renglón.
- **Dos tipografías** en una misma frase: la primera línea con una letra y el resto con otra.

`src/engine/textPaint.ts` traduce todo eso a CSS y explica por qué el contorno externo va por `text-shadow` (una sola pasada de pintura) y los degradados por `drop-shadow` (una pasada por sombra, así que se limitan a contornos finos).

## Tu trabajo se guarda solo

GB Motion guarda el proyecto (textos, capas, tiempos, fondo y formato) en el navegador de forma automática: si cerrás la pestaña y volvés, seguís donde estabas. En el menú **Proyecto** de la barra superior:

- **Abrir proyecto** carga un archivo `.json` guardado antes.
- **Descargar proyecto** guarda el proyecto actual como archivo, para respaldarlo o pasarlo a otra máquina.
- **Empezar de nuevo** borra el proyecto actual (pide confirmación).

Mientras trabajás, la vista previa queda fija a la izquierda al desplazarte por los controles.

## Varios textos independientes

La línea de tiempo permite agregar hasta 400 frases y recuperarlas completas al abrir el proyecto. Cada texto tiene su propia frase, efecto, tipografía, color, posición, delay y palabras destacadas. También se puede ocultar, duplicar o eliminar una capa sin afectar las demás.

## Subtítulos (el guion)

La herramienta **Subtítulos** lista todos los subtítulos en orden de tiempo, uno por fila:

- Tocá el **tiempo** de una fila para saltar a ese subtítulo.
- Corregí el **texto** directo en la fila: se conservan los tiempos de las palabras que no tocaste.
- **Unir con la siguiente** junta dos subtítulos consecutivos; el tacho elimina uno.
- **Buscar y reemplazar** cambia el texto en todos los subtítulos desbloqueados a la vez, y se deshace con un solo `Ctrl+Z`.
- Ahí mismo están **Guion y subtítulos** (agregar frases desde un guion, importar y descargar SRT / VTT).

### Plantilla para todos

En **Estilo**, **Aplicar plantilla a todos** copia de la frase elegida a todas las desbloqueadas el look, los efectos de entrada, salida y bucle, y el resaltado (modo y color). No toca los textos, los tiempos, las posiciones ni los tamaños, y se deshace con un solo `Ctrl+Z`.

## Línea de tiempo

Con más de 12 subtítulos la línea de tiempo muestra una **sola pista «Subtítulos»** (con arrastre, estirado, tiradores de entrada y salida y frases bloqueadas que no se mueven); el interruptor **Subtítulos | Pistas** vuelve a una fila por frase, con ocultar, bloquear, duplicar y eliminar. En la pista única sólo se dibujan los clips que caen en la parte visible.

Cada clip dibuja adentro, con rayado, cuánto ocupan su **entrada** y su **salida**, con un tirador en el borde interno de cada una para alargarlas o acortarlas arrastrando —como en CapCut—. El tirador cambia `overrides.duration`; el desfase entre palabras es parte del efecto y no se toca desde ahí. El número queda sincronizado con los deslizadores del panel de movimiento.

El panel controla cuándo aparece cada texto:

- Una barra por capa sobre una regla en segundos, con playhead y contador `mm:ss:ff`.
- La barra de posición (scrubber) mueve el playhead con el mouse o con las flechas del teclado; el contador, el scrubber, el playhead y la vista previa muestran siempre el mismo cuadro. Al mover el playhead el reproductor se pausa y nunca retrocede a un cuadro anterior por un frame viejo de Remotion.
- **Cada barra dura, por defecto, lo que dura su animación** (entrada + pausa para leer + salida). Si subís **Tiempo visible** o aplicás una combinación con salida, la barra y el video crecen solos.
- Arrastrar una barra cambia su inicio; estirar el borde derecho (o escribir un número en **Duración**) fija una duración manual. **Volver a automático** deja que la barra vuelva a seguir a la animación.
- Cada clip se selecciona, se duplica y se elimina desde la propia línea de tiempo.
- Una capa bloqueada no se puede mover, redimensionar ni borrar con Delete.
- `Ctrl+Z` / `Ctrl+Shift+Z` y los botones superiores deshacen y rehacen cambios del proyecto. Dentro de un campo de texto se mantienen los atajos nativos de escritura.
- En ventanas angostas la línea de tiempo tiene su propio scroll horizontal interno: la página nunca se desplaza de lado.

Un texto sólo se dibuja entre `startFrame` y `startFrame + getLayerDuration(layer)`. Dentro de ese rango la animación recibe tiempo local (cuadro global menos `startFrame`), así que su entrada siempre empieza desde su propio cuadro cero. `getLayerDuration` usa `durationFrames` si la persona lo fijó, y si no, la longitud de la animación con un piso de 90 cuadros. La duración total del proyecto es el mayor `startFrame + getLayerDuration` de las capas visibles. El Remotion Player del preview y el Remotion Renderer del export usan las mismas funciones (`getCompositionDuration` / `getLayerDuration`), por lo que el MP4 respeta exactamente los tiempos que se ven en pantalla.

## Movimiento: tres pistas

Igual que CapCut, cada frase tiene tres animaciones independientes:

El panel **Efectos** tiene una pestaña por pista:

- **Entrada** — cómo aparece. Agrupada en Aparecer, Impacto, Zoom, Deslizar, Palabras, Letras, 3D, Desenfoque y Épicos.
- **Salida** — cómo se va. Primero los efectos diseñados para salir (marcados *salida*); después el resto, marcados *al revés*, porque el motor los reproduce invertidos.
- **Bucle** — lo que corre **mientras el texto está en pantalla**: respiración, latido, flotar, ola, balanceo, temblor, pulso, parpadeo, giro, deriva y glitch, con velocidad e intensidad regulables y la opción de desfasarlo por palabra.

El bucle vive en `src/engine/loopMotion.ts` y es función pura del cuadro: no usa estado ni azar, así que el preview y el MP4 calculan exactamente lo mismo.

### Máquina de escribir

`typewriter` sale del motor que ya existía: modo `letters`, un `staggerDelay` que marca el ritmo de tecleo y una animación de un solo cuadro, para que cada letra aparezca de golpe en vez de deslizarse. Las unidades que aún no llegaron a su turno reciben un cuadro negativo, que `interpolatePreset` recorta a cero y las deja en opacidad 0. La variante con cursor usa `variation: 'cursor'`, que dibuja un bloque titilando detrás de la última letra revelada.

Un preset impone su propio modo de animación al aplicarse: «Máquina de escribir» no es máquina de escribir si se anima todo junto. Después se puede cambiar desde **Cómo se anima**.

## Efectos épicos

- **Word Rain**: las palabras caen desde arriba con trayectorias diferentes.
- **Word Sphere**: distribuye las palabras sobre una esfera 3D giratoria.
- **Random Riot**: cada palabra recibe una entrada determinista diferente.
- **Orbit Slam**: las palabras orbitan y chocan en el centro.
- **Glitch Crush**: distorsión digital letra por letra.
- **Meteor Drop**, **Letter Storm** y **Epic Rise** completan la categoría ÉPICOS.

Las variaciones aleatorias utilizan una semilla determinista: el preview y el MP4 exportado muestran el mismo movimiento.

## Fuentes incluidas

51 familias, agrupadas en Sans, Display, Condensadas, Serif, Editoriales, **Manuscritas** y **Mono y tech**. Se sumaron Barlow Condensed, Fraunces, Syne y Shadows Into Light a las 47 anteriores. Los pesos disponibles se muestran según la fuente elegida.

Las fuentes se cargan desde el proyecto tanto en el Player como en el Renderer; no dependen de internet durante el uso. `src/fonts.ts` es el único punto de entrada y `scripts/validate-font-registry.mjs` verifica que cada peso registrado tenga su import y su archivo en disco.

Unos pocos paquetes de fontsource no declaran `"./*.css"` en su mapa de `exports` y sólo resuelven sin extensión; el validador acepta las dos formas.

## Controles disponibles

- Movimiento: efecto de entrada, cuánto se queda, efecto de salida y unidad de animación (todo junto, palabra, letra o línea).
- Tipografía: fuente, tamaño, alineación, mayúsculas y cursiva.
- Pintura: relleno plano o degradado, contornos, sombra, resplandor y caja.
- Keywords: color por palabra sin romper la animación principal.
- El resto de los parámetros del motor (stagger, easing, spring, skew, perspectiva) sigue disponible en los presets y en los proyectos guardados.

## Presets custom y favoritos

Se guardan en `localStorage`, por lo que no requieren cuenta, red ni base de datos. **Save as new preset** captura los keyframes y dinámicas resultantes y los agrega a **MY PRESETS**. Los presets propios se pueden eliminar desde su tarjeta.

## Scripts

- `pnpm dev`: aplicación local con preview y exportación.
- `pnpm build`: verificación TypeScript y build de producción de la interfaz.
- `pnpm remotion:studio`: abre la composición directamente en Remotion Studio.
- `pnpm render:demo`: render de humo usando las props de demo.
- `pnpm test`: todos los validadores (fuentes, motor, editor, subtítulos y servidor).

## Arquitectura

- `src/components`: interfaz y controles.
- `src/engine`: easing, interpolación de keyframes, overrides y **pintura del texto** (`textPaint.ts`).
- `src/presets`: configuraciones de presets; no contienen renderers duplicados.
- `src/remotion`: composición multicapa compartida por Player, Studio y Renderer.
- `src/types`: contrato tipado de animación, texto y formato.
- `server`: servidor local dentro de Vite (subida y servicio de videos, render, transcripción, ffmpeg).
- `src/hooks`: el estado de la app dividido en ganchos (`useProject`, `useGuide`, `useExport`, `useTranscription`).
- `src/styles`: la hoja de estilos dividida en `tokens`, `layout`, `panels`, `controls`, `timeline`, `canvas` y `modal`; `src/styles.css` sólo los importa en ese orden.
- `src/captions`: lógica pura de subtítulos automáticos (agrupar palabras, pasarlas a frases, leer las respuestas de la IA).
- `src/utils`: persistencia local (`storage.ts` para presets/favoritos, `project.ts` para el proyecto).

Para agregar un efecto, sumá un objeto a `src/presets/builtins.ts`; para agregar un look, uno a `src/presets/styles.ts`. El motor soporta múltiples keyframes, animación por texto/palabras/letras/líneas, stagger, variaciones espaciales deterministas y propiedades 2D/3D.

El renderer y el Player consumen exactamente el mismo `CompositionProps`; no existe una implementación separada para el preview.

## Video

**Video** sube un archivo para ver los subtítulos sobre la imagen real, escuchar el audio mientras se ubican las frases, generar subtítulos con IA y exportar el resultado final.

- El video se sube una vez a una carpeta local (ver «Dónde se guardan los videos»). El panel muestra «Subiendo… N%» y después «Video guardado».
- **Sobrevive a una recarga:** el proyecto recuerda el video guardado y lo vuelve a conectar solo.
- El `src` del preview es un blob de la pestaña hasta que se recarga; el render nunca recibe blobs. Para exportar con el video adentro, el servidor arma la URL a partir del id del video (`mediaId`).
- La línea de tiempo se estira para cubrir todo el video, aunque los subtítulos terminen antes.
- El video se recorta con `object-fit: cover` para llenar el formato elegido, igual que en la exportación.

## Exportación

En **Exportar** hay dos caminos:

- **Video con tus subtítulos**: tu video con los subtítulos quemados y el audio original (MP4 H.264, el formato elegido recortado para llenar, a 30 fps). Necesita un video guardado en **Video**; el volumen del audio original se regula ahí mismo. Sale como `gb-motion-burn-<fecha>.mp4`.
- **Video con fondo verde**: sólo los subtítulos sobre `#00ff00` y sin audio, para quitar el verde con chroma en CapCut. Sale como `gb-motion-green-<fecha>.mp4`.
- **MP4 con el fondo elegido**: H.264 con el fondo que hayas puesto.
- **Transparencia (beta)**, sólo en ajustes finos: ProRes 4444 `.mov` con canal alpha real. Los archivos son grandes; usalo sólo si tu editor importa ProRes con alpha.

Los videos se descargan desde el navegador y también quedan en `exports/`. Se renderiza un video a la vez: si pedís otro mientras hay uno en proceso, GB Motion avisa («Ya hay un video en proceso»).

El render corre como un trabajo: `POST /api/render` devuelve un `jobId` y la interfaz hace *polling* de `GET /api/render/:id`, mostrando una barra de progreso real y un botón **Cancelar** (`DELETE /api/render/:id`). `GET /api/exports` lista los últimos videos; el enlace **Videos anteriores** abre esa lista. El checkerboard es sólo ayuda visual del preview y se exporta sobre negro.

La API local sólo acepta pedidos de la propia app (`Origin` ausente o `http://127.0.0.1:4173` / `http://localhost:4173`); cualquier otra web recibe 403. Los tamaños aceptados son los tres de la app (1080×1920, 1920×1080, 1080×1080).

El servidor es el de desarrollo (`pnpm dev`). Si Vite se reinicia durante un render o una transcripción —por ejemplo al editar `vite.config.ts` o `.env.local`— ese trabajo se pierde y la interfaz muestra un error controlado.

## Configuración de la IA (`.env.local`)

Los subtítulos automáticos usan un servicio de transcripción. Las claves se leen sólo del lado del servidor local y nunca llegan al navegador ni a `dist/`.

1. Copiá `.env.example` como `.env.local` (en la carpeta raíz del proyecto, al lado de `package.json`).
2. Agregá la clave que tengas, sin comillas:

   ```
   ELEVENLABS_API_KEY=tu_clave
   GROQ_API_KEY=tu_clave
   ```

   - **ElevenLabs Scribe v2** (recomendado): es el que mejor entiende español y marca el tiempo de cada palabra. Cuesta unos centavos por minuto de audio.
   - **Groq Whisper large-v3** (alternativa): tiene un plan gratuito con tope de 25 MB de audio.
   - Con las dos claves podés elegir el servicio en el panel; `GB_TRANSCRIBE_PROVIDER=elevenlabs` o `groq` fija el predeterminado.
3. **Reiniciá GB Motion** (cerrá la ventana oculta de Node o volvé a abrir `INICIAR_GB_MOTION.cmd`) cada vez que edites `.env.local`: el servidor lee el archivo una sola vez al arrancar.

Para probar todo sin gastar, poné `GB_TRANSCRIBE_MOCK=1`: usa una transcripción de ejemplo (`scripts/fixtures/elevenlabs-es.json`) en vez de llamar a la IA.

### Dónde se guardan los videos

Al subir un video en **Video**, GB Motion guarda una copia en `%LOCALAPPDATA%\gb-motion\media` (fuera de OneDrive, para no sincronizar archivos pesados). Se cambia con `GB_MEDIA_DIR` en `.env.local`. Ahí también quedan las transcripciones ya hechas (`<id>.<servicio>.<idioma>.json`), así que volver a generar los subtítulos del mismo video no vuelve a cobrar.

**«Quitar el video» no borra esa copia:** la limpieza de la carpeta es manual.

## Generar subtítulos

1. En **Video**, subí tu video. Esperá a que diga «Video guardado».
2. En **Subtítulos automáticos** elegí el idioma, cuántas palabras por subtítulo (3 es lo habitual en reels), si querés cortar en pausas y quitar muletillas (eh, mm).
3. Elegí el **resaltado** de la palabra que se dice: color de letra, caja, karaoke (las dichas quedan de color), aparecen al decirse, o crece la palabra activa.
4. Con «Usar el look de la frase seleccionada» los subtítulos heredan el estilo y los efectos de la frase que tengas elegida; si no, usan el look de fábrica.
5. **Reemplazar** borra las frases actuales (conserva las bloqueadas); **Agregar** suma las nuevas. Todo se deshace con un solo `Ctrl+Z`.
6. **Generar subtítulos**. Cada subtítulo es una frase normal del proyecto: se puede retocar, mover, cambiar de estilo o corregir. Al corregir el texto de una frase se conservan los tiempos de las palabras que no tocaste.

Se aceptan hasta 400 frases por proyecto. Si el video da más, subí «Palabras por subtítulo» o acortalo.

El audio se envía al servicio de transcripción; el video nunca sale de tu computadora. Si cancelás después de enviar el audio, el servicio igual puede cobrarlo.

## Estado de las fases

1. React, TypeScript, Remotion Player y texto editable: completo.
2. Motor común y primeros presets: completo.
3. Doce presets iniciales: completo.
4. Controles básicos y avanzados: completo.
5. Presets custom, favoritos y persistencia local: completo.
6. MP4 y green screen mediante Remotion Renderer: completo.
7. Línea de tiempo por capa (inicio y duración, playhead, scrubber, arrastre, undo/redo), responsive con scroll interno, estados de exportación y documentación: completo. Ver `docs/FASE_7.md`.

## Revisión y mejoras posteriores

Ver `docs/REVISION_2026-09-02.md`: duración de clip automática, guardado de proyecto con historial, preview fijo al scrollear, canvas/timeline con noción del cuadro actual, un solo lugar para el movimiento, accesibilidad, export por trabajos con progreso/cancelar y transparencia beta.
