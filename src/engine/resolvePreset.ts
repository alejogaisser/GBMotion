import type { AnchorPreset, MotionKeyframe, MotionOverrides, MotionPreset } from '../types/motion';
import { anchorOrigins, clampMotionValue, motionValueKeys } from './motionModel.ts';
import { isReadableEffect } from './readableEffects.ts';

const finiteOr = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value as number : fallback;
const bounded = (value: number | undefined, fallback: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, finiteOr(value, fallback)));

export const resolvePreset = (preset: MotionPreset, overrides: MotionOverrides): MotionPreset => {
  const sourceKeyframes = preset.keyframes.length ? preset.keyframes : [{ frame: 0 }, { frame: Math.max(1, preset.duration) }];
  const firstFrame = finiteOr(sourceKeyframes[0]?.frame, 0);
  const lastFrame = finiteOr(sourceKeyframes[sourceKeyframes.length - 1]?.frame, Math.max(1, preset.duration));
  const duration = bounded(overrides.duration, Math.max(1, preset.duration), 1, 36000);
  const delay = bounded(overrides.delay, preset.delay ?? 0, 0, 36000);
  const scaleFactor = duration / Math.max(1, lastFrame - firstFrame);
  const middleScales = sourceKeyframes.slice(1, -1).map((item) => item.scale).filter((value): value is number => typeof value === 'number' && value > 1);
  const baseOvershoot = preset.overshoot ?? Math.max(1, ...middleScales);
  const anchor = (overrides.anchor ?? 'CENTER') as AnchorPreset;
  const [anchorX, anchorY] = anchorOrigins[anchor] ?? anchorOrigins.CENTER;
  const originX = anchor === 'CUSTOM' ? finiteOr(overrides.transformOriginX, 50) : anchorX;
  const originY = anchor === 'CUSTOM' ? finiteOr(overrides.transformOriginY, 50) : anchorY;

  const keyframes = sourceKeyframes.map((keyframe, index): MotionKeyframe => {
    const next: MotionKeyframe = {
      ...keyframe,
      frame: Math.max(0, Math.min(duration, Math.round((finiteOr(keyframe.frame, firstFrame) - firstFrame) * scaleFactor))),
    };
    if (index > 0 && index < sourceKeyframes.length - 1 && typeof keyframe.scale === 'number' && keyframe.scale > 1 && baseOvershoot > 1) {
      const requestedOvershoot = bounded(overrides.overshoot, baseOvershoot, 1, 10);
      next.scale = 1 + (keyframe.scale - 1) * ((requestedOvershoot - 1) / (baseOvershoot - 1));
    }
    if (index === 0) {
      Object.assign(next, {
        scale: finiteOr(overrides.initialScale, keyframe.scale ?? 1),
        scaleX: finiteOr(overrides.scaleX, keyframe.scaleX ?? 1),
        scaleY: finiteOr(overrides.scaleY, keyframe.scaleY ?? 1),
        x: finiteOr(overrides.x, keyframe.x ?? 0),
        y: finiteOr(overrides.y, keyframe.y ?? 0),
        translateZ: finiteOr(overrides.translateZ, keyframe.translateZ ?? 0),
        rotation: finiteOr(overrides.rotation, keyframe.rotation ?? 0),
        opacity: finiteOr(overrides.opacity, keyframe.opacity ?? 1),
        blur: finiteOr(overrides.blur, keyframe.blur ?? 0),
        skewX: finiteOr(overrides.skewX, keyframe.skewX ?? 0),
        skewY: finiteOr(overrides.skewY, keyframe.skewY ?? 0),
        letterSpacing: finiteOr(overrides.animatedLetterSpacing, keyframe.letterSpacing ?? 0),
        perspective: finiteOr(overrides.perspective, keyframe.perspective ?? 1200),
        rotateX: finiteOr(overrides.rotateX, keyframe.rotateX ?? 0),
        rotateY: finiteOr(overrides.rotateY, keyframe.rotateY ?? 0),
        transformOriginX: originX,
        transformOriginY: originY,
      });
    }
    for (const key of motionValueKeys) {
      const candidate = next[key];
      if (typeof candidate === 'number') next[key] = clampMotionValue(key, candidate);
    }
    return next;
  });

  return {
    ...preset,
    duration,
    delay,
    mode: isReadableEffect(preset) && (overrides.mode ?? preset.mode) === 'letters' ? 'words' : overrides.mode ?? preset.mode,
    staggerDelay: bounded(overrides.staggerDelay, preset.staggerDelay, 0, 3600),
    easing: overrides.easing ?? preset.easing,
    spring: bounded(overrides.spring, preset.spring ?? 0, 0, 1),
    bounce: bounded(overrides.bounce, preset.bounce ?? 0, 0, 1),
    overshoot: bounded(overrides.overshoot, preset.overshoot ?? baseOvershoot, 1, 10),
    keyframes,
  };
};
