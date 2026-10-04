import type { KeywordStyle, LayerAnimation, TextLayer, WordTiming } from '../types/motion';
import { evenWordTiming } from '../engine/editorMotion';

export const MAX_LAYERS = 400;
export const cloneAnimation = (animation: LayerAnimation): LayerAnimation => structuredClone(animation);
export const cloneLayer = (layer: TextLayer): TextLayer => structuredClone(layer);

const wordKey = (word: string) => word.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');

/** Align words, including repeated words, so small corrections retain emphasis. */
export const remapKeywords = (before: string, after: string, keywords: Record<number, KeywordStyle>) => {
  const oldWords = before.match(/\S+/g) ?? [];
  const newWords = after.match(/\S+/g) ?? [];
  const lengths = Array.from({ length: oldWords.length + 1 }, () => new Uint16Array(newWords.length + 1));
  for (let i = oldWords.length - 1; i >= 0; i--) {
    for (let j = newWords.length - 1; j >= 0; j--) {
      lengths[i][j] = wordKey(oldWords[i]) === wordKey(newWords[j])
        ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const result: Record<number, KeywordStyle> = {};
  let i = 0; let j = 0;
  while (i < oldWords.length && j < newWords.length) {
    if (wordKey(oldWords[i]) === wordKey(newWords[j])) {
      if (keywords[i]) result[j] = { ...keywords[i], word: newWords[j] };
      i++; j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return result;
};

type Timed = WordTiming['words'][number];

/**
 * Keeps the word starts of the words that survive a text edit. Matched words keep
 * their frames, new words share the gap between their matched neighbors, deleted
 * words are absorbed by the previous word. Falls back to an even split when the
 * result would not be monotonic, and to undefined for empty text.
 */
export const remapWordTiming = (before: string, after: string, timing: WordTiming, durationFrames: number): WordTiming | undefined => {
  const newWords = after.match(/\S+/g) ?? [];
  if (newWords.length === 0) return undefined;
  const total = Math.max(1, Math.round(durationFrames));
  const beforeWords = before.match(/\S+/g) ?? [];
  const oldWords = beforeWords.length === timing.words.length ? beforeWords : timing.words.map((item) => item.word);
  const n = newWords.length;
  const fallback = () => (total >= n ? { ...evenWordTiming(after, total), mode: timing.mode, color: timing.color } : undefined);
  if (oldWords.length === 0) return fallback();

  const lengths = Array.from({ length: oldWords.length + 1 }, () => new Uint16Array(n + 1));
  for (let i = oldWords.length - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lengths[i][j] = wordKey(oldWords[i]) === wordKey(newWords[j])
        ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const oldIndexOf: number[] = new Array(n).fill(-1);
  for (let i = 0, j = 0; i < oldWords.length && j < n;) {
    if (wordKey(oldWords[i]) === wordKey(newWords[j])) { oldIndexOf[j] = i; i++; j++; }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  if (oldIndexOf.every((index) => index < 0)) return fallback();

  const out: (Timed | null)[] = oldIndexOf.map((oldIndex, j) => {
    if (oldIndex < 0) return null;
    const source = timing.words[oldIndex];
    return { word: newWords[j], start: source.start, end: source.end };
  });

  // Deleted words (matched neighbors that were not adjacent before) go to the previous word.
  for (let j = 1; j < n; j++) {
    const a = out[j - 1]; const b = out[j];
    if (a && b && oldIndexOf[j] - oldIndexOf[j - 1] > 1) a.end = b.start;
  }

  for (let a = 0; a < n;) {
    if (out[a]) { a++; continue; }
    let b = a;
    while (b < n && !out[b]) b++;
    const count = b - a;
    const prev = a > 0 ? out[a - 1] : null;
    const next = b < n ? out[b] : null;
    const lo = prev ? prev.end : 0;
    const hi = next ? next.start : total;
    if (hi - lo >= count) {
      for (let k = 0; k < count; k++) {
        out[a + k] = { word: newWords[a + k], start: lo + Math.floor(k * (hi - lo) / count), end: lo + Math.floor((k + 1) * (hi - lo) / count) };
      }
    } else if (prev) {
      // No room: the new words share the tail of the previous word.
      const from = prev.start; const span = hi - from; const slots = count + 1;
      if (span < slots) return fallback();
      prev.end = from + Math.floor(span / slots);
      for (let k = 0; k < count; k++) {
        out[a + k] = { word: newWords[a + k], start: from + Math.floor((k + 1) * span / slots), end: from + Math.floor((k + 2) * span / slots) };
      }
    } else if (next) {
      const to = next.end; const span = to - lo; const slots = count + 1;
      if (span < slots) return fallback();
      for (let k = 0; k < count; k++) {
        out[a + k] = { word: newWords[a + k], start: lo + Math.floor(k * span / slots), end: lo + Math.floor((k + 1) * span / slots) };
      }
      next.start = lo + Math.floor(count * span / slots);
    } else return fallback();
    a = b;
  }

  const words = out as Timed[];
  words[n - 1].end = total;
  for (let j = 0; j < n; j++) {
    const w = words[j];
    if (!(w.end > w.start) || w.end > total || (j > 0 && w.start < words[j - 1].end)) return fallback();
  }
  return { mode: timing.mode, color: timing.color, words };
};

/**
 * Splits word timing at a local frame. The second half is rebased to its own start.
 * The cut falls before the first word that starts at or after the frame.
 */
export const splitWordTiming = (timing: WordTiming | undefined, cutLocalFrame: number): [WordTiming | undefined, WordTiming | undefined] => {
  if (!timing || timing.words.length === 0) return [undefined, undefined];
  const cut = Math.round(cutLocalFrame);
  const n = timing.words.length;
  let k = timing.words.findIndex((item) => item.start >= cut);
  if (k < 0) k = n;
  if (n >= 2) k = Math.max(1, Math.min(n - 1, k));
  const head = n >= 2 ? timing.words.slice(0, k) : timing.words;
  const tail = n >= 2 ? timing.words.slice(k) : timing.words;
  const first = head.map((item, i) => i === head.length - 1 ? { ...item, end: Math.max(item.start + 1, cut) } : { ...item });
  const second = tail.map((item) => {
    const start = Math.max(0, item.start - cut);
    return { ...item, start, end: Math.max(start + 1, item.end - cut) };
  });
  return [{ ...timing, words: first }, { ...timing, words: second }];
};

/**
 * Each UI gesture has a group ID; subsequent frames/keystrokes join that undo step.
 * Snapshots are immutable by convention, so they are stored by reference and compared
 * field by field instead of being serialized on every change.
 */
export class EditorHistory<T extends object> {
  private current: T;
  private past: T[] = [];
  private future: T[] = [];
  private group: number | undefined;
  constructor(initial: T) { this.current = { ...initial }; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  private same(next: T) {
    const a = next as Record<string, unknown>; const b = this.current as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]) || (Array.isArray(a[key]) && Array.isArray(b[key]) && a[key].length === b[key].length && a[key].every((item, i) => Object.is(item, (b[key] as unknown[])[i]))));
  }
  observe(next: T, group: number) {
    if (this.same(next)) return;
    if (this.group !== group) {
      this.past.push(this.current);
      if (this.past.length > 50) this.past.shift();
    }
    this.current = { ...next };
    this.future = [];
    this.group = group;
  }
  undo(): T | undefined {
    const next = this.past.pop();
    if (!next) return;
    this.future.push(this.current); this.current = structuredClone(next); this.group = undefined;
    return this.current;
  }
  redo(): T | undefined {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.current); this.current = structuredClone(next); this.group = undefined;
    return this.current;
  }
  reset(next: T) { this.current = { ...next }; this.past = []; this.future = []; this.group = undefined; }
}
