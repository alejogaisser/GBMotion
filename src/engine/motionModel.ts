import type { AnchorPreset, MotionValues } from '../types/motion';

export const defaultMotionValues: MotionValues = {
  x: 0,
  y: 0,
  translateZ: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  blur: 0,
  skewX: 0,
  skewY: 0,
  letterSpacing: 0,
  perspective: 1200,
  rotateX: 0,
  rotateY: 0,
  transformOriginX: 50,
  transformOriginY: 50,
};

export const motionValueKeys = Object.keys(defaultMotionValues) as (keyof MotionValues)[];

export const motionValueBounds: Record<keyof MotionValues, readonly [number, number]> = {
  x: [-100000, 100000],
  y: [-100000, 100000],
  translateZ: [-10000, 10000],
  scale: [0, 100],
  scaleX: [0, 100],
  scaleY: [0, 100],
  rotation: [-36000, 36000],
  opacity: [0, 1],
  blur: [0, 1000],
  skewX: [-360, 360],
  skewY: [-360, 360],
  letterSpacing: [-1000, 1000],
  perspective: [1, 100000],
  rotateX: [-36000, 36000],
  rotateY: [-36000, 36000],
  transformOriginX: [0, 100],
  transformOriginY: [0, 100],
};

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

export const clampMotionValue = <Key extends keyof MotionValues>(key: Key, value: number): MotionValues[Key] => {
  const [minimum, maximum] = motionValueBounds[key];
  const finite = finiteOr(value, defaultMotionValues[key]);
  return Math.max(minimum, Math.min(maximum, finite));
};

export const clampMotionValues = (values: MotionValues): MotionValues => motionValueKeys.reduce((result, key) => {
  result[key] = clampMotionValue(key, values[key]);
  return result;
}, { ...defaultMotionValues });

export const anchorOrigins: Record<AnchorPreset, readonly [number, number]> = {
  CENTER: [50, 50],
  TOP: [50, 0],
  BOTTOM: [50, 100],
  LEFT: [0, 50],
  RIGHT: [100, 50],
  TOP_LEFT: [0, 0],
  TOP_RIGHT: [100, 0],
  BOTTOM_LEFT: [0, 100],
  BOTTOM_RIGHT: [100, 100],
  CUSTOM: [50, 50],
};

/**
 * Canonical transform order for Player and Renderer.
 * CSS evaluates the rightmost function first, so local scale/skew/rotation are
 * composed before world translation and the perspective projection.
 */
export const transformOrder = [
  'perspective',
  'translate3d',
  'rotateX',
  'rotateY',
  'rotate',
  'skew',
  'scale',
  'scaleX',
  'scaleY',
] as const;

export const buildMotionTransform = (rawValues: MotionValues) => {
  const values = clampMotionValues(rawValues);
  return [
    `perspective(${values.perspective}px)`,
    `translate3d(${values.x}px, ${values.y}px, ${values.translateZ}px)`,
    `rotateX(${values.rotateX}deg)`,
    `rotateY(${values.rotateY}deg)`,
    `rotate(${values.rotation}deg)`,
    `skew(${values.skewX}deg, ${values.skewY}deg)`,
    `scale(${values.scale})`,
    `scaleX(${values.scaleX})`,
    `scaleY(${values.scaleY})`,
  ].join(' ');
};

export const buildTransformOrigin = (rawValues: MotionValues) => {
  const values = clampMotionValues(rawValues);
  return `${values.transformOriginX}% ${values.transformOriginY}%`;
};
