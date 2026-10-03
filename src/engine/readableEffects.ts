import type { MotionPreset } from '../types/motion';

export const isReadableEffect = (preset: MotionPreset | null) => !!preset && !preset.custom && ['random', 'sphere', 'orbit', 'rain'].includes(preset.variation ?? '');
export type WordBox = { x: number; y: number; width: number; height: number };
const random = (seed: number) => { const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

/** Shared circular origins, clockwise from the top. Words never rotate with the path. */
export function circleOrigins(boxes: WordBox[], width: number, height: number) {
  const radius = Math.max(0, Math.min(width, height) * 0.32);
  const points = boxes.map((_, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / Math.max(1, boxes.length); return { x: Math.cos(a) * radius, y: Math.sin(a) * radius }; });
  let scale = 0.8;
  for (let i = 0; i < boxes.length; i++) {
    scale = Math.min(scale, (width / 2 - Math.abs(points[i].x)) * 2 / Math.max(1, boxes[i].width), (height / 2 - Math.abs(points[i].y)) * 2 / Math.max(1, boxes[i].height));
    for (let j = 0; j < i; j++) {
      // At least one axis must separate the two rectangles, including a small gutter.
      scale = Math.min(scale, Math.max(Math.abs(points[i].x - points[j].x) * 2 / (boxes[i].width + boxes[j].width + 24), Math.abs(points[i].y - points[j].y) * 2 / (boxes[i].height + boxes[j].height + 24)));
    }
  }
  return points.map((point) => ({ ...point, scale: Math.max(0.01, scale) }));
}

export function readableWordMotion(preset: MotionPreset, index: number, frame: number, box: WordBox, origin: { x: number; y: number; scale: number }) {
  const t = Math.max(0, Math.min(1, frame / Math.max(1, preset.duration)));
  const circular = preset.variation === 'sphere' || preset.variation === 'orbit';
  // Circle is visible briefly, then settles; random entries stay close to their reading position.
  const travel = Math.max(0, (t - (circular ? 0.2 : 0)) / (circular ? 0.8 : 1));
  const remaining = Math.pow(1 - travel, 3);
  const x = circular ? origin.x - box.x : preset.variation === 'rain' ? 0 : (random(index + 1) - 0.5) * Math.min(140, box.width);
  const y = circular ? origin.y - box.y : preset.variation === 'rain' ? -110 - random(index + 17) * 60 : (random(index + 17) - 0.5) * 140;
  return { x: x * remaining, y: y * remaining, scale: 1 - (1 - (circular ? origin.scale : 0.94)) * remaining, opacity: Math.min(1, t / 0.16), rotation: 0, blur: 0 };
}
