import type { TextLayer } from '../types/motion';
import { getAnimationTimelineDuration } from '../engine/layerAnimation.ts';
import { getAnimatedUnitCount } from './textSegmentation.ts';

export const getUnitCount = (layer: TextLayer) => {
  return getAnimatedUnitCount(layer.text, layer.overrides.mode);
};

/** Frames held on screen after the animation settles when the clip auto-sizes. */
export const AUTO_DURATION_TAIL = 15;
/** Auto-sized clips never fall below this, matching the project minimum. */
export const MIN_AUTO_DURATION = 90;

/**
 * How many frames a layer occupies on the timeline.
 * A manual `durationFrames` always wins. Otherwise the clip lasts as long as its
 * animation needs (entrada + pausa + salida) so "Tiempo visible" and combo exits
 * are honored, with a floor so short captions still read comfortably.
 */
export const getLayerDuration = (layer: TextLayer) => {
  if (typeof layer.durationFrames === 'number') return Math.max(1, layer.durationFrames);
  return Math.max(MIN_AUTO_DURATION, getAnimationTimelineDuration(layer) + AUTO_DURATION_TAIL);
};

/** True when the clip length comes from the animation rather than a manual edit. */
export const isAutoDuration = (layer: TextLayer) => typeof layer.durationFrames !== 'number';

export const getCompositionDuration = (layers: TextLayer[]) => Math.max(90, ...layers.filter((layer) => layer.visible).map((layer) => Math.max(0, layer.startFrame ?? 0) + getLayerDuration(layer)));
