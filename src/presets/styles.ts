import type { SecondaryLineStyle, StyleCategory, TextFill, TextStylePreset, TypographySettings } from '../types/motion';
import { fontById, fontStack } from '../typography/fontRegistry';

/**
 * Biblioteca de looks de subtítulo.
 *
 * Un estilo es **cómo se ve** la letra: fuente, relleno, contorno, sombra,
 * neón, caja. No incluye movimiento — eso vive en `presets/builtins.ts` y se
 * elige aparte, para poder combinar cualquier look con cualquier entrada.
 *
 * Los tamaños están pensados sobre un lienzo de 1080×1920 con `fontSize` 150.
 * `scalePaint` los reescala cuando la letra cambia de tamaño, así un contorno
 * de 7px se sigue viendo igual de grueso en proporción.
 */

const family = (id: string) => fontStack(fontById(id));

const base: TypographySettings = {
  fontFamily: family('inter'),
  fontSize: 150,
  fontWeight: 900,
  italic: false,
  uppercase: true,
  color: '#ffffff',
  letterSpacing: -2,
  wordSpacing: 0,
  lineHeight: 0.95,
  textAlign: 'center',
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: '#000000',
  shadowBlur: 14,
  shadowOpacity: 0.35,
  shadowX: 0,
  shadowY: 6,
  fill: { type: 'solid', color: '#ffffff' },
  strokes: [],
  glow: null,
  box: null,
  secondary: null,
};

const solid = (color: string): TextFill => ({ type: 'solid', color });

const gradient = (angle: number, ...colors: string[]): TextFill => ({
  type: 'gradient',
  angle,
  stops: colors.map((color, index) => ({ color, at: colors.length === 1 ? 0 : index / (colors.length - 1) })),
});

/** Los looks planos y los de caja se ensucian con una sombra suelta. */
const noShadow = { shadowOpacity: 0, shadowBlur: 0, shadowX: 0, shadowY: 0 } as const;

const secondaryLine = (fontId: string, patch: Partial<SecondaryLineStyle> = {}): SecondaryLineStyle => ({
  fontFamily: family(fontId),
  fontSizeScale: 0.62,
  fontWeight: 400,
  italic: true,
  uppercase: false,
  letterSpacing: 0,
  fill: solid('#ffffff'),
  strokes: [],
  ...patch,
});

const style = (
  id: string,
  name: string,
  category: StyleCategory,
  description: string,
  sample: string,
  patch: Partial<TypographySettings>,
): TextStylePreset => {
  const typography: TypographySettings = { ...base, ...patch };
  const first = typography.strokes?.[0];
  return {
    id,
    name,
    category,
    description,
    sample,
    typography: {
      ...typography,
      // Los campos viejos siguen existiendo: los lee el selector de color y
      // cualquier proyecto guardado antes de la biblioteca de estilos.
      color: typography.fill?.type === 'solid' ? typography.fill.color : typography.color,
      strokeColor: first?.color ?? '#000000',
      strokeWidth: first?.width ?? 0,
    },
  };
};

export const styleCategoryLabels: Record<StyleCategory, string> = {
  basicos: 'Básicos',
  impacto: 'Impacto',
  neon: 'Neón',
  editorial: 'Editoriales',
  retro: 'Retro',
  manuscritas: 'Manuscritas',
  tech: 'Tech',
  mios: 'Mis estilos',
};

export const styleCategoryOrder: StyleCategory[] = ['basicos', 'impacto', 'neon', 'editorial', 'manuscritas', 'retro', 'tech', 'mios'];

export const builtInStylePresets: TextStylePreset[] = [
  /* ------------------------------- BÁSICOS ------------------------------- */
  style('sub-blanco', 'Blanco clásico', 'basicos',
    'El subtítulo de siempre: blanco con contorno negro. Se lee sobre cualquier video.',
    'ASÍ SE LEE SIEMPRE', {
      fontFamily: family('inter'), fontWeight: 900, fontSize: 132, letterSpacing: -3, lineHeight: 1.02,
      fill: solid('#ffffff'), strokes: [{ color: '#000000', width: 7 }],
      shadowBlur: 16, shadowOpacity: 0.4, shadowY: 6,
    }),

  style('sub-blanco-fino', 'Blanco suave', 'basicos',
    'Más liviano y en minúsculas, para frases largas.',
    'para frases más largas', {
      fontFamily: family('dm-sans'), fontWeight: 700, fontSize: 122, uppercase: false,
      letterSpacing: -1, lineHeight: 1.12,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 4 }],
      shadowBlur: 18, shadowOpacity: 0.45, shadowY: 5,
    }),

  style('sub-amarillo', 'Amarillo', 'basicos',
    'El clásico amarillo con contorno negro. Destaca sobre fondos oscuros.',
    'MIRÁ ESTO', {
      fontFamily: family('inter'), fontWeight: 900, fontSize: 134, letterSpacing: -3, lineHeight: 1.02,
      fill: solid('#FFE94A'), strokes: [{ color: '#000000', width: 7 }],
      shadowBlur: 14, shadowOpacity: 0.4, shadowY: 6,
    }),

  style('sub-condensado', 'Condensado', 'basicos',
    'Ocupa poco ancho y conserva presencia. Sirve para frases de muchas palabras.',
    'ENTRA TODO EN UNA LÍNEA', {
      fontFamily: family('bebas-neue'), fontWeight: 400, fontSize: 176, letterSpacing: 2, lineHeight: 0.92,
      fill: solid('#ffffff'), strokes: [{ color: '#000000', width: 6 }],
      shadowBlur: 14, shadowOpacity: 0.35, shadowY: 5,
    }),

  style('sub-caja-blanca', 'Caja blanca', 'basicos',
    'Texto oscuro sobre una caja clara. Legible incluso sobre video muy movido.',
    'como subtítulo', {
      fontFamily: family('space-grotesk'), fontWeight: 700, fontSize: 104, uppercase: false,
      letterSpacing: -1, lineHeight: 1.72,
      fill: solid('#0B0D10'), strokes: [], ...noShadow,
      box: { color: '#ffffff', paddingX: 26, paddingY: 10, radius: 12 },
    }),

  style('sub-caja-lima', 'Caja lima', 'basicos',
    'Igual que la caja blanca pero con color de marca.',
    'destacado', {
      fontFamily: family('space-grotesk'), fontWeight: 700, fontSize: 104, uppercase: false,
      letterSpacing: -1, lineHeight: 1.72,
      fill: solid('#0B0D10'), strokes: [], ...noShadow,
      box: { color: '#D6FF4B', paddingX: 26, paddingY: 10, radius: 12 },
    }),

  /* ------------------------------- IMPACTO ------------------------------- */
  style('imp-anton', 'Anton contorno', 'impacto',
    'Grueso, apretado y con contorno pesado. El titular de gancho.',
    'NADIE TE LO DIJO', {
      fontFamily: family('anton'), fontWeight: 400, fontSize: 168, letterSpacing: 0, lineHeight: 0.9,
      fill: solid('#ffffff'), strokes: [{ color: '#000000', width: 9 }],
      shadowBlur: 18, shadowOpacity: 0.45, shadowY: 8,
    }),

  style('imp-doble', 'Doble contorno', 'impacto',
    'Contorno negro pegado a la letra y un segundo contorno de color por fuera.',
    'ESTO CAMBIA TODO', {
      fontFamily: family('anton'), fontWeight: 400, fontSize: 160, letterSpacing: 0, lineHeight: 0.92,
      fill: solid('#ffffff'),
      strokes: [{ color: '#0B0D10', width: 5 }, { color: '#D6FF4B', width: 9 }],
      shadowBlur: 20, shadowOpacity: 0.5, shadowY: 8,
    }),

  style('imp-doble-rojo', 'Doble rojo', 'impacto',
    'El mismo doble contorno con acento rojo. Funciona para advertencias y remates.',
    'PARÁ UN SEGUNDO', {
      fontFamily: family('archivo-black'), fontWeight: 400, fontSize: 146, letterSpacing: -2, lineHeight: 0.98,
      fill: solid('#ffffff'),
      strokes: [{ color: '#0B0D10', width: 5 }, { color: '#FF2D1F', width: 9 }],
      shadowBlur: 20, shadowOpacity: 0.5, shadowY: 8,
    }),

  style('imp-3d-rojo', 'Sombra 3D', 'impacto',
    'Sombra dura corrida, sin desenfoque. Es el volumen de los títulos retro.',
    'IMPACTO', {
      fontFamily: family('bebas-neue'), fontWeight: 400, fontSize: 182, letterSpacing: 2, lineHeight: 0.9,
      fill: solid('#FFE94A'), strokes: [],
      shadowColor: '#C2113B', shadowBlur: 0, shadowOpacity: 1, shadowX: 7, shadowY: 7,
    }),

  style('imp-3d-negro', 'Bloque 3D', 'impacto',
    'Blanco con sombra negra dura. Muy legible y con peso.',
    'CRECER', {
      fontFamily: family('archivo-black'), fontWeight: 400, fontSize: 152, letterSpacing: -2, lineHeight: 0.96,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 4 }],
      shadowColor: '#0B0D10', shadowBlur: 0, shadowOpacity: 1, shadowX: 8, shadowY: 8,
    }),

  style('imp-rojo', 'Rojo pleno', 'impacto',
    'Rojo sólido con contorno negro. El color que más frena el scroll.',
    'ERROR', {
      fontFamily: family('archivo-black'), fontWeight: 400, fontSize: 152, letterSpacing: -2, lineHeight: 0.96,
      fill: solid('#FF3B30'), strokes: [{ color: '#0B0D10', width: 7 }],
      shadowBlur: 18, shadowOpacity: 0.5, shadowY: 8,
    }),

  style('imp-lima', 'Lima', 'impacto',
    'Verde lima sobre contorno negro. Se despega de cualquier fondo.',
    'PLATA FÁCIL', {
      fontFamily: family('anton'), fontWeight: 400, fontSize: 164, letterSpacing: 0, lineHeight: 0.9,
      fill: solid('#D6FF4B'), strokes: [{ color: '#0B0D10', width: 8 }],
      shadowBlur: 18, shadowOpacity: 0.45, shadowY: 8,
    }),

  style('imp-contorno', 'Solo contorno', 'impacto',
    'Letra vacía, apenas el trazo. Deja ver el video por dentro del texto.',
    'FUTURO', {
      fontFamily: family('oswald'), fontWeight: 700, fontSize: 158, letterSpacing: 1, lineHeight: 0.98,
      fill: solid('transparent'), strokes: [{ color: '#ffffff', width: 3 }],
      shadowBlur: 16, shadowOpacity: 0.5, shadowY: 4,
    }),

  /* -------------------------------- NEÓN --------------------------------- */
  style('neon-rojo', 'Neón rojo', 'neon',
    'Itálica con resplandor rojo y filo blanco. El look de la referencia de CapCut.',
    'Demoras media hora', {
      fontFamily: family('playfair-display'), fontWeight: 900, fontSize: 140, italic: true, uppercase: false,
      letterSpacing: -1, lineHeight: 1,
      fill: solid('#FF2D1F'), strokes: [{ color: '#ffffff', width: 2.5 }],
      glow: { color: '#FF2D1F', radius: 9, intensity: 3 },
      ...noShadow,
    }),

  style('neon-cian', 'Neón cian', 'neon',
    'Resplandor frío. Va bien con contenido de tecnología.',
    'EL FUTURO', {
      fontFamily: family('space-grotesk'), fontWeight: 700, fontSize: 140, letterSpacing: -2, lineHeight: 0.98,
      fill: solid('#9BF6FF'), strokes: [{ color: '#062733', width: 2 }],
      glow: { color: '#3FD8FF', radius: 10, intensity: 3 },
      ...noShadow,
    }),

  style('neon-magenta', 'Neón magenta', 'neon',
    'Rosa eléctrico con halo. Alto contraste sobre fondos oscuros.',
    'SIN FILTRO', {
      fontFamily: family('league-spartan'), fontWeight: 800, fontSize: 150, letterSpacing: -2, lineHeight: 0.94,
      fill: solid('#FF7BE5'), strokes: [{ color: '#2A0621', width: 2 }],
      glow: { color: '#FF2DBE', radius: 10, intensity: 3 },
      ...noShadow,
    }),

  style('neon-verde', 'Neón verde', 'neon',
    'Verde de pantalla encendida. Sirve para números y datos.',
    'EN VIVO', {
      fontFamily: family('sora'), fontWeight: 800, fontSize: 138, letterSpacing: -2, lineHeight: 0.98,
      fill: solid('#8DFFC0'), strokes: [{ color: '#052718', width: 2 }],
      glow: { color: '#2BFF88', radius: 10, intensity: 3 },
      ...noShadow,
    }),

  style('neon-contorno', 'Contorno neón', 'neon',
    'Solo el trazo, encendido. Muy limpio sobre video oscuro.',
    'ENERGÍA', {
      fontFamily: family('oswald'), fontWeight: 600, fontSize: 156, letterSpacing: 2, lineHeight: 0.98,
      fill: solid('transparent'), strokes: [{ color: '#7DF9FF', width: 2.5 }],
      glow: { color: '#3FD8FF', radius: 11, intensity: 3 },
      ...noShadow,
    }),

  /* ----------------------------- EDITORIALES ----------------------------- */
  style('edi-serif', 'Serif itálica', 'editorial',
    'Elegante y humana. Para citas, remates y cierres.',
    'lo que nadie te cuenta', {
      fontFamily: family('instrument-serif'), fontWeight: 400, fontSize: 148, italic: true, uppercase: false,
      letterSpacing: 0, lineHeight: 1.04,
      fill: solid('#ffffff'), strokes: [],
      shadowBlur: 22, shadowOpacity: 0.55, shadowY: 6,
    }),

  style('edi-playfair', 'Playfair', 'editorial',
    'Serif con mucho contraste y un filo fino para que se despegue del fondo.',
    'La verdad', {
      fontFamily: family('playfair-display'), fontWeight: 900, fontSize: 144, italic: true, uppercase: false,
      letterSpacing: -1, lineHeight: 1.02,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 2.5 }],
      shadowBlur: 20, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('edi-cormorant', 'Cormorant', 'editorial',
    'Serif liviana en crema. Baja el volumen y sube la elegancia.',
    'con calma', {
      fontFamily: family('cormorant-garamond'), fontWeight: 600, fontSize: 158, italic: true, uppercase: false,
      letterSpacing: 0, lineHeight: 1.06,
      fill: solid('#F6EFE2'), strokes: [],
      shadowBlur: 24, shadowOpacity: 0.55, shadowY: 6,
    }),

  style('edi-dos-fuentes', 'Titular + bajada', 'editorial',
    'Dos tipografías en una frase: la primera línea pesada, el resto en itálica.',
    'DEMORAS\nmedia hora para esto', {
      fontFamily: family('anton'), fontWeight: 400, fontSize: 150, letterSpacing: 0, lineHeight: 1.06,
      fill: solid('#FF3B30'), strokes: [{ color: '#0B0D10', width: 5 }],
      shadowBlur: 18, shadowOpacity: 0.5, shadowY: 6,
      secondary: secondaryLine('instrument-serif', { fontSizeScale: 0.58, fill: solid('#ffffff') }),
    }),

  style('edi-titular-limpio', 'Titular + bajada limpia', 'editorial',
    'Primera línea en bloque y bajada en sans. Para explicar algo en dos tiempos.',
    'ASÍ SE HACE\npaso por paso', {
      fontFamily: family('archivo-black'), fontWeight: 400, fontSize: 138, letterSpacing: -2, lineHeight: 1.1,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 4 }],
      shadowBlur: 18, shadowOpacity: 0.45, shadowY: 6,
      secondary: secondaryLine('dm-sans', { fontSizeScale: 0.5, italic: false, fontWeight: 600, fill: solid('#D6FF4B') }),
    }),

  /* -------------------------------- RETRO -------------------------------- */
  style('ret-dorado', 'Dorado', 'retro',
    'Degradado de oro con filo oscuro. Para plata, premios y remates.',
    'PLATA', {
      fontFamily: family('archivo-black'), fontWeight: 400, fontSize: 150, letterSpacing: -2, lineHeight: 0.98,
      fill: gradient(180, '#FFF6C2', '#FFC53D', '#C9700A'),
      strokes: [{ color: '#2B1400', width: 3 }],
      shadowColor: '#000000', shadowBlur: 12, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('ret-cromo', 'Cromado', 'retro',
    'Metal frío. Queda muy bien en mayúsculas anchas.',
    'ACERO', {
      fontFamily: family('league-spartan'), fontWeight: 800, fontSize: 154, letterSpacing: -1, lineHeight: 0.96,
      fill: gradient(180, '#FFFFFF', '#B9C6D6', '#6E7E93', '#DCE6F2'),
      strokes: [{ color: '#10161F', width: 3 }],
      shadowColor: '#000000', shadowBlur: 12, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('ret-arcoiris', 'Arcoíris', 'retro',
    'Degradado de varios colores sobre la letra, como los títulos de los 90.',
    'COLORES', {
      fontFamily: family('anton'), fontWeight: 400, fontSize: 162, letterSpacing: 0, lineHeight: 0.92,
      fill: gradient(120, '#FF4D4D', '#FFB020', '#4BFF8F', '#3FD8FF', '#B36BFF'),
      strokes: [{ color: '#0B0D10', width: 3 }],
      shadowColor: '#000000', shadowBlur: 14, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('ret-atardecer', 'Atardecer', 'retro',
    'Naranja a rosa. Cálido, para historias personales.',
    'VERANO', {
      fontFamily: family('archivo-black'), fontWeight: 400, fontSize: 150, letterSpacing: -2, lineHeight: 0.98,
      fill: gradient(160, '#FFD36E', '#FF7A45', '#FF3D8B'),
      strokes: [{ color: '#2A0714', width: 3 }],
      shadowColor: '#000000', shadowBlur: 14, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('ret-hielo', 'Hielo', 'retro',
    'Blanco a celeste. Limpio y frío, sin llegar al neón.',
    'FRÍO', {
      fontFamily: family('bebas-neue'), fontWeight: 400, fontSize: 184, letterSpacing: 2, lineHeight: 0.9,
      fill: gradient(180, '#FFFFFF', '#9BF6FF', '#2B6BFF'),
      strokes: [{ color: '#04122B', width: 3 }],
      shadowColor: '#000000', shadowBlur: 14, shadowOpacity: 0.45, shadowY: 6,
    }),

  style('ret-vhs', 'VHS', 'retro',
    'Magenta con sombra cian corrida, como una cinta mal calibrada.',
    'REC', {
      fontFamily: family('space-grotesk'), fontWeight: 700, fontSize: 148, letterSpacing: -2, lineHeight: 0.98,
      fill: solid('#FF3DCE'), strokes: [],
      shadowColor: '#3FD8FF', shadowBlur: 0, shadowOpacity: 0.95, shadowX: -6, shadowY: 5,
    }),

  /* ---------------------------- MANUSCRITAS ----------------------------- */
  style('man-marcador', 'Marcador', 'manuscritas',
    'Como escrito con fibrón sobre la pantalla. Muy directo.',
    'anotá esto', {
      fontFamily: family('permanent-marker'), fontWeight: 400, fontSize: 132, uppercase: false,
      letterSpacing: 0, lineHeight: 1.08,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 5 }],
      shadowBlur: 16, shadowOpacity: 0.45, shadowY: 6,
    }),

  style('man-marcador-amarillo', 'Marcador amarillo', 'manuscritas',
    'El mismo fibrón en amarillo. Se despega de cualquier fondo.',
    'MIRÁ ACÁ', {
      fontFamily: family('permanent-marker'), fontWeight: 400, fontSize: 132, uppercase: false,
      letterSpacing: 0, lineHeight: 1.08,
      fill: solid('#FFE94A'), strokes: [{ color: '#0B0D10', width: 6 }],
      shadowBlur: 14, shadowOpacity: 0.45, shadowY: 6,
    }),

  style('man-cuaderno', 'Cuaderno', 'manuscritas',
    'Letra suelta de cuaderno. Sirve para notas y comentarios al margen.',
    'nota mental', {
      fontFamily: family('caveat'), fontWeight: 700, fontSize: 168, uppercase: false,
      letterSpacing: 0, lineHeight: 1,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 4 }],
      shadowBlur: 18, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('man-firma', 'Firma', 'manuscritas',
    'Script elegante, como una firma. Para cierres y marcas personales.',
    'con vos', {
      fontFamily: family('dancing-script'), fontWeight: 700, fontSize: 158, uppercase: false,
      letterSpacing: 0, lineHeight: 1.06,
      fill: solid('#F6EFE2'), strokes: [],
      shadowBlur: 22, shadowOpacity: 0.55, shadowY: 6,
    }),

  style('man-playero', 'Playero', 'manuscritas',
    'Script redondo y cálido, tipo cartel de verano.',
    'buena onda', {
      fontFamily: family('pacifico'), fontWeight: 400, fontSize: 140, uppercase: false,
      letterSpacing: 0, lineHeight: 1.14,
      fill: solid('#FFE94A'), strokes: [{ color: '#B0400A', width: 5 }],
      shadowColor: '#4A1B00', shadowBlur: 0, shadowOpacity: 0.9, shadowX: 4, shadowY: 5,
    }),

  style('man-tiza', 'Tiza', 'manuscritas',
    'Trazo informal en crema, como escrito con tiza.',
    'paso a paso', {
      fontFamily: family('kalam'), fontWeight: 700, fontSize: 140, uppercase: false,
      letterSpacing: 0, lineHeight: 1.12,
      fill: solid('#F6EFE2'), strokes: [{ color: '#1A1E26', width: 4 }],
      shadowBlur: 20, shadowOpacity: 0.5, shadowY: 5,
    }),

  /* -------------------------------- TECH -------------------------------- */
  style('tech-terminal', 'Terminal', 'tech',
    'Monoespaciada verde. La estética de consola.',
    'npm run build', {
      fontFamily: family('jetbrains-mono'), fontWeight: 700, fontSize: 108, uppercase: false,
      letterSpacing: -1, lineHeight: 1.3,
      fill: solid('#4BFF8F'), strokes: [], ...noShadow,
      glow: { color: '#22D97E', radius: 7, intensity: 2 },
    }),

  style('tech-codigo', 'Código', 'tech',
    'Mono blanca con caja oscura. Se lee perfecto sobre cualquier video.',
    'const x = 1', {
      fontFamily: family('space-mono'), fontWeight: 700, fontSize: 100, uppercase: false,
      letterSpacing: -1, lineHeight: 1.7,
      fill: solid('#E9ECF2'), strokes: [], ...noShadow,
      box: { color: '#12161D', paddingX: 24, paddingY: 12, radius: 8 },
    }),

  style('tech-orbital', 'Orbital', 'tech',
    'Futurista y ancha. Para títulos de tecnología y ciencia ficción.',
    'FUTURO', {
      fontFamily: family('orbitron'), fontWeight: 900, fontSize: 118, letterSpacing: 2, lineHeight: 1.06,
      fill: solid('#9BF6FF'), strokes: [{ color: '#062733', width: 3 }],
      glow: { color: '#3FD8FF', radius: 9, intensity: 3 },
      ...noShadow,
    }),

  style('tech-hud', 'HUD', 'tech',
    'Angulosa, como la interfaz de un videojuego.',
    'NIVEL 2', {
      fontFamily: family('chakra-petch'), fontWeight: 700, fontSize: 138, letterSpacing: 1, lineHeight: 1.02,
      fill: solid('#D6FF4B'), strokes: [{ color: '#0B0D10', width: 5 }],
      shadowColor: '#0B0D10', shadowBlur: 0, shadowOpacity: 1, shadowX: 5, shadowY: 5,
    }),

  /* ----------------------- MÁS IMPACTO Y EDITORIALES -------------------- */
  style('imp-bungee', 'Bloque', 'impacto',
    'Letra de cartel, ancha y maciza. Imposible no leerla.',
    'PARÁ', {
      fontFamily: family('bungee'), fontWeight: 400, fontSize: 128, letterSpacing: 0, lineHeight: 1.08,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 7 }],
      shadowBlur: 18, shadowOpacity: 0.45, shadowY: 7,
    }),

  style('imp-slab', 'Slab pesada', 'impacto',
    'Serif gruesa con mucho cuerpo. Autoridad sin gritar.',
    'LA VERDAD', {
      fontFamily: family('alfa-slab-one'), fontWeight: 400, fontSize: 140, letterSpacing: -1, lineHeight: 1,
      fill: solid('#F6EFE2'), strokes: [{ color: '#2B1400', width: 6 }],
      shadowColor: '#2B1400', shadowBlur: 0, shadowOpacity: 1, shadowX: 5, shadowY: 6,
    }),

  style('imp-cartoon', 'Dibujito', 'impacto',
    'Redonda y simpática, con doble contorno. Para contenido liviano.',
    'DALE', {
      fontFamily: family('luckiest-guy'), fontWeight: 400, fontSize: 148, letterSpacing: 1, lineHeight: 1.02,
      fill: solid('#FFE94A'),
      strokes: [{ color: '#0B0D10', width: 5 }, { color: '#ffffff', width: 9 }],
      shadowBlur: 16, shadowOpacity: 0.45, shadowY: 8,
    }),

  style('imp-titan', 'Globo', 'impacto',
    'Gorda y redondeada, como un globo. Muy amigable.',
    'GRACIAS', {
      fontFamily: family('titan-one'), fontWeight: 400, fontSize: 142, letterSpacing: 0, lineHeight: 1.02,
      fill: solid('#FF7BE5'), strokes: [{ color: '#2A0621', width: 6 }],
      shadowColor: '#2A0621', shadowBlur: 0, shadowOpacity: 1, shadowX: 4, shadowY: 6,
    }),

  style('imp-alto', 'Alto y angosto', 'impacto',
    'Muy condensada y alta. Entra una frase larga sin achicar la letra.',
    'TODO EN UNA LÍNEA', {
      fontFamily: family('big-shoulders-display'), fontWeight: 900, fontSize: 200, letterSpacing: 1, lineHeight: 0.86,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 6 }],
      shadowBlur: 16, shadowOpacity: 0.4, shadowY: 6,
    }),

  style('edi-fatface', 'Fatface', 'editorial',
    'Serif de alto contraste. Elegante pero con peso de titular.',
    'Exclusivo', {
      fontFamily: family('abril-fatface'), fontWeight: 400, fontSize: 150, uppercase: false,
      letterSpacing: -1, lineHeight: 1.02,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 3 }],
      shadowBlur: 20, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('edi-revista', 'Revista', 'editorial',
    'Serif de moda, con mucho contraste entre trazos.',
    'Temporada', {
      fontFamily: family('bodoni-moda'), fontWeight: 900, fontSize: 152, uppercase: false, italic: true,
      letterSpacing: -1, lineHeight: 1.02,
      fill: solid('#F6EFE2'), strokes: [],
      shadowBlur: 24, shadowOpacity: 0.55, shadowY: 6,
    }),

  style('edi-dm-serif', 'Serif titular', 'editorial',
    'Serif limpia para títulos largos. Muy legible en pantalla chica.',
    'Lo que aprendí', {
      fontFamily: family('dm-serif-display'), fontWeight: 400, fontSize: 146, uppercase: false,
      letterSpacing: -1, lineHeight: 1.08,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 3 }],
      shadowBlur: 20, shadowOpacity: 0.5, shadowY: 6,
    }),

  style('sub-moderno', 'Moderno', 'basicos',
    'Sans geométrica y limpia. La alternativa al blanco clásico.',
    'así de simple', {
      fontFamily: family('outfit'), fontWeight: 900, fontSize: 128, uppercase: false,
      letterSpacing: -2, lineHeight: 1.08,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 6 }],
      shadowBlur: 16, shadowOpacity: 0.4, shadowY: 6,
    }),

  style('sub-redondo', 'Redondeado', 'basicos',
    'Sans de esquinas suaves. Amable y muy legible.',
    'tranquilo', {
      fontFamily: family('rubik'), fontWeight: 900, fontSize: 128, uppercase: false,
      letterSpacing: -2, lineHeight: 1.1,
      fill: solid('#ffffff'), strokes: [{ color: '#0B0D10', width: 6 }],
      shadowBlur: 16, shadowOpacity: 0.4, shadowY: 6,
    }),

  style('ret-old-tv', 'Old TV', 'retro',
    'Degradado cian a magenta con filo negro. El título de programa viejo.',
    'EN PANTALLA', {
      fontFamily: family('anton'), fontWeight: 400, fontSize: 160, letterSpacing: 0, lineHeight: 0.92,
      fill: gradient(180, '#7DF9FF', '#B36BFF', '#FF3DCE'),
      strokes: [{ color: '#0B0D10', width: 3 }],
      shadowColor: '#000000', shadowBlur: 14, shadowOpacity: 0.5, shadowY: 6,
    }),
];

export const stylePresetById = (id: string) => builtInStylePresets.find((item) => item.id === id);
