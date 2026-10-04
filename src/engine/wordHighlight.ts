import type React from 'react';
import type { WordTiming } from '../types/motion';
import { paintFillCss, type ResolvedPaint } from './textPaint';

const filled = (color: string): React.CSSProperties => ({ color, WebkitTextFillColor: color });

/** Escala de la palabra activa en el modo «scale». */
export const SCALE_HIGHLIGHT = 1.15;

/**
 * CSS que se suma al span de una palabra según el modo de resaltado.
 *
 * - `color` / `box`: sólo la palabra que se está diciendo.
 * - `karaoke`: las que ya se dijeron conservan el color.
 * - `reveal`: las que todavía no se dijeron se ocultan con `visibility`, no con
 *   `opacity`, para que el layout y el degradado no cambien.
 * - `scale`: la activa crece. Es un inline-block con `transform`, así que lleva su
 *   propio relleno (`paintFillCss`): sin él un degradado desaparece. El contorno
 *   y la sombra NO se repiten: con degradado viven en el `filter` del span padre,
 *   que ya envuelve a la palabra agrandada; con relleno plano el `text-shadow`
 *   se hereda. Repetir el `filter` acá dibujaría el contorno dos veces.
 */
export const wordHighlightCss = (timing: WordTiming, wordIndex: number, localFrame: number, paint: ResolvedPaint): React.CSSProperties => {
  const word = timing.words[wordIndex];
  if (!word) return {};
  const active = localFrame >= word.start && localFrame < word.end;
  const spoken = localFrame >= word.start;
  switch (timing.mode) {
    case 'box':
      return active ? { backgroundColor: timing.color, color: '#111111', WebkitTextFillColor: '#111111', borderRadius: '0.12em' } : {};
    case 'karaoke':
      return spoken ? filled(timing.color) : {};
    case 'reveal':
      return spoken ? {} : { visibility: 'hidden' };
    case 'scale':
      return active
        ? { ...paintFillCss(paint), display: 'inline-block', transform: `scale(${SCALE_HIGHLIGHT})`, transformOrigin: '50% 70%' }
        : { display: 'inline-block' };
    case 'color':
    default:
      return active ? filled(timing.color) : {};
  }
};
