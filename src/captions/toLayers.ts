import type { TextLayer, WordTiming } from '../types/motion.ts';
import type { CaptionPage } from './types.ts';

const FPS = 30;
const toFrame = (ms: number) => Math.round(ms * FPS / 1000);
/** Si el siguiente subtítulo arranca en menos de esto, éste se alarga hasta ahí. */
const JOIN_GAP_MS = 250;
const TAIL_MS = 200;

const nameFor = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 4).join(' ') || 'Frase vacía';

/** Tiempos por palabra pegados uno con otro: cada palabra termina cuando empieza la siguiente. */
const contiguousTiming = (page: CaptionPage, startFrame: number, duration: number, template: WordTiming | undefined): WordTiming => {
  const count = page.words.length;
  const starts = page.words.map((word) => Math.max(0, toFrame(word.startMs) - startFrame));
  starts[0] = 0;
  for (let i = 1; i < count; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 1);
  for (let i = count - 1; i >= 0; i--) starts[i] = Math.min(starts[i], duration - (count - i));
  return {
    mode: template?.mode ?? 'color',
    color: template?.color ?? '#ffe94a',
    words: page.words.map((word, i) => ({ word: word.text, start: starts[i], end: i + 1 < count ? starts[i + 1] : duration })),
  };
};

/**
 * Cada página pasa a ser una frase del proyecto, clonada de la plantilla (look y movimiento).
 * Los subtítulos nunca se pisan: cada uno termina a lo sumo cuando empieza el siguiente.
 */
export const pagesToLayers = (pages: CaptionPage[], template: TextLayer, createId: () => string): TextLayer[] => {
  let previousStart = -1;
  const starts = pages.map((page) => (previousStart = Math.max(toFrame(page.startMs), previousStart + 1)));
  return pages.map((page, index) => {
    const startFrame = starts[index];
    const nextStart = starts[index + 1];
    const gapMs = index + 1 < pages.length ? pages[index + 1].startMs - page.endMs : Number.POSITIVE_INFINITY;
    let endFrame = gapMs <= JOIN_GAP_MS ? nextStart : toFrame(page.endMs + TAIL_MS);
    if (nextStart !== undefined) endFrame = Math.min(endFrame, nextStart);
    // Con tantas palabras como cuadros no hay otra: se alarga lo mínimo para que cada palabra tenga un cuadro.
    const durationFrames = Math.max(page.words.length, 1, endFrame - startFrame);
    const clone = structuredClone(template);
    return {
      ...clone,
      id: createId(),
      name: nameFor(page.text),
      text: page.text,
      startFrame,
      durationFrames,
      keywords: {},
      transformKeys: undefined,
      wordTiming: contiguousTiming(page, startFrame, durationFrames, template.wordTiming),
      visible: true,
      locked: false,
    };
  });
};
