import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Browser sources use bundler-style imports; this resolver only runs in the test process.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { cloneLayer, EditorHistory, MAX_LAYERS, remapKeywords } = await import('../src/utils/editor.ts');
const { createTextLayer } = await import('../src/remotion/defaults.ts');
const { parseProjectFile, serializeProject, saveProject } = await import('../src/utils/project.ts');
const { defaultLoop } = await import('../src/engine/loopMotion.ts');
const { parseSubtitles, exportSubtitles, scriptToCues } = await import('../src/utils/subtitles.ts');
const { revealClip } = await import('../src/engine/reveal.ts');
const { extraMotionPresets } = await import('../src/presets/extraMotion.ts');
const { sampleTransform, neutralTransform, evenWordTiming, activeWord, alignLayers, distributeLayers } = await import('../src/engine/editorMotion.ts');

const layer = createTextLayer('si podemos', 'test-1');
layer.animation.loop = defaultLoop('wave');
layer.keywords = { 0: { word: 'si', color: '#ffff00', fontSizeScale: 1.1, fontWeight: 900 } };
const copy = cloneLayer(layer);
copy.animation.loop.speed = 2;
copy.typography.strokes[0].width = 20;
assert.notEqual(copy.animation.loop.speed, layer.animation.loop.speed);
assert.notEqual(copy.typography.strokes[0].width, layer.typography.strokes[0].width);
assert.deepEqual(cloneLayer(layer), layer);
layer.transformKeys = [{ ...neutralTransform, easing: 'linear' }, { ...neutralTransform, frame: 60, x: 120, opacity: 0.5 }];
layer.wordTiming = evenWordTiming(layer.text, 60);
assert.equal(sampleTransform(layer.transformKeys, 30).x, 60);
assert.equal(sampleTransform(layer.transformKeys, 30).opacity, 0.75);
assert.equal(sampleTransform(layer.transformKeys, 90).x, 120);
assert.deepEqual(sampleTransform(undefined, 30), neutralTransform);
assert.equal(activeWord(layer.wordTiming, 29), 0);
assert.equal(activeWord(layer.wordTiming, 30), 1);
assert.equal(activeWord(layer.wordTiming, 60), -1);
const positioned = [0, 15, 100, 200].map((positionX, i) => ({ ...cloneLayer(layer), id: String(i), positionX, locked: i === 3 }));
assert.deepEqual(distributeLayers(positioned, ['0','1','2','3'], 'x').map((l) => l.positionX), [0, 50, 100, 200]);
assert.deepEqual(alignLayers(positioned, ['0','1','2','3'], 'x', 0).map((l) => l.positionX), [0, 0, 0, 200]);
const state = { name: 'Prueba', layers: Array.from({ length: MAX_LAYERS }, (_, i) => ({ ...cloneLayer(layer), id: `layer-${i}`, startFrame: i * 30 })), activeLayerId: 'layer-11', background: 'black', customBackground: '#000000', formatId: 'portrait' };
const restored = parseProjectFile(serializeProject(state));
assert.equal(restored.layers.length, MAX_LAYERS);
assert.equal(restored.activeLayerId, 'layer-11');
assert.deepEqual(restored.layers[11].animation.loop, layer.animation.loop);
assert.equal(restored.name, 'Prueba');
assert.deepEqual(restored.layers[0].wordTiming, layer.wordTiming);
assert.deepEqual(restored.layers[0].transformKeys, layer.transformKeys);
assert.equal(parseProjectFile(serializeProject({ ...state, layers: [...state.layers, layer] })), null);
assert.equal(parseProjectFile('broken'), null);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() { throw new Error('Quota exceeded'); } } });
assert.equal(saveProject(state), false, 'Saving failure must reach the UI');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() {} } });
assert.equal(saveProject(state), true);

const history = new EditorHistory({ layers: [layer], background: 'black' });
history.observe({ layers: [{ ...layer, text: 'a' }], background: 'black' }, 1);
history.observe({ layers: [{ ...layer, text: 'abc' }], background: 'black' }, 1);
history.observe({ layers: [{ ...layer, text: 'abc' }], background: 'white' }, 2);
assert.equal(history.undo().background, 'black');
const original = history.undo();
assert.equal(original.layers[0].text, 'si podemos');
assert.deepEqual(original.layers[0].animation.loop, layer.animation.loop);
assert.equal(history.redo().layers[0].text, 'abc');
history.observe({ layers: [layer], background: 'green' }, 3);
assert.equal(history.canRedo, false);
const highlights = remapKeywords('si podemos', 'Hoy sí, podemos', layer.keywords);
assert.equal(highlights[1].word, 'sí,');
assert.equal(highlights[1].color, '#ffff00');
assert.deepEqual(remapKeywords('si podemos', 'podemos', layer.keywords), {});

const short = parseSubtitles('1\n00:00:01,000 --> 00:00:01,200\n¡Hola!\n\n2\n00:00:02,000 --> 00:00:04,000\nSegunda línea');
assert.equal(short[0].durationFrames, 6, 'Short captions must retain precise timing');
const timed = short.map((cue, i) => ({ ...cloneLayer(layer), ...cue, id: `cue-${i}` }));
assert.deepEqual(parseSubtitles(exportSubtitles(timed, 'srt')), short);
assert.deepEqual(parseSubtitles(exportSubtitles(timed, 'vtt')), short);
assert.equal(parseProjectFile(serializeProject({ ...state, layers: timed })).layers[0].durationFrames, 6);
assert.throws(() => parseSubtitles('1\n00:00:05,000 --> 00:00:02,000\nBad'));
assert.throws(() => scriptToCues('x'.repeat(181), 0, 3));
assert.equal(scriptToCues('Primera\n\nSegunda', 45, 2)[1].startFrame, 105);
assert.equal(revealClip(layer.preset, 0), undefined);
for (const p of extraMotionPresets.filter((p) => p.mask)) {
  assert.equal(revealClip(p, p.intent === 'out' ? 0 : p.duration), undefined);
  assert(revealClip(p, p.duration / 2).startsWith('inset('));
}
console.log(`EDITOR_OK layers=${MAX_LAYERS} clone=deep history=grouped highlights=preserved storage=reported subtitles=roundtrip masks=deterministic`);
