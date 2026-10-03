# GB Motion

Aplicación local para crear kinetic typography y motion captions reutilizables. El preview usa Remotion Player en tiempo real; la exportación usa Remotion Renderer y guarda los MP4 en `exports/`.

## La interfaz

Una sola pantalla, sin scroll de página. Cuatro zonas fijas:

- **Columna izquierda** — qué querés cambiar: Estilo, Movimiento, Texto, Video, Salida.
- **Centro** — el video, siempre visible. Se arrastra, se gira y se redimensiona directamente sobre el lienzo.
- **Derecha** — las opciones de la herramienta elegida. Scrollea por dentro.
- **Abajo** — la línea de tiempo: cuándo aparece cada frase.

El botón de deslizadores en la barra superior abre los **ajustes finos** (guardar presets propios y exportar con transparencia). Todos los tiempos se muestran en segundos, no en cuadros.

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
3. Elegí cómo entra en **Movimiento**.
4. Descargá en **Salida** con fondo verde y armá el timing en CapCut.

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

GB Motion guarda el proyecto (textos, capas, tiempos, fondo y formato) en el navegador de forma automática: si cerrás la pestaña y volvés, seguís donde estabas. En la barra superior:

- **📂 Abrir proyecto** carga un archivo `.json` guardado antes.
- **💾 Descargar proyecto** guarda el proyecto actual como archivo, para respaldarlo o pasarlo a otra máquina.
- **Empezar de nuevo** borra el proyecto actual (pide confirmación).

Mientras trabajás, la vista previa queda fija a la izquierda al desplazarte por los controles.

## Varios textos independientes

La línea de tiempo permite agregar hasta 120 frases y recuperarlas completas al abrir el proyecto. Cada texto tiene su propia frase, efecto, tipografía, color, posición, delay y palabras destacadas. También se puede ocultar, duplicar o eliminar una capa sin afectar las demás.

## Línea de tiempo

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

El panel **Movimiento** tiene una pestaña por pista:

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

## Arquitectura

- `src/components`: interfaz y controles.
- `src/engine`: easing, interpolación de keyframes, overrides y **pintura del texto** (`textPaint.ts`).
- `src/presets`: configuraciones de presets; no contienen renderers duplicados.
- `src/remotion`: composición multicapa compartida por Player, Studio y Renderer.
- `src/types`: contrato tipado de animación, texto y formato.
- `src/utils`: persistencia local (`storage.ts` para presets/favoritos, `project.ts` para el proyecto).

Para agregar un efecto, sumá un objeto a `src/presets/builtins.ts`; para agregar un look, uno a `src/presets/styles.ts`. El motor soporta múltiples keyframes, animación por texto/palabras/letras/líneas, stagger, variaciones espaciales deterministas y propiedades 2D/3D.

El renderer y el Player consumen exactamente el mismo `CompositionProps`; no existe una implementación separada para el preview.

## Video de guía

**Video** permite cargar un archivo local para ver los subtítulos sobre la imagen real y, sobre todo, escuchar el audio mientras se ubican las frases.

Es material de trabajo, no parte del resultado:

- Vive sólo en la sesión. El `src` es un blob del navegador, así que no sobrevive a una recarga ni se guarda con el proyecto.
- **Nunca se exporta.** `exportVideo` saca `guide` de las props antes de mandar el trabajo de render: el proceso de Remotion no puede abrir un blob de la pestaña, y el MP4 tiene que salir limpio sobre verde para componerlo en CapCut.
- La línea de tiempo se estira para cubrir todo el video, aunque los subtítulos terminen antes.
- El video se recorta con `object-fit: cover` para llenar el formato elegido, igual que va a pasar en el editor.

## Exportación

- **Descargar MP4**: H.264 con el fondo elegido.
- **Video con fondo verde**: MP4 con fondo `#00ff00` para chroma key en CapCut. Camino recomendado y estable.
- **Transparencia (beta)**, sólo en modo avanzado: ProRes 4444 `.mov` con canal alpha real. Los archivos son grandes; usalo sólo si tu editor importa ProRes con alpha.

El render corre como un trabajo: `POST /api/render` devuelve un `jobId` y la interfaz hace *polling* de `GET /api/render/:id`, mostrando una barra de progreso real y un botón **Cancelar** (`DELETE /api/render/:id`). `GET /api/exports` lista los últimos videos; el enlace **Videos anteriores** abre esa lista. El checkerboard es sólo ayuda visual del preview y se exporta sobre negro.

El servidor de export es de desarrollo (`pnpm dev`). Si Vite se reinicia durante un render —por ejemplo al editar `vite.config.ts`— ese render se pierde y la interfaz muestra un error controlado.

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
