import type { TextLayer } from '../types/motion';
import { getLayerDuration } from '../utils/duration.ts';

export type CaptionIssueCode = 'too_fast' | 'timing_outside_clip' | 'empty_visible' | 'too_short' | 'time_overlap';
export type CaptionIssue = {
  layerId: string;
  code: CaptionIssueCode;
  severity: 'warning';
  message: string;
  startFrame: number;
};

type Options = { maxCharsPerSecond?: number; minDurationSec?: number };

/** Avisos heurísticos: no alteran capas ni bloquean la exportación. */
export const reviewCaptions = (layers: TextLayer[], fps: number, options: Options = {}): CaptionIssue[] => {
  if (!Number.isFinite(fps) || fps <= 0) return [];
  const issues: CaptionIssue[] = [];
  const maxChars = options.maxCharsPerSecond ?? 20;
  const minimum = options.minDurationSec ?? 0.5;
  const captions = layers.filter((l) => l.visible && l.wordTiming);
  const add = (l: TextLayer, code: CaptionIssueCode, message: string) => issues.push({ layerId: l.id, code, severity: 'warning', message, startFrame: l.startFrame });
  for (const layer of layers.filter((l) => l.visible)) {
    const duration = getLayerDuration(layer);
    const seconds = duration / fps;
    if (!layer.text.trim()) add(layer, 'empty_visible', 'Frase vacía: ocultala o agregá texto.');
    if (Array.from(layer.text).length / seconds > maxChars) add(layer, 'too_fast', 'Muy rápida: dale más tiempo para leerla.');
    if (seconds < minimum) add(layer, 'too_short', 'Muy corta: la frase queda menos tiempo del recomendado.');
    if (layer.wordTiming?.words.some((w) => !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end > duration || w.end < w.start)) add(layer, 'timing_outside_clip', 'Palabra fuera del clip: revisá sus tiempos.');
  }
  for (const layer of captions) {
    if (captions.some((other) => other !== layer && other.startFrame < layer.startFrame + getLayerDuration(layer) && layer.startFrame < other.startFrame + getLayerDuration(other))) add(layer, 'time_overlap', 'Frases al mismo tiempo: revisá sus intervalos.');
  }
  return issues;
};
