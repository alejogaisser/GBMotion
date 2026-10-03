import type { MotionPreset } from '../types/motion';

/** Pure frame-based masks. Old presets omit mask and keep their existing paint. */
export function revealClip(preset: MotionPreset, frame: number): string | undefined {
  if (!preset.mask) return undefined;
  const t = Math.max(0, Math.min(1, frame / Math.max(1, preset.duration)));
  const progress = preset.intent === 'out' ? 1 - t : t;
  if (progress >= 1) return undefined;
  const remaining = (1 - progress) * 100;
  if (preset.mask === 'center') return `inset(0 ${remaining / 2}% 0 ${remaining / 2}%)`;
  if (preset.mask === 'bottom') return `inset(${remaining}% 0 0 0)`;
  return `inset(0 ${remaining}% 0 0)`;
}
