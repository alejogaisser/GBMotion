import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { reviewCaptions } = await import('../src/engine/captionReview.ts');
const { createTextLayer } = await import('../src/remotion/defaults.ts');
const make = (text, id, durationFrames = 30) => ({ ...createTextLayer(text, id), durationFrames });
const layers = [make('X'.repeat(25), 'fast'), { ...make('PALABRA', 'outside'), wordTiming: { mode: 'color', color: '#FFE94A', words: [{ word: 'PALABRA', start: -1, end: 31 }] } }, make('', 'empty'), make('UNO', 'short', 12)];
const before = structuredClone(layers);
const issues = reviewCaptions(layers, 30);
for (const [id, code] of [['fast', 'too_fast'], ['outside', 'timing_outside_clip'], ['empty', 'empty_visible'], ['short', 'too_short']]) assert(issues.some((i) => i.layerId === id && i.code === code));
assert.deepEqual(layers, before);
assert.deepEqual(reviewCaptions([{ ...layers[0], visible: false }], 30), []);
assert.deepEqual(reviewCaptions([make('UNO DOS', 'valid', 90)], 30), []);
assert.deepEqual(reviewCaptions([layers[0]], 30, { maxCharsPerSecond: 30 }), []);
const timed = (id, startFrame) => ({ ...make('UNO', id), startFrame, wordTiming: { mode: 'color', color: '#FFE94A', words: [{ word: 'UNO', start: 0, end: 30 }] } });
const overlap = reviewCaptions([timed('a', 0), timed('b', 15), make('UNO', 'plain')], 30);
assert.deepEqual(overlap.filter((i) => i.code === 'time_overlap').map((i) => i.layerId), ['a', 'b']);
assert.deepEqual(reviewCaptions([timed('a', 0), timed('b', 30)], 30), []);
assert.deepEqual(reviewCaptions(layers, 0), []);
assert(issues.every((i) => i.severity === 'warning' && Number.isFinite(i.startFrame)));
console.log('CAPTION_REVIEW_OK AC14 AC35 (heuristics, immutability, hidden, timed overlap)');
