import type React from 'react';
import type { LoopAnimation, LoopKind } from '../types/motion';

/**
 * Animaciones de bucle: el movimiento que corre **mientras el texto está en
 * pantalla**, aparte de cómo entra y cómo sale.
 *
 * CapCut trabaja con tres pistas —entrada, salida y bucle— y ésta es la tercera.
 * Es lo que hace que un subtítulo respire, tiemble o flote en vez de quedarse
 * congelado entre la entrada y la salida.
 *
 * Todo acá es función pura del cuadro, sin estado ni azar: el preview del
 * navegador y el MP4 de Remotion calculan exactamente lo mismo.
 */

export type LoopValues = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

const NEUTRAL: LoopValues = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

const TAU = Math.PI * 2;

/** Onda entre 0 y 1 con forma de latido: un golpe fuerte y otro más chico. */
const heartbeat = (phase: number) => {
  const t = (phase % TAU) / TAU;
  if (t < 0.14) return Math.sin((t / 0.14) * Math.PI);
  if (t < 0.32) return 0.55 * Math.sin(((t - 0.18) / 0.14) * Math.PI);
  return 0;
};

/** Ruido determinista: mismo cuadro, mismo valor, en preview y en render. */
const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

export const loopKinds: LoopKind[] = [
  'none', 'breathe', 'heartbeat', 'float', 'wave', 'swing',
  'shake', 'pulse', 'blink', 'spin', 'drift', 'glitch',
];

export const loopLabels: Record<LoopKind, string> = {
  none: 'Sin bucle',
  breathe: 'Respiración',
  heartbeat: 'Latido',
  float: 'Flotar',
  wave: 'Ola',
  swing: 'Balanceo',
  shake: 'Temblor',
  pulse: 'Pulso',
  blink: 'Parpadeo',
  spin: 'Giro',
  drift: 'Deriva',
  glitch: 'Glitch',
};

export const loopHints: Record<LoopKind, string> = {
  none: 'El texto se queda quieto entre la entrada y la salida.',
  breathe: 'Crece y se achica despacio. Casi no se nota, y da vida.',
  heartbeat: 'Dos golpes de escala, como un corazón.',
  float: 'Sube y baja suave, como si flotara.',
  wave: 'Cada palabra sube y baja desfasada. El clásico de los subtítulos.',
  swing: 'Se inclina de un lado al otro.',
  shake: 'Vibra rápido. Sirve para gritar algo.',
  pulse: 'Un golpe de tamaño cada tanto, para llamar la atención.',
  blink: 'Aparece y desaparece, como un cartel de neón.',
  spin: 'Gira sin parar. Usalo con moderación.',
  drift: 'Se mueve en círculos lentos.',
  glitch: 'Salta de lugar de a ratos, como una señal mala.',
};

/**
 * `frame` es local a la capa, `unitIndex` desfasa las palabras o letras para
 * que la ola no se mueva toda junta.
 */
export const loopValues = (loop: LoopAnimation | null | undefined, frame: number, fps: number, unitIndex = 0): LoopValues => {
  if (!loop || loop.kind === 'none' || loop.intensity <= 0) return NEUTRAL;

  const seconds = frame / Math.max(1, fps);
  const strength = loop.intensity;
  const offset = loop.perUnit ? unitIndex * 0.42 : 0;
  const phase = seconds * loop.speed * TAU + offset;

  switch (loop.kind) {
    case 'breathe':
      return { ...NEUTRAL, scale: 1 + 0.045 * strength * Math.sin(phase) };
    case 'heartbeat':
      return { ...NEUTRAL, scale: 1 + 0.1 * strength * heartbeat(phase) };
    case 'float':
      return { ...NEUTRAL, y: -9 * strength * Math.sin(phase) };
    case 'wave':
      return { ...NEUTRAL, y: -16 * strength * Math.sin(phase) };
    case 'swing':
      return { ...NEUTRAL, rotation: 3.6 * strength * Math.sin(phase) };
    case 'shake':
      return {
        ...NEUTRAL,
        x: 5 * strength * Math.sin(phase * 6.3),
        y: 3.5 * strength * Math.cos(phase * 9.1),
      };
    case 'pulse':
      return { ...NEUTRAL, scale: 1 + 0.075 * strength * Math.max(0, Math.sin(phase)) };
    case 'blink': {
      // Encendido dos tercios del ciclo: un parpadeo simétrico se lee como error.
      const on = (phase / TAU) % 1 < 0.66;
      return { ...NEUTRAL, opacity: on ? 1 : Math.max(0, 1 - 0.85 * strength) };
    }
    case 'spin':
      return { ...NEUTRAL, rotation: (seconds * loop.speed * 360) % 360 };
    case 'drift':
      return {
        ...NEUTRAL,
        x: 12 * strength * Math.sin(phase),
        y: 8 * strength * Math.cos(phase * 0.72),
      };
    case 'glitch': {
      // Salta sólo en ráfagas: un temblor continuo no se lee como falla de señal.
      const tick = Math.floor(seconds * loop.speed * 12);
      const burst = noise(tick * 3.7) > 0.45;
      if (!burst) return NEUTRAL;
      return {
        ...NEUTRAL,
        x: 9 * strength * noise(tick),
        y: 3 * strength * noise(tick + 91),
        opacity: 1 - 0.15 * strength * Math.abs(noise(tick + 17)),
      };
    }
    default:
      return NEUTRAL;
  }
};

/** CSS del envoltorio de bucle. `null` cuando no hay nada que aplicar. */
export const loopCss = (
  loop: LoopAnimation | null | undefined,
  frame: number,
  fps: number,
  unitIndex = 0,
): React.CSSProperties | null => {
  if (!loop || loop.kind === 'none' || loop.intensity <= 0) return null;
  const values = loopValues(loop, frame, fps, unitIndex);
  return {
    display: 'inline-block',
    opacity: values.opacity,
    transform: `translate3d(${values.x.toFixed(2)}px, ${values.y.toFixed(2)}px, 0) rotate(${values.rotation.toFixed(2)}deg) scale(${values.scale.toFixed(4)})`,
    willChange: 'transform',
  };
};

export const defaultLoop = (kind: LoopKind): LoopAnimation => ({
  kind,
  speed: kind === 'shake' || kind === 'glitch' ? 1.6 : kind === 'spin' ? 0.35 : 0.8,
  intensity: 1,
  // Sólo la ola se lee mejor desfasada; el resto queda raro partido por palabra.
  perUnit: kind === 'wave',
});
