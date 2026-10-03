import type { EasingName } from '../types/motion';

export const ease = (name: EasingName, value: number) => {
  const t = Math.max(0, Math.min(1, value));
  if (name === 'linear') return t;
  if (name === 'easeIn') return t * t * t;
  if (name === 'easeOut') return 1 - Math.pow(1 - t, 3);
  if (name === 'easeInOut') return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  if (name === 'quadOut') return 1 - (1 - t) * (1 - t);
  if (name === 'cubicOut') return 1 - Math.pow(1 - t, 3);
  if (name === 'expoOut') return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
