import { defaultGroupOptions, type CaptionPage, type GroupOptions, type TimedWord } from './types.ts';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

/** Muletillas que no aportan. «este», «bueno» y «o sea» pueden ser parte de la frase, así que se quedan. */
const FILLERS = new Set(['eh', 'ehh', 'em', 'emm', 'ehm', 'mm', 'mmm', 'hmm', 'ah', 'ahh']);

const fillerKey = (text: string) => text.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');

const trimClosers = (text: string) => text.replace(/[)\]"'»”’]+$/u, '');
const endsSentence = (text: string) => /[.?!…]$/u.test(trimClosers(text));
const endsClause = (text: string) => /[,;:]$/u.test(trimClosers(text));

export const removeFillerWords = (words: TimedWord[]) => words.filter((word) => !FILLERS.has(fillerKey(word.text)));

/**
 * Agrupa palabras con tiempos en subtítulos cortos.
 * Corta por cantidad de palabras, por caracteres, por una pausa larga, por duración
 * máxima y por puntuación (después de `.?!…`, y de `,;:` si ya hay 2 palabras).
 */
export const groupWords = (input: TimedWord[], options: Partial<GroupOptions> = {}): CaptionPage[] => {
  const opts: GroupOptions = { ...defaultGroupOptions, ...options };
  const maxWords = Math.round(clamp(opts.maxWords, 1, 8));
  const maxChars = Math.round(clamp(opts.maxChars, 8, 42));
  let words = input.filter((word) => word.text.trim().length > 0).map((word) => ({ ...word, text: word.text.trim() }));
  if (opts.removeFillers) words = removeFillerWords(words);

  const pages: CaptionPage[] = [];
  let current: TimedWord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    pages.push({
      text: current.map((word) => word.text).join(' '),
      startMs: current[0].startMs,
      endMs: Math.max(current[current.length - 1].endMs, current[0].startMs),
      words: current,
    });
    current = [];
  };

  for (const word of words) {
    if (current.length > 0) {
      const last = current[current.length - 1];
      const chars = current.reduce((sum, item) => sum + item.text.length + 1, 0) + word.text.length;
      if (current.length >= maxWords
        || chars > maxChars
        || word.startMs - last.endMs >= opts.breakOnSilenceMs
        || word.endMs - current[0].startMs > opts.maxDurationMs) flush();
    }
    current.push(word);
    if (opts.breakOnPunctuation && (endsSentence(word.text) || (endsClause(word.text) && current.length >= 2))) flush();
  }
  flush();

  // Un subtítulo muy corto se estira, sin pisar al siguiente.
  pages.forEach((page, index) => {
    const nextStart = pages[index + 1]?.startMs ?? Number.POSITIVE_INFINITY;
    const wanted = page.startMs + opts.minDurationMs;
    if (page.endMs < wanted) page.endMs = Math.max(page.endMs, Math.min(wanted, nextStart));
  });
  return pages;
};
