import type { TextLayer, TransformKey, WordTiming } from '../types/motion';

export type { TransformKey, WordTiming } from '../types/motion';
export const neutralTransform: TransformKey = { frame: 0, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, easing: 'smooth' };
export function sampleTransform(keys: TransformKey[] | undefined, frame: number): TransformKey {
  if (!keys?.length) return neutralTransform;
  const sorted = [...keys].sort((a, b) => a.frame - b.frame);
  if (frame <= sorted[0].frame) return sorted[0];
  const right = sorted.findIndex((key) => key.frame > frame);
  if (right < 0) return sorted[sorted.length - 1];
  const a = sorted[right - 1]; const b = sorted[right];
  const t = Math.max(0, Math.min(1, (frame - a.frame) / Math.max(1, b.frame - a.frame)));
  const k = a.easing === 'smooth' ? t * t * (3 - 2 * t) : t;
  const mix = (name: 'x' | 'y' | 'scale' | 'rotation' | 'opacity') => a[name] + (b[name] - a[name]) * k;
  return { frame, x: mix('x'), y: mix('y'), scale: mix('scale'), rotation: mix('rotation'), opacity: mix('opacity'), easing: a.easing };
}
export function activeWord(timing: WordTiming | undefined, frame: number) {
  return timing?.words.findIndex((word) => frame >= word.start && frame < word.end) ?? -1;
}
export function evenWordTiming(text: string, duration: number): WordTiming {
  const words = text.match(/\S+/g) ?? [];
  return { mode: 'color', color: '#ffe94a', words: words.map((word, i) => ({ word, start: Math.floor(i * duration / words.length), end: Math.floor((i + 1) * duration / words.length) })) };
}
export function alignLayers(layers: TextLayer[], ids: string[], axis: 'x' | 'y', target: number) {
  return layers.map((layer) => ids.includes(layer.id) && !layer.locked ? { ...layer, [axis === 'x' ? 'positionX' : 'positionY']: target } : layer);
}
export function distributeLayers(layers: TextLayer[], ids: string[], axis: 'x' | 'y') {
  const key = axis === 'x' ? 'positionX' : 'positionY';
  const targets = layers.filter((l) => ids.includes(l.id) && !l.locked).sort((a, b) => a[key] - b[key]);
  if (targets.length < 3) return layers;
  const start = targets[0][key]; const step = (targets[targets.length - 1][key] - start) / (targets.length - 1);
  return layers.map((layer) => { const index = targets.findIndex((l) => l.id === layer.id); return index < 0 ? layer : { ...layer, [key]: start + index * step }; });
}
