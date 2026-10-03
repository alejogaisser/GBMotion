import type { TextLayer, VideoFormat } from '../types/motion';

export type TextLayoutResult = {
  fontSize: number;
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  lineCount: number;
  overflowX: boolean;
  overflowY: boolean;
  overflow: boolean;
  wasAutoFitted: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const graphemes = (value: string) => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(value), (item) => item.segment);
  }
  return Array.from(value);
};

const glyphWidth = (glyph: string) => {
  if (/^\s$/u.test(glyph)) return 0.33;
  if (/^[ilI1.,:;'!|]$/u.test(glyph)) return 0.3;
  if (/^[MW@#%&]$/u.test(glyph)) return 0.88;
  if (/^[A-ZÁÉÍÓÚÜÑ0-9]$/u.test(glyph)) return 0.64;
  if (/^[a-záéíóúüñ]$/u.test(glyph)) return 0.54;
  if (/^[\p{Extended_Pictographic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(glyph)) return 1;
  return 0.58;
};

const widthOf = (value: string, fontSize: number, letterSpacing: number, wordSpacing: number) => {
  const units = graphemes(value);
  const spaces = units.filter((unit) => /^\s$/u.test(unit)).length;
  return units.reduce((sum, unit) => sum + glyphWidth(unit) * fontSize, 0)
    + Math.max(0, units.length - 1) * letterSpacing
    + spaces * wordSpacing;
};

const measuredLines = (text: string, fontSize: number, widthLimit: number, layer: TextLayer) => {
  const manualLines = text.split('\n');
  if (!layer.autoLineBreak) return manualLines.map((line) => widthOf(line, fontSize, layer.typography.letterSpacing, layer.typography.wordSpacing));

  const result: number[] = [];
  for (const manualLine of manualLines) {
    if (!manualLine) {
      result.push(0);
      continue;
    }
    const tokens = manualLine.match(/\S+\s*/gu) ?? [manualLine];
    let current = 0;
    for (const token of tokens) {
      const tokenWidth = widthOf(token, fontSize, layer.typography.letterSpacing, layer.typography.wordSpacing);
      if (current > 0 && current + tokenWidth > widthLimit) {
        result.push(current);
        current = 0;
      }
      if (tokenWidth <= widthLimit) {
        current += tokenWidth;
        continue;
      }
      // Fit the whole word instead of declaring a vertical stack of letters to be a fit.
      current = tokenWidth;
    }
    result.push(current);
  }
  return result.length ? result : [0];
};

const measure = (layer: TextLayer, fontSize: number, maxWidth: number) => {
  const lineWidths = measuredLines(layer.text || ' ', fontSize, maxWidth, layer);
  const width = Math.max(fontSize * 0.5, ...lineWidths);
  const height = Math.max(fontSize * layer.typography.lineHeight, lineWidths.length * fontSize * layer.typography.lineHeight);
  const angle = Math.abs((layer.rotation ?? 0) * Math.PI / 180);
  return {
    width: Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)),
    height: Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)),
    lineCount: lineWidths.length,
  };
};

// calculateTextLayout runs a binary search and is called per layer per frame by the
// composition. Cache by the inputs that actually change the result (font family and
// alignment do not affect the width heuristic).
const layoutCache = new Map<string, TextLayoutResult>();
const LAYOUT_CACHE_LIMIT = 240;

const layoutCacheKey = (layer: TextLayer, format: VideoFormat) => {
  const t = layer.typography;
  return [
    format.width, format.height, layer.text, layer.autoFit, layer.autoLineBreak,
    layer.maxWidth, layer.maxHeight, layer.safeZone, layer.positionX, layer.positionY, layer.rotation,
    t.fontSize, t.letterSpacing, t.wordSpacing, t.lineHeight,
  ].join('|');
};

export const calculateTextLayout = (layer: TextLayer, format: VideoFormat): TextLayoutResult => {
  const cacheKey = layoutCacheKey(layer, format);
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;
  const result = computeTextLayout(layer, format);
  if (layoutCache.size >= LAYOUT_CACHE_LIMIT) layoutCache.clear();
  layoutCache.set(cacheKey, result);
  return result;
};

const computeTextLayout = (layer: TextLayer, format: VideoFormat): TextLayoutResult => {
  const safeZone = clamp(layer.safeZone ?? 0.08, 0, 0.3);
  const maxWidthRatio = clamp(layer.maxWidth ?? 0.84, 0.2, 1);
  const maxHeightRatio = clamp(layer.maxHeight ?? 0.84, 0.1, 1);
  const safeLeft = format.width * safeZone;
  const safeTop = format.height * safeZone;
  const centerX = format.width / 2 + (layer.positionX ?? 0);
  const centerY = format.height / 2 + (layer.positionY ?? 0);
  const safeWidthAtPosition = Math.max(1, 2 * Math.min(centerX - safeLeft, format.width - safeLeft - centerX));
  const safeHeightAtPosition = Math.max(1, 2 * Math.min(centerY - safeTop, format.height - safeTop - centerY));
  const maxWidth = Math.max(1, Math.min(format.width * maxWidthRatio, safeWidthAtPosition));
  const maxHeight = Math.max(1, Math.min(format.height * maxHeightRatio, safeHeightAtPosition));
  const requestedSize = clamp(layer.typography.fontSize, 8, 1000);

  let fontSize = requestedSize;
  let measured = measure(layer, fontSize, maxWidth);
  const fits = () => measured.width <= maxWidth + 0.5 && measured.height <= maxHeight + 0.5;
  if (layer.autoFit && !fits()) {
    let low = 8;
    let high = requestedSize;
    for (let index = 0; index < 18; index += 1) {
      const candidate = (low + high) / 2;
      const candidateMeasure = measure(layer, candidate, maxWidth);
      if (candidateMeasure.width <= maxWidth && candidateMeasure.height <= maxHeight) low = candidate;
      else high = candidate;
    }
    fontSize = Math.max(8, Math.floor(low * 10) / 10);
    measured = measure(layer, fontSize, maxWidth);
  }

  const overflowX = measured.width > maxWidth + 0.5;
  const overflowY = measured.height > maxHeight + 0.5;
  return {
    fontSize,
    width: measured.width,
    height: measured.height,
    maxWidth,
    maxHeight,
    lineCount: measured.lineCount,
    overflowX,
    overflowY,
    overflow: overflowX || overflowY,
    wasAutoFitted: fontSize < requestedSize - 0.1,
  };
};
