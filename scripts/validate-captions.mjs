import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Browser sources use bundler-style imports; this resolver only runs in the test process.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { groupWords, removeFillerWords } = await import('../src/captions/group.ts');
const { pagesToLayers } = await import('../src/captions/toLayers.ts');
const { fromElevenLabs, fromGroq } = await import('../src/captions/providers.ts');
const { remapWordTiming, splitWordTiming } = await import('../src/utils/editor.ts');
const { evenWordTiming } = await import('../src/engine/editorMotion.ts');
const { createTextLayer, overridesFor } = await import('../src/remotion/defaults.ts');
const { calculateTextLayout } = await import('../src/engine/textLayout.ts');
const { getAnimationPhase } = await import('../src/engine/layerAnimation.ts');
const { builtInPresets } = await import('../src/presets/builtins.ts');
const { parseProjectFile, serializeProject } = await import('../src/utils/project.ts');
const { wordHighlightCss } = await import('../src/engine/wordHighlight.ts');
const { normalizeTypography } = await import('../src/engine/textPaint.ts');

const word = (text, startMs, endMs) => ({ text, startMs, endMs, confidence: null });
const sequence = (texts, step = 300, gap = 20) => texts.map((text, i) => word(text, i * (step + gap), i * (step + gap) + step));

/* --- Agrupación --- */
{
  const words = sequence(['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete']);
  const byCount = groupWords(words, { maxWords: 3, maxChars: 42, maxDurationMs: 60000, minDurationMs: 0 });
  assert.deepEqual(byCount.map((page) => page.words.length), [3, 3, 1], 'grouping by word count');
  assert.equal(groupWords(words, { maxWords: 20 })[0].words.length <= 8, true, 'maxWords is capped at 8');

  const long = sequence(['extraordinariamente', 'complicado', 'imposible', 'sí']);
  const byChars = groupWords(long, { maxWords: 8, maxChars: 20, maxDurationMs: 60000 });
  assert(byChars.every((page) => page.text.length <= 20 || page.words.length === 1), 'grouping by characters');
  assert(byChars.length >= 3);

  const gap = [word('hola', 0, 300), word('amigos', 350, 700), word('ahora', 1600, 1900), word('sí', 1950, 2200)];
  const onSilence = groupWords(gap, { maxWords: 8, maxChars: 42 });
  assert.deepEqual(onSilence.map((page) => page.text), ['hola amigos', 'ahora sí'], 'grouping on silence');
  assert.equal(groupWords(gap, { maxWords: 8, maxChars: 42, breakOnSilenceMs: Infinity, maxDurationMs: 60000 }).length, 1, 'silence break can be off');

  const punctuated = sequence(['Hola', 'a', 'todos.', 'Vamos', 'a', 'ver,', 'qué', 'pasa']);
  const onPunct = groupWords(punctuated, { maxWords: 8, maxChars: 42, maxDurationMs: 60000 });
  assert.deepEqual(onPunct.map((page) => page.text), ['Hola a todos.', 'Vamos a ver,', 'qué pasa'], 'grouping on punctuation (comma only after 2+ words)');
  const comma = groupWords(sequence(['Sí,', 'claro', 'que', 'sí']), { maxWords: 8, maxChars: 42, maxDurationMs: 60000 });
  assert.equal(comma[0].text, 'Sí, claro que sí', 'a comma after the first word does not split');
  assert.equal(groupWords(punctuated, { maxWords: 8, maxChars: 42, maxDurationMs: 60000, breakOnPunctuation: false }).length, 1);

  const withFillers = sequence(['Eh', 'bueno', 'este', 'mm', 'o', 'sea', 'Hmm,', 'sí']);
  assert.deepEqual(removeFillerWords(withFillers).map((w) => w.text), ['bueno', 'este', 'o', 'sea', 'sí'], 'fillers removed, meaningful words kept');
  assert.equal(groupWords(withFillers, { maxWords: 8, removeFillers: true })[0].text.includes('mm'), false);
  assert(groupWords(withFillers, { maxWords: 8, removeFillers: false })[0].text.includes('Eh'));

  const tiny = groupWords([word('a', 0, 50), word('b', 2000, 2100)], { minDurationMs: 300 });
  assert.equal(tiny[0].endMs, 300, 'short pages are stretched');
}

/* --- Frases con tiempos pegados --- */
{
  const template = createTextLayer('x', 'tpl');
  template.keywords = { 0: { word: 'x', color: '#ff0000', fontSizeScale: 1, fontWeight: 700 } };
  template.wordTiming = { mode: 'karaoke', color: '#00ff00', words: [] };
  let n = 0;
  const pages = groupWords(fromElevenLabs(JSON.parse(readFileSync('scripts/fixtures/elevenlabs-es.json', 'utf8'))), { maxWords: 3 });
  const layers = pagesToLayers(pages, template, () => `id-${n++}`);
  assert.equal(layers.length, pages.length);
  layers.forEach((layer, index) => {
    const timing = layer.wordTiming;
    assert.equal(timing.words.length, layer.text.split(/\s+/).length, 'word timing count = word count');
    assert.equal(timing.mode, 'karaoke');
    assert.equal(timing.color, '#00ff00');
    assert.deepEqual(layer.keywords, {}, 'keywords reset');
    assert.equal(timing.words[0].start, 0);
    assert.equal(timing.words.at(-1).end, layer.durationFrames, 'last word ends with the clip');
    timing.words.forEach((w, i) => {
      assert(w.end > w.start, 'each word lasts at least one frame');
      if (i > 0) assert.equal(w.start, timing.words[i - 1].end, 'contiguous word frames');
    });
    const next = layers[index + 1];
    if (next) assert(layer.startFrame + layer.durationFrames <= next.startFrame, 'captions never overlap');
  });
  assert.equal(layers[0].startFrame, Math.round(pages[0].startMs * 0.03));
  assert.equal(pagesToLayers([pages[0]], createTextLayer('x', 't'), () => 'a')[0].wordTiming.color, '#ffe94a', 'default highlight color');
  // Un hueco corto se cierra; uno largo deja la cola de 200 ms.
  const close = pagesToLayers([{ text: 'a', startMs: 0, endMs: 500, words: [word('a', 0, 500)] }, { text: 'b', startMs: 600, endMs: 900, words: [word('b', 600, 900)] }], template, () => 'c');
  assert.equal(close[0].durationFrames, 18, 'gap <= 250 ms extends to the next start');
  const far = pagesToLayers([{ text: 'a', startMs: 0, endMs: 500, words: [word('a', 0, 500)] }, { text: 'b', startMs: 2000, endMs: 2300, words: [word('b', 2000, 2300)] }], template, () => 'd');
  assert.equal(far[0].durationFrames, 21, 'long gap keeps a 200 ms tail');
}

/* --- remapWordTiming / splitWordTiming (B4, B5) --- */
{
  const base = evenWordTiming('HOLA A TODOS', 90);
  const grown = remapWordTiming('HOLA A TODOS', 'HOLA A TODOS USTEDES', base, 90);
  assert.deepEqual(grown.words.slice(0, 3).map((w) => w.start), [0, 30, 60], 'original starts survive');
  assert.equal(grown.words.length, 4);
  assert.equal(grown.words[3].word, 'USTEDES');
  assert.equal(grown.words.at(-1).end, 90);
  const monotonic = (timing, total) => timing.words.every((w, i) => w.end > w.start && (i === 0 || w.start >= timing.words[i - 1].end)) && timing.words.at(-1).end === total;
  assert(monotonic(grown, 90));
  const shrunk = remapWordTiming('HOLA A TODOS', 'HOLA TODOS', base, 90);
  assert.deepEqual(shrunk.words.map((w) => [w.word, w.start, w.end]), [['HOLA', 0, 60], ['TODOS', 60, 90]], 'deleted words merge into the previous one');
  const inserted = remapWordTiming('HOLA A TODOS', 'HOLA YA A TODOS', base, 90);
  assert.deepEqual(inserted.words.map((w) => w.start), [0, 15, 30, 60]);
  assert(monotonic(inserted, 90));
  assert.equal(remapWordTiming('HOLA A TODOS', '   ', base, 90), undefined, 'empty text has no timing');
  const rewritten = remapWordTiming('HOLA A TODOS', 'ADIOS AMIGOS', base, 90);
  assert.equal(rewritten.words.length, 2, 'nothing matches: even fallback');
  assert(monotonic(rewritten, 90));
  assert.equal(remapWordTiming('HOLA A TODOS', 'HOLA, a todos', base, 90).words[0].word, 'HOLA,', 'punctuation edits keep timing');
  assert.deepEqual(remapWordTiming('HOLA A TODOS', 'hola a todos', { ...base, mode: 'reveal', color: '#123456' }, 90).words.map((w) => w.start), [0, 30, 60]);
  assert.equal(remapWordTiming('HOLA A TODOS', 'HOLA A TODOS', { ...base, mode: 'reveal', color: '#123456' }, 90).mode, 'reveal', 'mode and color are kept');

  const [first, second] = splitWordTiming(base, 40);
  assert.deepEqual(first.words.map((w) => [w.word, w.start]), [['HOLA', 0], ['A', 30]]);
  assert.equal(first.words.at(-1).end, 40);
  assert.deepEqual(second.words.map((w) => [w.word, w.start]), [['TODOS', 20]], 'second half is rebased (60 - 40)');
  assert.equal(60 - 40, second.words[0].start);
  assert.deepEqual(splitWordTiming(undefined, 10), [undefined, undefined]);
}

/* --- Providers --- */
{
  const eleven = fromElevenLabs(JSON.parse(readFileSync('scripts/fixtures/elevenlabs-es.json', 'utf8')));
  assert(eleven.length >= 39, 'ElevenLabs words');
  assert(eleven.every((w) => w.text && w.endMs >= w.startMs && w.confidence > 0 && w.confidence <= 1), 'confidence = exp(logprob)');
  assert.equal(eleven.some((w) => w.text === '(risas)' || w.text === ' '), false, 'only type word');
  assert.equal(eleven[0].text, 'Hola,');
  assert.equal(eleven[0].startMs, 420);
  assert.equal(fromElevenLabs({}).length, 0);

  const groq = fromGroq(JSON.parse(readFileSync('scripts/fixtures/groq-es.json', 'utf8')));
  assert.equal(groq.length, 39);
  assert.equal(groq[0].text, 'Hola,', 'Groq punctuation recovery');
  assert.equal(groq[1].text, '¿cómo', 'opening question mark recovered');
  assert.equal(groq[2].text, 'están?');
  assert(groq.some((w) => w.text === 'empezar.'));
  assert(groq.every((w) => w.confidence === null));
  const mismatch = fromGroq({ text: 'Hola, mundo.', words: [{ word: 'Hola', start: 0, end: 0.4 }, { word: 'inventada', start: 0.5, end: 0.9 }, { word: 'mundo', start: 1, end: 1.4 }] });
  assert.deepEqual(mismatch.map((w) => w.text), ['Hola,', 'inventada', 'mundo.'], 'raw word kept on mismatch, alignment continues');
  const pages = groupWords(groq, { maxWords: 3 });
  assert(pages.every((page) => page.words.length <= 3));
}

/* --- Autoajuste con mayúsculas (B6) --- */
{
  const layer = createTextLayer('abcdefghij'.repeat(6), 'fit');
  assert(layer.text.length >= 60);
  layer.typography = { ...layer.typography, fontSize: 300 };
  const format = { id: 'portrait', label: 'x', width: 1080, height: 1920 };
  const upper = calculateTextLayout({ ...layer, typography: { ...layer.typography, uppercase: true } }, format);
  const lower = calculateTextLayout({ ...layer, typography: { ...layer.typography, uppercase: false } }, format);
  assert(upper.fontSize < lower.fontSize, `uppercase must fit smaller (${upper.fontSize} vs ${lower.fontSize})`);
}

/* --- Salida anclada al final del clip (B7) --- */
{
  const preset = builtInPresets.find((p) => p.id === 'depth-punch');
  const segment = { preset, overrides: { ...overridesFor(preset), duration: 18, delay: 0, mode: 'text' } };
  const layer = createTextLayer('FRASE', 'exit', preset);
  layer.animation = { in: segment, holdFrames: 30, out: segment, loop: null };
  layer.durationFrames = 120;
  assert.equal(getAnimationPhase(layer, 110).kind, 'out');
  assert.equal(getAnimationPhase(layer, 60).kind, 'hold');
  assert.equal(getAnimationPhase(layer, 10).kind, 'in');
  const short = { ...layer, durationFrames: 20 };
  assert.equal(getAnimationPhase(short, 19).kind, 'out', 'clips shorter than in+out: the exit starts at max(in, duration - out)');
  const auto = { ...layer, durationFrames: undefined };
  assert.equal(getAnimationPhase(auto, 60).kind, 'out', 'auto clips keep holdFrames (18 + 30 = 48)');
  assert.equal(getAnimationPhase(auto, 40).kind, 'hold');
}

/* --- Modos de resaltado --- */
{
  const timing = (mode) => ({ mode, color: '#ffe94a', words: [{ word: 'UNO', start: 0, end: 30 }, { word: 'DOS', start: 30, end: 60 }, { word: 'TRES', start: 60, end: 90 }] });
  const paint = normalizeTypography(createTextLayer('x', 'p').typography);
  assert.equal(wordHighlightCss(timing('reveal'), 0, 20, paint).visibility, undefined);
  assert.equal(wordHighlightCss(timing('reveal'), 1, 20, paint).visibility, 'hidden', 'reveal hides unspoken words with visibility');
  assert.equal(wordHighlightCss(timing('karaoke'), 0, 50, paint).color, '#ffe94a');
  assert.equal(wordHighlightCss(timing('karaoke'), 1, 50, paint).color, '#ffe94a');
  assert.equal(wordHighlightCss(timing('karaoke'), 2, 50, paint).color, undefined);
  const scaled = wordHighlightCss(timing('scale'), 1, 50, paint);
  assert.match(scaled.transform, /scale\(1\.15\)/);
  assert.equal(scaled.display, 'inline-block');
  assert(scaled.textShadow !== undefined || scaled.WebkitTextStroke !== undefined || scaled.backgroundClip !== undefined, 'scaled word carries its own paint');
  assert.equal(wordHighlightCss(timing('scale'), 0, 50, paint).transform, undefined);
  assert.equal(wordHighlightCss(timing('box'), 1, 50, paint).backgroundColor, '#ffe94a');
  assert.equal(wordHighlightCss(timing('color'), 1, 50, paint).color, '#ffe94a');
  assert.deepEqual(wordHighlightCss(timing('color'), 0, 50, paint), {});

  for (const mode of ['color', 'box', 'karaoke', 'reveal', 'scale']) {
    const layer = createTextLayer('UNO DOS TRES', `m-${mode}`);
    layer.wordTiming = timing(mode);
    const state = { name: 'Modos', layers: [layer], activeLayerId: layer.id, background: 'black', customBackground: '#000000', formatId: 'portrait' };
    assert.equal(parseProjectFile(serializeProject(state)).layers[0].wordTiming.mode, mode, `${mode} survives parseProjectFile`);
  }
  const bad = createTextLayer('UNO', 'bad');
  bad.wordTiming = { mode: 'explota', color: '#ffe94a', words: [{ word: 'UNO', start: 0, end: 30 }] };
  assert.equal(parseProjectFile(serializeProject({ name: 'x', layers: [bad], activeLayerId: 'bad', background: 'black', customBackground: '#000000', formatId: 'portrait' })).layers[0].wordTiming, undefined, 'unknown modes are dropped');
}

console.log('CAPTIONS_OK grouping=ok frames=contiguous remap=ok providers=ok uppercase=ok exit=anchored modes=ok');
