/**
 * Forma de los subtítulos automáticos. Es compatible con `Caption` de
 * `@remotion/captions` (text, startMs, endMs, confidence) sin depender del paquete.
 */
export type TimedWord = {
  text: string;
  startMs: number;
  endMs: number;
  /** 0 a 1, o null si el proveedor no lo informa. */
  confidence: number | null;
};

/** Una «página» es lo que se ve en pantalla a la vez: un subtítulo. */
export type CaptionPage = {
  text: string;
  startMs: number;
  endMs: number;
  words: TimedWord[];
};

export type GroupOptions = {
  /** Palabras por subtítulo (1 a 8). */
  maxWords: number;
  /** Caracteres por subtítulo (8 a 42). */
  maxChars: number;
  /** Una pausa de este largo corta el subtítulo. */
  breakOnSilenceMs: number;
  breakOnPunctuation: boolean;
  maxDurationMs: number;
  minDurationMs: number;
  removeFillers: boolean;
};

export const defaultGroupOptions: GroupOptions = {
  maxWords: 3,
  maxChars: 20,
  breakOnSilenceMs: 500,
  breakOnPunctuation: true,
  maxDurationMs: 3000,
  minDurationMs: 300,
  removeFillers: true,
};

export type TranscribeProviderId = 'elevenlabs' | 'groq';
export type TranscribeLanguage = 'es' | 'auto' | 'en' | 'pt';
