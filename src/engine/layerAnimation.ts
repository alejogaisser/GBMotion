import type { AnimationSegment, LayerAnimation, TextLayer } from '../types/motion';
import { getAnimatedUnitCount } from '../utils/textSegmentation.ts';
import { isReadableEffect } from './readableEffects.ts';

export type AnimationPhase = {
  kind: 'in' | 'hold' | 'out';
  segment: AnimationSegment | null;
  timelineFrame: number;
  reverse: boolean;
  fadeOut: boolean;
};

export const animationForLayer = (layer: TextLayer): LayerAnimation => layer.animation ?? {
  in: { preset: layer.preset, overrides: layer.overrides },
  holdFrames: 0,
  out: null,
};

export const getSegmentTimelineDuration = (segment: AnimationSegment | null, text: string) => {
  if (!segment) return 0;
  const mode = isReadableEffect(segment.preset) && segment.overrides.mode === 'letters' ? 'words' : segment.overrides.mode;
  const unitCount = getAnimatedUnitCount(text, mode);
  return segment.overrides.delay + segment.overrides.duration + Math.max(0, unitCount - 1) * segment.overrides.staggerDelay;
};

export const getAnimationTimelineDuration = (layer: TextLayer) => {
  const animation = animationForLayer(layer);
  return getSegmentTimelineDuration(animation.in, layer.text)
    + Math.max(0, animation.holdFrames)
    + getSegmentTimelineDuration(animation.out, layer.text);
};

export const getAnimationPhase = (layer: TextLayer, frame: number): AnimationPhase => {
  const animation = animationForLayer(layer);
  const inDuration = getSegmentTimelineDuration(animation.in, layer.text);
  const holdDuration = Math.max(0, animation.holdFrames);
  const outDuration = getSegmentTimelineDuration(animation.out, layer.text);

  if (animation.in && frame < inDuration) return { kind: 'in', segment: animation.in, timelineFrame: frame, reverse: false, fadeOut: false };
  if (frame < inDuration + holdDuration || !animation.out) {
    return { kind: 'hold', segment: animation.in, timelineFrame: inDuration, reverse: false, fadeOut: false };
  }

  const outFrame = Math.max(0, Math.min(outDuration, frame - inDuration - holdDuration));
  const reverse = animation.out.preset.intent !== 'out';
  return { kind: 'out', segment: animation.out, timelineFrame: outFrame, reverse, fadeOut: reverse };
};
