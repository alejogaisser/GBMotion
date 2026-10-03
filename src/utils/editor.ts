import type { KeywordStyle, LayerAnimation, TextLayer } from '../types/motion';

export const MAX_LAYERS = 120;
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

/** Each UI gesture has a group ID; subsequent frames/keystrokes join that undo step. */
export class EditorHistory<T> {
  private current: T;
  private past: T[] = [];
  private future: T[] = [];
  private group: number | undefined;
  constructor(initial: T) { this.current = structuredClone(initial); }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  observe(next: T, group: number) {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    if (this.group !== group) {
      this.past.push(this.current);
      if (this.past.length > 50) this.past.shift();
    }
    this.current = structuredClone(next);
    this.future = [];
    this.group = group;
  }
  undo(): T | undefined {
    const next = this.past.pop();
    if (!next) return;
    this.future.push(this.current); this.current = next; this.group = undefined;
    return structuredClone(next);
  }
  redo(): T | undefined {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.current); this.current = next; this.group = undefined;
    return structuredClone(next);
  }
  reset(next: T) { this.current = structuredClone(next); this.past = []; this.future = []; this.group = undefined; }
}
