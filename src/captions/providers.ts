import type { TimedWord } from './types.ts';

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const ms = (seconds: unknown) => (typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.round(seconds * 1000)) : null);

/**
 * ElevenLabs Scribe: `words` mezcla palabras, espacios y eventos de audio. Sólo se
 * toman las de tipo `word`; la confianza sale de `logprob` (exp, entre 0 y 1).
 */
export const fromElevenLabs = (payload: unknown): TimedWord[] => {
  const words = record(payload) && Array.isArray(payload.words) ? payload.words : [];
  const result: TimedWord[] = [];
  for (const item of words) {
    if (!record(item) || item.type !== 'word' || typeof item.text !== 'string') continue;
    const startMs = ms(item.start);
    const endMs = ms(item.end);
    if (startMs === null || endMs === null || !item.text.trim()) continue;
    const confidence = typeof item.logprob === 'number' && Number.isFinite(item.logprob) ? Math.min(1, Math.max(0, Math.exp(item.logprob))) : null;
    result.push({ text: item.text.trim(), startMs, endMs: Math.max(endMs, startMs), confidence });
  }
  return result;
};

/** Para comparar una palabra con su versión puntuada: sin signos, sin tildes, sin mayúsculas. */
const key = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');

/** Cuántas palabras hacia adelante se busca la coincidencia antes de darla por perdida. */
const LOOKAHEAD = 3;

/**
 * Whisper (Groq) devuelve las palabras sin puntuación, pero `text` sí la trae. Se
 * alinean las dos listas: cada palabra busca su token dentro de una ventana corta y
 * toma su versión con ¿?¡!,. Si no hay coincidencia queda la palabra cruda.
 */
export const fromGroq = (payload: unknown): TimedWord[] => {
  if (!record(payload)) return [];
  const words = Array.isArray(payload.words) ? payload.words : [];
  const tokens = typeof payload.text === 'string' ? payload.text.match(/\S+/g) ?? [] : [];
  const result: TimedWord[] = [];
  let pointer = 0;
  for (const item of words) {
    if (!record(item) || typeof item.word !== 'string') continue;
    const startMs = ms(item.start);
    const endMs = ms(item.end);
    const raw = item.word.trim();
    if (startMs === null || endMs === null || !raw) continue;
    const wanted = key(raw);
    let text = raw;
    if (wanted) {
      for (let offset = 0; offset <= LOOKAHEAD && pointer + offset < tokens.length; offset++) {
        if (key(tokens[pointer + offset]) === wanted) {
          text = tokens[pointer + offset];
          pointer += offset + 1;
          break;
        }
      }
    }
    result.push({ text, startMs, endMs: Math.max(endMs, startMs), confidence: null });
  }
  return result;
};
