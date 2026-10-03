import type React from 'react';
import type { SecondaryLineStyle, StrokeLayer, TextFill, TypographySettings } from '../types/motion';
import { closestFontWeight, fontFromFamily, fontStack, supportsItalic } from '../typography/fontRegistry';

/**
 * Cómo se pinta un subtítulo.
 *
 * Hay dos formas de dibujar un contorno grueso en la web y sólo una es barata:
 *
 * - `text-shadow` acepta una lista de sombras y las pinta en una sola pasada:
 *   son copias de la misma máscara de glifo, ya rasterizada, pegadas con un
 *   corrimiento. Barato incluso con 40 copias.
 * - `filter: drop-shadow(...)` encadenado hace una pasada de filtro por sombra,
 *   cada una sobre toda la caja del elemento. Caro, y se nota a 30 fps.
 *
 * Y el relleno manda cuál se puede usar:
 *
 * - Relleno plano → `color` normal. `text-shadow` funciona, así que el contorno
 *   externo, la sombra y el neón viajan todos en una sola propiedad, y el
 *   contorno interno lo hace `-webkit-text-stroke`, que es nativo y nítido.
 * - Degradado → se recorta con `background-clip: text` sobre `color:
 *   transparent`, y eso vuelve invisible cualquier `text-shadow`. Ahí no queda
 *   otra que `drop-shadow`, así que el anillo se limita a 12 pasos y los
 *   estilos con degradado llevan contornos finos.
 *
 * Preview y render comparten este módulo, así que el MP4 sale igual a la
 * pantalla: Remotion renderiza en Chromium, el mismo motor del navegador.
 */

export type ResolvedPaint = {
  fill: TextFill;
  strokes: StrokeLayer[];
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
  shadowOpacity: number;
  glow: { color: string; radius: number; intensity: number } | null;
  box: { color: string; paddingX: number; paddingY: number; radius: number } | null;
  secondary: SecondaryLineStyle | null;
};

/** Completa los campos nuevos a partir de los viejos, para proyectos guardados. */
export const normalizeTypography = (t: TypographySettings): ResolvedPaint => ({
  fill: t.fill ?? { type: 'solid', color: t.color },
  strokes: t.strokes ?? (t.strokeWidth > 0 ? [{ color: t.strokeColor, width: t.strokeWidth }] : []),
  shadowX: t.shadowX ?? 0,
  shadowY: t.shadowY ?? 5,
  shadowBlur: t.shadowBlur,
  shadowColor: t.shadowColor,
  shadowOpacity: t.shadowOpacity,
  glow: t.glow ?? null,
  box: t.box ?? null,
  secondary: t.secondary ?? null,
});

const alpha = (color: string, opacity: number) => opacity >= 1
  ? color
  : `color-mix(in srgb, ${color} ${Math.round(Math.max(0, Math.min(1, opacity)) * 100)}%, transparent)`;

/**
 * Posiciones de un anillo de contorno.
 *
 * La cantidad de pasos tiene que crecer con el radio: son copias de la letra
 * corridas, y si quedan muy separadas el borde sale festoneado. Un paso cada
 * ~1,2px de perímetro se ve liso. Los dos techos son distintos a propósito:
 * `text-shadow` pinta las N sombras en una sola pasada y aguanta 40, mientras
 * que cada `drop-shadow` es una pasada propia y a partir de ~16 el render se
 * arrastra.
 */
const ringOffsets = (width: number, maxSteps: number) => {
  const steps = Math.max(8, Math.min(maxSteps, Math.ceil(width * 5)));
  const points: Array<[string, string]> = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    points.push([(Math.cos(angle) * width).toFixed(2), (Math.sin(angle) * width).toFixed(2)]);
  }
  return points;
};

const SHADOW_RING_STEPS = 40;
const FILTER_RING_STEPS = 12;

const isGradient = (paint: ResolvedPaint) => paint.fill.type === 'gradient';

/** El primer contorno lo dibuja el navegador; sólo con relleno plano. */
const nativeStroke = (paint: ResolvedPaint) => isGradient(paint) ? undefined : paint.strokes[0];

const hasShadow = (paint: ResolvedPaint) => paint.shadowOpacity > 0
  && (paint.shadowBlur > 0 || paint.shadowX !== 0 || paint.shadowY !== 0);

const glowLayers = (paint: ResolvedPaint) => {
  if (!paint.glow || paint.glow.radius <= 0 || paint.glow.intensity <= 0) return [];
  const count = Math.max(1, Math.min(4, Math.round(paint.glow.intensity)));
  return Array.from({ length: count }, (_, index) => ({
    radius: paint.glow!.radius * (index + 1) * 0.75,
    color: paint.glow!.color,
  }));
};

/**
 * Contorno externo, sombra y neón en una sola pasada. Sólo para relleno plano.
 * Devuelve `undefined` cuando no hay nada que pintar, para no ensuciar el CSS.
 */
export const paintTextShadow = (paint: ResolvedPaint): string | undefined => {
  if (isGradient(paint)) return undefined;
  const shadows: string[] = [];

  // El primero ya lo dibuja -webkit-text-stroke; acá van los de afuera.
  paint.strokes.slice(1).forEach((stroke) => {
    ringOffsets(stroke.width, SHADOW_RING_STEPS).forEach(([x, y]) => shadows.push(`${x}px ${y}px 0 ${stroke.color}`));
  });
  if (hasShadow(paint)) {
    shadows.push(`${paint.shadowX}px ${paint.shadowY}px ${paint.shadowBlur}px ${alpha(paint.shadowColor, paint.shadowOpacity)}`);
  }
  glowLayers(paint).forEach((layer) => shadows.push(`0 0 ${layer.radius.toFixed(1)}px ${layer.color}`));

  return shadows.length > 0 ? shadows.join(', ') : undefined;
};

/**
 * Lo mismo pero con filtros, para degradados, donde `text-shadow` no se ve.
 * Dibuja un solo contorno para que la cadena no pase de ~16 pasadas.
 */
export const paintFilter = (paint: ResolvedPaint): string | undefined => {
  if (!isGradient(paint)) return undefined;
  const parts: string[] = [];

  const outline = paint.strokes[0];
  if (outline && outline.width > 0) {
    ringOffsets(outline.width, FILTER_RING_STEPS).forEach(([x, y]) => parts.push(`drop-shadow(${x}px ${y}px 0 ${outline.color})`));
  }
  if (hasShadow(paint)) {
    parts.push(`drop-shadow(${paint.shadowX}px ${paint.shadowY}px ${paint.shadowBlur}px ${alpha(paint.shadowColor, paint.shadowOpacity)})`);
  }
  glowLayers(paint).forEach((layer) => parts.push(`drop-shadow(0 0 ${layer.radius.toFixed(1)}px ${layer.color})`));

  return parts.length > 0 ? parts.join(' ') : undefined;
};

/** Relleno y contorno interno. */
export const paintFillCss = (paint: ResolvedPaint): React.CSSProperties => {
  if (paint.fill.type === 'gradient') {
    const stops = [...paint.fill.stops]
      .sort((a, b) => a.at - b.at)
      .map((stop) => `${stop.color} ${Math.round(stop.at * 100)}%`)
      .join(', ');
    return {
      backgroundImage: `linear-gradient(${paint.fill.angle}deg, ${stops})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      // Sin esto el degradado se estira por todo el bloque y cada línea corta
      // queda de un color plano distinto.
      WebkitBoxDecorationBreak: 'clone',
      boxDecorationBreak: 'clone',
    };
  }
  const native = nativeStroke(paint);
  return {
    color: paint.fill.color,
    ...(native && native.width > 0
      ? { WebkitTextStroke: `${native.width}px ${native.color}`, paintOrder: 'stroke fill' as const }
      : { WebkitTextStroke: '0px transparent' }),
  };
};

/** Todo el look junto: relleno, contorno, sombra y neón. */
export const paintCss = (paint: ResolvedPaint): React.CSSProperties => ({
  ...paintFillCss(paint),
  textShadow: paintTextShadow(paint),
  filter: paintFilter(paint),
});

/** Caja de color detrás del texto. Se aplica a los tramos, no al bloque. */
export const paintBoxCss = (paint: ResolvedPaint): React.CSSProperties => paint.box
  ? {
    backgroundColor: paint.box.color,
    padding: `${paint.box.paddingY}px ${paint.box.paddingX}px`,
    borderRadius: `${paint.box.radius}px`,
    WebkitBoxDecorationBreak: 'clone',
    boxDecorationBreak: 'clone',
  }
  : {};

/** Escala los tamaños en píxeles del look al tamaño real de la letra. */
export const scalePaint = (paint: ResolvedPaint, factor: number): ResolvedPaint => factor === 1 ? paint : {
  ...paint,
  strokes: paint.strokes.map((stroke) => ({ ...stroke, width: stroke.width * factor })),
  shadowX: paint.shadowX * factor,
  shadowY: paint.shadowY * factor,
  shadowBlur: paint.shadowBlur * factor,
  glow: paint.glow ? { ...paint.glow, radius: paint.glow.radius * factor } : null,
  box: paint.box
    ? { ...paint.box, paddingX: paint.box.paddingX * factor, paddingY: paint.box.paddingY * factor, radius: paint.box.radius * factor }
    : null,
};

/** Tipografía de las líneas 2 en adelante cuando el estilo usa dos fuentes. */
export const secondaryCss = (secondary: SecondaryLineStyle, factor = 1): React.CSSProperties => {
  const font = fontFromFamily(secondary.fontFamily);
  const paint = scalePaint({
    fill: secondary.fill,
    strokes: secondary.strokes,
    shadowX: 0, shadowY: 0, shadowBlur: 0, shadowColor: '#000000', shadowOpacity: 0,
    glow: null, box: null, secondary: null,
  }, factor);
  return {
    fontFamily: fontStack(font),
    fontSize: `${secondary.fontSizeScale}em`,
    fontWeight: closestFontWeight(font, secondary.fontWeight),
    fontStyle: secondary.italic && supportsItalic(font) ? 'italic' : 'normal',
    textTransform: secondary.uppercase ? 'uppercase' : 'none',
    letterSpacing: `${secondary.letterSpacing * factor}px`,
    ...paintCss(paint),
  };
};

/**
 * CSS de una miniatura de estilo, sin animación. Lo usa la galería para dibujar
 * cada tarjeta con el texto real de la persona en vez de un ejemplo genérico.
 */
export const previewCss = (typography: TypographySettings, fontSize: number): React.CSSProperties => {
  const font = fontFromFamily(typography.fontFamily);
  const factor = fontSize / Math.max(1, typography.fontSize);
  const paint = scalePaint(normalizeTypography(typography), factor);
  return {
    fontFamily: fontStack(font),
    fontSize,
    fontWeight: closestFontWeight(font, typography.fontWeight),
    fontStyle: typography.italic && supportsItalic(font) ? 'italic' : 'normal',
    textTransform: typography.uppercase ? 'uppercase' : 'none',
    letterSpacing: typography.letterSpacing * factor,
    lineHeight: typography.lineHeight,
    textAlign: 'center',
    ...paintCss(paint),
  };
};
