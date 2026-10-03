# GB Motion V2 — Auditoría de base (FASE 0)

Fecha: 30 de agosto de 2026  
Alcance: estado local previo a la evolución V2. Esta fase no cambia el comportamiento de producción.

## Resumen ejecutivo

GB Motion ya tiene una base funcional: la interfaz abre, los 20 presets están disponibles, el proyecto compila con las herramientas locales y se pudieron generar videos H.264 desde la línea de comandos y desde la interfaz. El flujo multicapa, los acentos, la Ñ y los emoji también llegaron al render final.

La base todavía no cumple los criterios de una V2 profesional. Los problemas más importantes son: fuentes con estilos que la interfaz promete pero no existen, interpolación global que genera valores fuera de dominio, separación incorrecta de caracteres Unicode, perspectiva 3D aplicada en el lugar equivocado, validación superficial de presets y render, y una experiencia de exportación bloqueante sin progreso ni cancelación.

## Evidencia de la línea base

### Construcción

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| `pnpm build` con el ejecutable alternativo del lanzador | BLOQUEADO POR ENTORNO | El wrapper intentó eliminar/reinstalar `node_modules` y abortó por falta de TTY: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. No fue un error de TypeScript ni del código. |
| `tsc -b` con el binario local | OK | TypeScript 7.0.2 terminó sin errores. |
| `vite build` con el binario local | OK | Vite 8.2.2 transformó 1856 módulos. Bundle JS principal: 527.24 kB, gzip 164.84 kB. |
| Servidor local | OK | La app respondió en `http://127.0.0.1:4173/`. |
| Consola al cargar y después de un render multicapa | OK | Sin mensajes `warn` ni `error` en la consola del navegador. |
| Pruebas automatizadas | NO DISPONIBLES | `package.json` no define un script `test`. |

### Renders de prueba nuevos

| Archivo | Camino | Resultado comprobado |
| --- | --- | --- |
| Preset base | `exports/v2-audit-depth-punch.mp4` | Render CLI H.264 terminado; 33 frames; 267,288 bytes. |
| Multicapa / texto complejo | `exports/gb-motion-green-1788140217262.mp4` | Exportación verde iniciada desde la UI y descargada correctamente; 897,414 bytes. Incluyó Raleway + Word Rain y Playfair Display + Word Sphere, con `¿EMPEZAR? ÑANDÚ ÜNICO 🚀` y texto multilínea. |

Remotion/Vite informó una advertencia de caché de webpack (`Unable to snapshot resolve dependencies`) durante el render. No impidió la exportación, pero debe investigarse antes de considerar estable la cadena de render.

No se hizo todavía una inspección cuadro por cuadro de los 20 presets ni una validación externa del stream con `ffprobe`; por lo tanto, esos puntos continúan abiertos.

## Inventario actual

### Presets incorporados

Hay 20 identificadores únicos y sin duplicados:

| # | ID | Nombre | Categoría | Unidad | Duración | Stagger | Dinámica |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
| 1 | `depth-punch` | Depth Punch | ZOOM | texto | 18 | 0 | — |
| 2 | `camera-slam` | Camera Slam | IMPACT | texto | 18 | 0 | — |
| 3 | `elastic-pop` | Elastic Pop | IMPACT | texto | 22 | 0 | spring .8, bounce .18 |
| 4 | `hard-zoom` | Hard Zoom | ZOOM | texto | 11 | 0 | — |
| 5 | `diagonal-hit` | Diagonal Hit | SLIDE | texto | 17 | 0 | — |
| 6 | `blur-reveal` | Blur Reveal | BLUR | texto | 22 | 0 | — |
| 7 | `perspective-zoom` | Perspective Zoom | 3D | texto | 21 | 0 | — |
| 8 | `bottom-punch` | Bottom Punch | SLIDE | texto | 18 | 0 | — |
| 9 | `word-cascade` | Word Cascade | WORDS | palabras | 18 | 3 | — |
| 10 | `letter-impact` | Letter Impact | LETTERS | letras | 13 | 1 | spring .55, bounce .12 |
| 11 | `side-swipe` | Side Swipe | SLIDE | texto | 17 | 0 | — |
| 12 | `hero-word` | Hero Word | IMPACT | texto | 20 | 0 | — |
| 13 | `word-rain` | Word Rain | EPIC | palabras | 24 | 3 | rain, spring .65, bounce .18 |
| 14 | `word-sphere` | Word Sphere | 3D | palabras | 28 | 2 | sphere, spring .45, bounce .12 |
| 15 | `random-riot` | Random Riot | EPIC | palabras | 24 | 2 | random, spring .8, bounce .24 |
| 16 | `orbit-slam` | Orbit Slam | 3D | palabras | 25 | 2 | orbit, spring .7, bounce .16 |
| 17 | `glitch-crush` | Glitch Crush | EPIC | letras | 18 | 1 | glitch, spring .55, bounce .12 |
| 18 | `meteor-drop` | Meteor Drop | EPIC | texto | 20 | 0 | spring .7, bounce .2 |
| 19 | `letter-storm` | Letter Storm | LETTERS | letras | 22 | 1 | random, spring .85, bounce .2 |
| 20 | `epic-rise` | Epic Rise | EPIC | líneas | 26 | 5 | spring .5, bounce .1 |

### Fuentes incorporadas

| Familia | Pesos realmente cargados | Itálica cargada | Origen |
| --- | --- | --- | --- |
| Inter | 400, 700, 900 | No | paquete local |
| Roboto | 400, 900 | No | paquete local |
| Montserrat | 400, 900 | No | paquete local |
| Bebas Neue | 400 | No | paquete local |
| Anton | 400 | No | paquete local |
| Oswald | 400, 700 | No | paquete local |
| Poppins | 400, 700, 900 | No | paquete local |
| Lato | 400, 900 | No | paquete local |
| Playfair Display | 400, 700 | No | paquete local |
| Merriweather | 400, 700 | No | paquete local |
| Raleway | 400, 900 | No | paquete local |
| Arial | depende del equipo | depende del equipo | sistema operativo |

Player y Renderer importan el mismo registro actual de archivos de fuente. La consistencia estructural existe para las variantes cargadas, pero el registro no describe capacidades y la UI permite pedir variantes inexistentes.

## CONFIRMED BUGS

1. **El botón de itálica promete una variante que no está cargada.** Todos los `@font-face` locales son `font-style: normal`, mientras el inspector habilita itálica para todas las familias. En una comparación visual con Inter 900, normal e itálica se vieron iguales.
2. **El selector de peso permite valores no soportados.** La UI ofrece de 100 a 900 para cualquier familia aunque, por ejemplo, Anton y Bebas Neue sólo cargan 400. El navegador termina sintetizando o escogiendo la variante más cercana de forma implícita.
3. **La perspectiva 3D no afecta al propio texto como se pretende.** `perspective` está declarada como propiedad CSS en el mismo elemento que recibe `rotateX`/`rotateY`; esa propiedad proyecta a los hijos, no a la transformación del elemento. La cadena `transform` tampoco incluye `perspective(...)`.
4. **La dinámica global produce valores inválidos.** Un muestreo de la fórmula actual detectó opacidad mayor a 1 en `elastic-pop`, `letter-impact`, `word-sphere`, `random-riot` y `letter-storm`; también blur negativo en cuatro de ellos (hasta -2.5554). CSS oculta parte del problema al limitar el blur y el navegador satura la opacidad, pero el motor entrega estados fuera del contrato visual.
5. **El modo letras rompe grafemas Unicode.** `Array.from` divide la familia `👨‍👩‍👧‍👦` en 7 unidades, la bandera `🇦🇷` en 2 y `e` + acento combinante en 2, aunque cada caso debe animarse como un único símbolo visible.
6. **El modo palabras pierde los saltos de línea manuales.** La separación por espacios elimina la estructura de `UNO\nDOS`, por lo que no puede conservar el layout escrito por la persona.
7. **La validación de tamaño del endpoint acepta combinaciones no ofrecidas.** El servidor sólo comprueba que cada lado esté entre 1080 y 1920; por eso un payload 1920×1920 pasa aunque no sea un formato soportado.
8. **Editar el texto borra estilos por palabra.** El `onChange` actual sustituye siempre `keywords` por `{}`, incluso cuando las palabras estilizadas siguen existiendo.
9. **Los controles de favoritos contienen elementos interactivos dentro de otro botón.** Las tarjetas de presets usan un `<button>` exterior y acciones internas con comportamiento de botón. Es HTML interactivo inválido y puede producir foco/activación ambiguos.

El punto 4 fue comprobado con un probe matemático que replica literalmente la fórmula del motor actual y un paso de 0.05 frames; está corroborado por la inspección de `interpolatePreset.ts`, pero todavía debe convertirse en un test unitario contra el módulo real.

## RISKS

- La validación de presets personalizados es superficial: no verifica propiedades numéricas, orden de cuadros, easing, límites ni valores finitos. Datos dañados en `localStorage` pueden llegar al Player y al Renderer.
- El endpoint de render valida sólo una parte mínima del payload, no tiene cola, exclusión mutua ni límite explícito de trabajos simultáneos.
- El receptor del body rechaza por tamaño pero no detiene la lectura del request; conviene cerrar/drenar de forma controlada y garantizar una única resolución.
- La exportación es síncrona desde el punto de vista de la UI. Un render multicapa observado tardó varios minutos sin progreso real ni cancelación.
- Los IDs de capa basados en `Date.now()` pueden colisionar en operaciones muy rápidas.
- Arial no está empaquetada; un render puede cambiar entre equipos o fallar en un entorno sin esa fuente.
- El lanzador depende de una ruta de pnpm incluida con Codex, intenta un fallback global y abre el navegador tras una espera fija de tres segundos. No comprueba readiness ni muestra errores al usuario.
- No hay esquema versionado ni migraciones para presets/proyectos. La futura evolución del modelo puede invalidar datos locales.
- No hay pruebas automatizadas, snapshots del motor ni comparación Player/Renderer.

## UX PROBLEMS

- Los nombres y parámetros del inspector son técnicos y no explican con claridad qué verá una persona no experta.
- No existe una línea de tiempo visual, edición directa sobre el lienzo, deshacer/rehacer ni reordenamiento explícito de capas.
- El selector de fuentes no muestra la fuente real, categorías, favoritos, recientes, búsqueda ni variantes compatibles.
- Las tarjetas de preset sólo animan al pasar el mouse; teclado y pantallas táctiles no reciben una experiencia equivalente.
- Las categorías se presentan como tabs, pero no exponen correctamente `role=tab` y `aria-selected`.
- El modal para guardar presets no tiene semántica de diálogo, trampa de foco ni cierre con Escape.
- La exportación no muestra pasos, porcentaje, tiempo aproximado, cola ni botón Cancelar.
- El lienzo puede recortar textos largos por el ancho fijo y `overflow: hidden`, sin advertencia ni auto-fit.
- No hay indicador de compatibilidad para Chroma, Transparente o video de fondo antes de exportar.

## TECH DEBT

- `App.tsx` concentra estado del proyecto, mutaciones, preset browser, render y exportación.
- `TextComposition.tsx` mezcla segmentación de texto, geometría de modos épicos, interpolación y representación CSS.
- `MotionKeyframe` conserva easing en el keyframe de origen, pero el nombre no expresa claramente `easingToNext`.
- El orden de transformaciones está fijo en una cadena informal, sin una política documentada ni `translateZ`, origen o anclas.
- `spring`, `bounce` y `overshoot` actúan como ajustes globales; no hay separación IN / HOLD / OUT.
- No hay distinción explícita entre Preset de Movimiento y Preset de Estilo.
- El guardado sólo cubre presets; no cubre proyecto, capas, timeline, selección ni preferencias.
- Los modos `rain`, `sphere`, `random`, `orbit` y `glitch` viven como ramas dentro de una única composición, lo cual hará difícil agregar keyframes editables y layout responsive.
- No hay historia de Git inicial en este proyecto: el directorio completo aparece como no rastreado dentro del repositorio padre. Esto dificulta establecer un baseline reversible.

## OPTIONAL IMPROVEMENTS

- Miniaturas animadas precalculadas o previews livianos en vez de montar un Player completo al hacer hover.
- Búsqueda difusa y etiquetas visuales para presets y fuentes.
- Atajos configurables y una guía interactiva de primer proyecto.
- Galería de proyectos de ejemplo con recetas explicadas en lenguaje simple.
- Diagnóstico de rendimiento y estimación del costo de render antes de exportar.
- Reporte técnico descargable con versión, formato, fuentes, presets y advertencias del proyecto.

## Revisión de archivos clave

| Área | Archivos revisados | Conclusión |
| --- | --- | --- |
| Modelo | `src/types/motion.ts` | Insuficiente para timeline, segmentos, anclas, proyectos y validación V2. |
| Motor | `src/engine/easing.ts`, `interpolatePreset.ts`, `resolvePreset.ts` | Funcional pero con dinámica global, valores fuera de dominio y contrato incompleto. |
| Composición | `src/remotion/TextComposition.tsx` | Player/Renderer comparten la misma pieza, pero segmentación, 3D y layout requieren separación. |
| Duración | `src/utils/duration.ts` | No contempla inicio por capa y repite la segmentación defectuosa de letras. |
| Persistencia | `src/utils/storage.ts` | Sólo presets y validación superficial. |
| UI | `App.tsx`, `PresetBrowser.tsx`, `Inspector.tsx`, `RangeControl.tsx`, `SavePresetModal.tsx` | Base usable, pero falta accesibilidad semántica y la arquitectura no escala a V2. |
| Exportación | `vite.config.ts` | Render real operativo; falta contrato robusto, jobs, progreso, cancelación y limpieza. |

## Estado de los release gates de FASE 0

- [x] Inventario de presets y fuentes.
- [x] Compilación equivalente `tsc -b && vite build` sin errores de código.
- [x] Apertura de la app y consola del navegador limpia.
- [x] Render CLI de muestra.
- [x] Render multicapa desde la UI con caracteres complejos.
- [ ] Resolver el comportamiento del wrapper usado por `pnpm build` y el lanzador.
- [ ] Inspección cuadro por cuadro de los 20 presets.
- [ ] Pruebas automatizadas del motor, esquemas y segmentación.
- [ ] Validación técnica externa de los archivos exportados.
- [ ] Auditoría completa responsive, teclado y lector de pantalla.

## Orden de corrección recomendado

1. Crear un registro tipado de fuentes y hacer que la UI sólo ofrezca variantes reales.
2. Formalizar el contrato del motor: valores finitos, límites, easing por tramo, orden de transformaciones y perspectiva correcta.
3. Reemplazar la segmentación por grafemas y conservar saltos de línea.
4. Introducir IN / HOLD / OUT sin romper presets existentes.
5. Separar estilo, movimiento y geometría/layout.
6. Recién entonces construir manipulación directa, timeline, keyframes, proyectos y exportación por jobs.

## Criterio de entrada a FASE 1

La FASE 1 puede comenzar porque la base es ejecutable y existe evidencia de render real. No debe considerarse cerrada hasta que:

- cada fuente tenga un registro único con familia, categoría, pesos, estilos y archivos cargados;
- Player y Renderer consuman exactamente el mismo registro;
- la UI impida combinaciones inexistentes;
- se agreguen variantes display, sans, serif, condensadas y handwriting sin depender de red;
- una prueba automática confirme caracteres acentuados, Ñ, Ü, signos y emoji;
- build, smoke test y render vuelvan a pasar.

