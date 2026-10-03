import type { AnimationMode } from '../types/motion';

export type TextToken = {
  content: string;
  animate: boolean;
  animationIndex: number;
  wordIndex?: number;
};

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('es', { granularity: 'grapheme' })
  : null;

export const splitGraphemes = (text: string) => graphemeSegmenter
  ? Array.from(graphemeSegmenter.segment(text), (item) => item.segment)
  : Array.from(text);

export const tokenizeWords = (text: string): TextToken[] => {
  let wordIndex = 0;
  return text.split(/(\s+)/u).filter((part) => part.length > 0).map((content) => {
    if (/^\s+$/u.test(content)) return { content, animate: false, animationIndex: Math.max(0, wordIndex - 1) };
    const token = { content, animate: true, animationIndex: wordIndex, wordIndex };
    wordIndex += 1;
    return token;
  });
};

export const tokenizeGraphemes = (text: string): TextToken[] => {
  let animationIndex = 0;
  let wordIndex = 0;
  let insideWord = false;
  return splitGraphemes(text).map((content) => {
    const whitespace = /^\s+$/u.test(content);
    if (whitespace) {
      if (insideWord) wordIndex += 1;
      insideWord = false;
      return { content, animate: false, animationIndex: Math.max(0, animationIndex - 1) };
    }
    insideWord = true;
    const token = { content, animate: true, animationIndex, wordIndex };
    animationIndex += 1;
    return token;
  });
};

export const tokensForMode = (text: string, mode: AnimationMode): TextToken[] => {
  if (mode === 'words') return tokenizeWords(text);
  if (mode === 'letters') return tokenizeGraphemes(text);
  if (mode === 'lines') return text.split('\n').map((content, animationIndex) => ({ content, animate: true, animationIndex }));
  return [{ content: text, animate: true, animationIndex: 0 }];
};

export const getAnimatedUnitCount = (text: string, mode: AnimationMode) => Math.max(
  1,
  tokensForMode(text, mode).filter((token) => token.animate).length,
);
