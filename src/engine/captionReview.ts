import type { TextLayer } from '../types/motion';

export type CaptionIssueCode = 'too_fast' | 'timing_outside_clip' | 'empty_visible' | 'too_short' | 'time_overlap';
export type CaptionIssue = {
  layerId: string;
  code: CaptionIssueCode;
  severity: 'warning';
  message: string;
  startFrame: number;
};

type Options = { maxCharsPerSecond?: number; minDurationSec?: number };

/** Contrato F1-C1; las heurísticas de legibilidad llegan en F2-R. */
export const reviewCaptions = (_layers: TextLayer[], _fps: number, _options?: Options): CaptionIssue[] => [];
