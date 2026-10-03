import type { EasingName, MotionPreset } from '../types/motion';
import { motionValueBounds, motionValueKeys } from './motionModel.ts';

export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

const easingNames: readonly EasingName[] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'quadOut', 'cubicOut', 'expoOut', 'backOut'];
const categories = ['REVEAL', 'ZOOM', 'IMPACT', 'SLIDE', 'BLUR', '3D', 'WORDS', 'LETTERS', 'EPIC'];
const modes = ['text', 'words', 'letters', 'lines'];
const variations = ['none', 'rain', 'sphere', 'random', 'orbit', 'glitch', 'cursor'];

const objectRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finiteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const validateMotionPreset = (value: unknown): ValidationResult => {
  const issues: ValidationIssue[] = [];
  if (!objectRecord(value)) return { valid: false, issues: [{ path: 'preset', message: 'Debe ser un objeto.' }] };

  const preset = value as Record<string, unknown>;
  if (typeof preset.id !== 'string' || !preset.id.trim()) issues.push({ path: 'id', message: 'Falta un identificador.' });
  if (typeof preset.name !== 'string' || !preset.name.trim()) issues.push({ path: 'name', message: 'Falta un nombre.' });
  if (!categories.includes(String(preset.category))) issues.push({ path: 'category', message: 'Categoría inválida.' });
  if (!modes.includes(String(preset.mode))) issues.push({ path: 'mode', message: 'Modo inválido.' });
  if (!easingNames.includes(preset.easing as EasingName)) issues.push({ path: 'easing', message: 'Easing inválido.' });
  if (preset.variation !== undefined && !variations.includes(String(preset.variation))) issues.push({ path: 'variation', message: 'Variación inválida.' });

  const duration = preset.duration;
  if (!finiteNumber(duration) || duration <= 0 || duration > 36000) issues.push({ path: 'duration', message: 'La duración debe ser finita y mayor a cero.' });
  if (!finiteNumber(preset.staggerDelay) || preset.staggerDelay < 0) issues.push({ path: 'staggerDelay', message: 'El stagger debe ser finito y no negativo.' });

  for (const name of ['spring', 'bounce'] as const) {
    const parameter = preset[name];
    if (parameter !== undefined && (!finiteNumber(parameter) || parameter < 0 || parameter > 1)) issues.push({ path: name, message: 'Debe estar entre 0 y 1.' });
  }

  if (!Array.isArray(preset.keyframes) || preset.keyframes.length === 0) {
    issues.push({ path: 'keyframes', message: 'Debe existir al menos un keyframe.' });
    return { valid: false, issues };
  }

  let previousFrame = -Infinity;
  preset.keyframes.forEach((rawKeyframe, index) => {
    const path = `keyframes[${index}]`;
    if (!objectRecord(rawKeyframe)) {
      issues.push({ path, message: 'Debe ser un objeto.' });
      return;
    }
    const frame = rawKeyframe.frame;
    if (!finiteNumber(frame)) issues.push({ path: `${path}.frame`, message: 'El frame debe ser finito.' });
    else {
      if (frame < 0 || (finiteNumber(duration) && frame > duration)) issues.push({ path: `${path}.frame`, message: 'El frame está fuera de la duración.' });
      if (frame <= previousFrame) issues.push({ path: `${path}.frame`, message: 'Los frames deben estar en orden ascendente y no repetirse.' });
      previousFrame = frame;
    }

    const easing = rawKeyframe.easingToNext ?? rawKeyframe.easing;
    if (easing !== undefined && !easingNames.includes(easing as EasingName)) issues.push({ path: `${path}.easingToNext`, message: 'Easing inválido.' });
    if (rawKeyframe.dynamicsToNext !== undefined && !['none', 'spring'].includes(String(rawKeyframe.dynamicsToNext))) issues.push({ path: `${path}.dynamicsToNext`, message: 'Dinámica inválida.' });

    for (const key of motionValueKeys) {
      const candidate = rawKeyframe[key];
      if (candidate === undefined) continue;
      if (!finiteNumber(candidate)) {
        issues.push({ path: `${path}.${key}`, message: 'Debe ser un número finito.' });
        continue;
      }
      const [minimum, maximum] = motionValueBounds[key];
      if (candidate < minimum || candidate > maximum) issues.push({ path: `${path}.${key}`, message: `Debe estar entre ${minimum} y ${maximum}.` });
    }
  });

  return { valid: issues.length === 0, issues };
};

export const isMotionPreset = (value: unknown): value is MotionPreset => validateMotionPreset(value).valid;
