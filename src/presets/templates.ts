import { overridesFor } from '../remotion/defaults';
import type { AnimationSegment, LayerAnimation, MotionPreset, TextLayer, TypographySettings, WordHighlightMode, WordTiming } from '../types/motion';
import { builtInPresets } from './builtins';
import { builtInStylePresets } from './styles';

/**
 * Plantillas con nombre: un look (estilo de `styles.ts`) + entrada/salida
 * (`builtins.ts` / `extraMotion.ts`, ya concatenados en `builtInPresets`) +
 * resaltado por palabra. Se resuelven como `combos.ts`: un id inexistente lanza.
 *
 * Ids de estilo (todos verificados contra `styles.ts`): sub-blanco, imp-anton,
 * sub-caja-lima, sub-blanco-fino, sub-condensado, neon-cian, edi-serif,
 * tech-terminal. Ninguno tuvo que reemplazarse.
 *
 * Movimiento elegido por plantilla (ids de `builtInPresets`):
 *   amarillo-impacto  hard-zoom       -> fade-out
 *   blanco-clasico    pop-in          -> fade-out
 *   pildora-lima      bounce-in       -> zoom-out
 *   minimal-suave     soft-rise       -> fade-out
 *   revelado          word-type       -> sin salida
 *   neon-noche        blur-reveal     -> fade-out
 *   editorial-serif   tracking-focus  -> fade-out
 *   terminal          typewriter-clean -> sin salida
 */

export type TemplateMotion = { in: string; out: string | null; holdFrames: number };
export type TemplateHighlight = { mode: WordHighlightMode; color: string };

export type CaptionTemplate = {
  id: string;
  name: string;
  description: string;
  styleId: string;
  motion: TemplateMotion;
  highlight: TemplateHighlight;
};

export const captionTemplates: CaptionTemplate[] = [
  {
    id: 'amarillo-impacto', name: 'Amarillo impacto',
    description: 'Mayúsculas con peso. La palabra que suena se pinta de amarillo.',
    styleId: 'imp-anton',
    motion: { in: 'hard-zoom', out: 'fade-out', holdFrames: 30 },
    highlight: { mode: 'color', color: '#FFE94A' },
  },
  {
    id: 'blanco-clasico', name: 'Blanco clásico',
    description: 'Blanco y directo. La palabra activa cambia de color.',
    styleId: 'sub-blanco',
    motion: { in: 'pop-in', out: 'fade-out', holdFrames: 30 },
    highlight: { mode: 'color', color: '#D6FF4B' },
  },
  {
    id: 'pildora-lima', name: 'Píldora lima',
    description: 'La palabra activa entra en una caja lima.',
    styleId: 'sub-caja-lima',
    motion: { in: 'bounce-in', out: 'zoom-out', holdFrames: 30 },
    highlight: { mode: 'box', color: '#D6FF4B' },
  },
  {
    id: 'minimal-suave', name: 'Minimal suave',
    description: 'Trazo fino. La frase se completa como karaoke.',
    styleId: 'sub-blanco-fino',
    motion: { in: 'soft-rise', out: 'fade-out', holdFrames: 36 },
    highlight: { mode: 'karaoke', color: '#FFE94A' },
  },
  {
    id: 'revelado', name: 'Revelado palabra a palabra',
    description: 'Cada palabra aparece cuando se dice.',
    styleId: 'sub-condensado',
    motion: { in: 'word-type', out: null, holdFrames: 30 },
    highlight: { mode: 'reveal', color: '#FFFFFF' },
  },
  {
    id: 'neon-noche', name: 'Neón noche',
    description: 'Tonos neón para fondos oscuros.',
    styleId: 'neon-cian',
    motion: { in: 'blur-reveal', out: 'fade-out', holdFrames: 36 },
    highlight: { mode: 'color', color: '#FF4FD8' },
  },
  {
    id: 'editorial-serif', name: 'Editorial serif',
    description: 'Serif con karaoke, para un tono más pausado.',
    styleId: 'edi-serif',
    motion: { in: 'tracking-focus', out: 'fade-out', holdFrames: 42 },
    highlight: { mode: 'karaoke', color: '#FFE94A' },
  },
  {
    id: 'terminal', name: 'Terminal',
    description: 'Letra de máquina. Las palabras aparecen una por una.',
    styleId: 'tech-terminal',
    motion: { in: 'typewriter-clean', out: null, holdFrames: 30 },
    highlight: { mode: 'reveal', color: '#7CFF9B' },
  },
];

/** Plantillas que el hero de la landing ofrece como chips (las 8 menos `revelado` y `terminal`). */
export const heroTemplateIds: string[] = [
  'amarillo-impacto', 'blanco-clasico', 'pildora-lima', 'minimal-suave', 'neon-noche', 'editorial-serif',
];

export const findTemplate = (id: string): CaptionTemplate | undefined => captionTemplates.find((item) => item.id === id);

export const resolveTemplate = (id: string): CaptionTemplate => {
  const found = findTemplate(id);
  if (!found) throw new Error(`La plantilla no existe: ${id}`);
  return found;
};

export const resolveStyleTypography = (styleId: string): TypographySettings => {
  const found = builtInStylePresets.find((item) => item.id === styleId);
  if (!found) throw new Error(`La plantilla apunta a un estilo que no existe: ${styleId}`);
  return structuredClone(found.typography);
};

export const resolveMotionPreset = (id: string): MotionPreset => {
  const found = builtInPresets.find((item) => item.id === id);
  if (!found) throw new Error(`La plantilla apunta a un movimiento que no existe: ${id}`);
  return found;
};

const segmentFor = (id: string): AnimationSegment => {
  const preset = structuredClone(resolveMotionPreset(id));
  return { preset, overrides: overridesFor(preset) };
};

/** Resuelve todos los ids de una plantilla; lanza si alguno no existe. */
export const resolveTemplateParts = (template: CaptionTemplate) => ({
  typography: resolveStyleTypography(template.styleId),
  animationIn: segmentFor(template.motion.in),
  animationOut: template.motion.out ? segmentFor(template.motion.out) : null,
});

/** Valida de una vez que cada plantilla resuelve estilo y movimiento. Devuelve los ids rotos. */
export const brokenTemplateRefs = (): string[] => {
  const broken: string[] = [];
  for (const template of captionTemplates) {
    try { resolveTemplateParts(template); } catch { broken.push(template.id); }
  }
  return broken;
};

export type ApplyTemplateOptions = {
  /** `layer` (default) conserva la pausa de la frase para no cambiar su duración; `template` usa la de la plantilla. */
  hold?: 'layer' | 'template';
};

/**
 * Aplica una plantilla a una frase sin mutarla. Copia tipografía (conserva
 * `fontSize`), entrada/salida y, si la frase ya tiene `wordTiming`, modo y color
 * del resaltado. No toca texto, inicio, duración, posición ni inicios de palabra.
 */
export const applyTemplate = (layer: TextLayer, template: CaptionTemplate, options: ApplyTemplateOptions = {}): TextLayer => {
  const parts = resolveTemplateParts(template);
  const ownHold = layer.animation?.holdFrames;
  const holdFrames = options.hold === 'template' || ownHold === undefined ? template.motion.holdFrames : ownHold;
  const animation: LayerAnimation = { in: parts.animationIn, holdFrames, out: parts.animationOut, loop: null };
  return {
    ...layer,
    typography: { ...parts.typography, fontSize: layer.typography.fontSize },
    preset: structuredClone(parts.animationIn.preset),
    overrides: { ...parts.animationIn.overrides },
    animation,
    wordTiming: layer.wordTiming
      ? { ...layer.wordTiming, mode: template.highlight.mode, color: template.highlight.color }
      : layer.wordTiming,
  };
};

/** Aplica la plantilla a todas las frases desbloqueadas (puro; el llamador registra el historial). */
export const applyTemplateToLayers = (layers: TextLayer[], template: CaptionTemplate, options?: ApplyTemplateOptions): TextLayer[] =>
  layers.map((layer) => (layer.locked ? layer : applyTemplate(layer, template, options)));

/** Reparte las palabras de `text` en partes iguales sobre `totalFrames` (frames locales de la frase). */
export const evenWordTiming = (text: string, totalFrames: number, highlight: TemplateHighlight): WordTiming => {
  const words = text.split(/\s+/).filter(Boolean);
  const span = Math.max(1, totalFrames) / Math.max(1, words.length);
  return {
    mode: highlight.mode,
    color: highlight.color,
    words: words.map((word, index) => ({ word, start: Math.round(index * span), end: Math.round((index + 1) * span) })),
  };
};
