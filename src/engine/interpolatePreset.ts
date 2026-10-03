import type { MotionKeyframe, MotionPreset, MotionValues } from '../types/motion';
import { ease } from './easing.ts';
import { clampMotionValue, clampMotionValues, defaultMotionValues, motionValueKeys } from './motionModel.ts';

type ResolvedKeyframe = MotionKeyframe & MotionValues;

// interpolatePreset runs once per animated unit per frame. The keyframe resolution
// below is pure and depends only on the preset object, so cache it by reference:
// every unit of a layer shares the same resolved preset within a render.
const keyframeCache = new WeakMap<MotionPreset, ResolvedKeyframe[]>();

const resolvedKeyframes = (preset: MotionPreset): ResolvedKeyframe[] => {
  const cached = keyframeCache.get(preset);
  if (cached) return cached;
  let state: MotionValues = { ...defaultMotionValues };
  const resolved = preset.keyframes
    .filter((keyframe) => Number.isFinite(keyframe.frame))
    .slice()
    .sort((left, right) => left.frame - right.frame)
    .map((keyframe) => {
      const next = { ...state };
      for (const key of motionValueKeys) {
        const candidate = keyframe[key];
        if (typeof candidate === 'number') next[key] = clampMotionValue(key, candidate);
      }
      state = next;
      return { ...keyframe, ...state };
    });
  keyframeCache.set(preset, resolved);
  return resolved;
};

const springProgress = (progress: number, spring: number, bounce: number) => {
  const intensity = Math.max(0, Math.min(1, spring));
  const amplitude = Math.max(0, Math.min(1, bounce));
  if (intensity === 0 || amplitude === 0) return progress;
  const oscillation = Math.sin(progress * Math.PI * (2 + intensity * 3));
  return Math.max(0, Math.min(1, progress + oscillation * (1 - progress) * amplitude * 0.32));
};

export const interpolatePreset = (preset: MotionPreset, rawFrame: number): MotionValues => {
  const frames = resolvedKeyframes(preset);
  if (frames.length === 0) return { ...defaultMotionValues };
  const frame = Math.max(0, Number.isFinite(rawFrame) ? rawFrame : 0);
  const before = [...frames].reverse().find((item) => item.frame <= frame) ?? frames[0];
  const after = frames.find((item) => item.frame >= frame) ?? frames[frames.length - 1];
  if (before.frame === after.frame) {
    return clampMotionValues(motionValueKeys.reduce((result, key) => {
      result[key] = before[key];
      return result;
    }, { ...defaultMotionValues }));
  }

  const progress = (frame - before.frame) / (after.frame - before.frame);
  const eased = ease(before.easingToNext ?? before.easing ?? preset.easing, progress);
  const dynamicProgress = before.dynamicsToNext === 'spring'
    ? springProgress(eased, preset.spring ?? 0, preset.bounce ?? 0)
    : eased;

  return clampMotionValues(motionValueKeys.reduce((result, key) => {
    result[key] = before[key] + (after[key] - before[key]) * dynamicProgress;
    return result;
  }, { ...defaultMotionValues }));
};

export { defaultMotionValues } from './motionModel.ts';
