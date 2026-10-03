import assert from 'node:assert/strict';
import { builtInPresets } from '../src/presets/builtins.ts';
import { interpolatePreset } from '../src/engine/interpolatePreset.ts';
import { buildMotionTransform, defaultMotionValues, motionValueBounds, motionValueKeys, transformOrder } from '../src/engine/motionModel.ts';
import { resolvePreset } from '../src/engine/resolvePreset.ts';
import { validateMotionPreset } from '../src/engine/validation.ts';
import { getAnimationPhase, getAnimationTimelineDuration } from '../src/engine/layerAnimation.ts';
import { splitGraphemes, tokensForMode } from '../src/utils/textSegmentation.ts';
import { calculateTextLayout } from '../src/engine/textLayout.ts';
import { getCompositionDuration, getLayerDuration, isAutoDuration } from '../src/utils/duration.ts';

// El inventario V1 no se puede perder: los proyectos guardados referencian estos
// ids, y si alguno desaparece la capa cae al preset por defecto sin avisar.
// Sumar presets nuevos sí está permitido, así que se comprueba la presencia de
// cada id y la unicidad, no la cantidad total.
const V1_PRESET_IDS = [
  'depth-punch', 'camera-slam', 'elastic-pop', 'hard-zoom', 'diagonal-hit',
  'blur-reveal', 'perspective-zoom', 'bottom-punch', 'word-cascade', 'letter-impact',
  'side-swipe', 'hero-word', 'word-rain', 'word-sphere', 'random-riot',
  'orbit-slam', 'glitch-crush', 'meteor-drop', 'letter-storm', 'epic-rise',
];
const presetIds = new Set(builtInPresets.map((preset) => preset.id));
for (const id of V1_PRESET_IDS) {
  assert(presetIds.has(id), `The V1 preset "${id}" must remain in the inventory`);
}
assert.equal(presetIds.size, builtInPresets.length, 'Preset ids must be unique');

for (const preset of builtInPresets) {
  const validation = validateMotionPreset(preset);
  assert.equal(validation.valid, true, `${preset.id}: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join(', ')}`);
  for (let frame = 0; frame <= preset.duration; frame += 0.05) {
    const values = interpolatePreset(preset, frame);
    for (const key of motionValueKeys) {
      assert(Number.isFinite(values[key]), `${preset.id}.${key} returned a non-finite value at ${frame}`);
      const [minimum, maximum] = motionValueBounds[key];
      assert(values[key] >= minimum && values[key] <= maximum, `${preset.id}.${key} left its domain at ${frame}`);
    }
  }
}

const segmentPreset = {
  id: 'segment-test', name: 'Segment test', category: 'SLIDE', description: 'test', duration: 20,
  mode: 'text', staggerDelay: 0, easing: 'linear',
  keyframes: [
    { frame: 0, x: 0, easingToNext: 'linear' },
    { frame: 10, x: 100, easingToNext: 'easeIn' },
    { frame: 20, x: 200 },
  ],
};
assert.equal(interpolatePreset(segmentPreset, 5).x, 50, 'First interval must use its own linear easing');
assert.equal(interpolatePreset(segmentPreset, 15).x, 112.5, 'Second interval must use its own easeIn easing');

const invalidPreset = structuredClone(segmentPreset);
invalidPreset.keyframes[0].blur = -1;
invalidPreset.keyframes[1].scale = -2;
invalidPreset.keyframes[1].perspective = 0;
invalidPreset.keyframes[1].opacity = Number.POSITIVE_INFINITY;
invalidPreset.keyframes[2].frame = 21;
const invalidResult = validateMotionPreset(invalidPreset);
assert.equal(invalidResult.valid, false);
for (const field of ['blur', 'scale', 'perspective', 'opacity', 'frame']) {
  assert(invalidResult.issues.some((issue) => issue.path.endsWith(field)), `Validator must reject invalid ${field}`);
}

const baseOverrides = {
  duration: 20, delay: 12, initialScale: 1, scaleX: 1, scaleY: 1, x: 0, y: 0, translateZ: 80,
  rotation: 0, opacity: 1, blur: 0, skewX: 0, skewY: 0, animatedLetterSpacing: 0, overshoot: 1,
  perspective: 900, rotateX: 0, rotateY: 0, transformOriginX: 50, transformOriginY: 50, anchor: 'TOP_LEFT',
  spring: 0, bounce: 0, staggerDelay: 0, mode: 'text', easing: 'linear',
};
const resolved = resolvePreset(segmentPreset, baseOverrides);
assert.equal(resolved.delay, 12, 'Delay must be modeled separately');
assert.equal(resolved.keyframes[0].frame, 0);
assert.equal(resolved.keyframes.at(-1).frame, resolved.duration, 'Resolved keyframes must stay inside duration');
assert.equal(resolved.keyframes[0].transformOriginX, 0);
assert.equal(resolved.keyframes[0].transformOriginY, 0);

const transform = buildMotionTransform({ ...defaultMotionValues, x: 10, y: 20, translateZ: 30, perspective: 800 });
assert.deepEqual(transformOrder, ['perspective', 'translate3d', 'rotateX', 'rotateY', 'rotate', 'skew', 'scale', 'scaleX', 'scaleY']);
assert(transform.startsWith('perspective(800px) translate3d(10px, 20px, 30px)'), 'Transform must use the canonical order and real perspective');

assert.equal(splitGraphemes('👨‍👩‍👧‍👦').length, 1, 'A family emoji must remain one grapheme');
assert.equal(splitGraphemes('🇦🇷').length, 1, 'A flag must remain one grapheme');
assert.equal(splitGraphemes('e\u0301').length, 1, 'A decomposed accent must remain one grapheme');
const manualLines = 'UNO\nDOS palabras';
assert.equal(tokensForMode(manualLines, 'words').map((token) => token.content).join(''), manualLines, 'Word mode must preserve manual line breaks and spaces');

const outPreset = builtInPresets.find((preset) => preset.id === 'camera-slam');
assert(outPreset);
const animatedLayer = {
  id: 'timeline-test', name: 'Timeline', text: 'UNO DOS', visible: true, positionX: 0, positionY: 0, keywords: {}, typography: {},
  preset: segmentPreset, overrides: baseOverrides,
  animation: {
    in: { preset: segmentPreset, overrides: { ...baseOverrides, delay: 0, duration: 20 } },
    holdFrames: 30,
    out: { preset: outPreset, overrides: { ...baseOverrides, delay: 0, duration: 18 } },
  },
};
assert.equal(getAnimationTimelineDuration(animatedLayer), 68);
assert.equal(getAnimationPhase(animatedLayer, 5).kind, 'in');
assert.equal(getAnimationPhase(animatedLayer, 25).kind, 'hold');
assert.equal(getAnimationPhase(animatedLayer, 55).kind, 'out');
assert.equal(getAnimationPhase(animatedLayer, 55).reverse, false, 'A native OUT preset must play forward');
const reversedLayer = { ...animatedLayer, animation: { ...animatedLayer.animation, out: animatedLayer.animation.in } };
assert.equal(getAnimationPhase(reversedLayer, 55).reverse, true, 'An IN preset selected as OUT must play in reverse');

const layoutCases = [
  'ROBOT',
  'EMPEZAR DE CERO',
  'ESTOY CONSTRUYENDO UN BRAZO ROBÓTICO',
  'ESTA ES UNA FRASE DE PRUEBA MUY LARGA PENSADA PARA SUPERAR LOS CIEN CARACTERES SIN SALIRSE JAMÁS DEL VIDEO',
  'PRIMERA LÍNEA\nSEGUNDA LÍNEA MANUAL\nTERCERA LÍNEA',
];
const formats = [
  { id: 'portrait', label: '9:16', width: 1080, height: 1920 },
  { id: 'landscape', label: '16:9', width: 1920, height: 1080 },
  { id: 'square', label: '1:1', width: 1080, height: 1080 },
];
const createLayoutLayer = (text, id) => ({
  id, name: text, text, positionX: 0, positionY: 0, rotation: 0,
  maxWidth: 0.84, maxHeight: 0.84, safeZone: 0.08, autoFit: true, autoLineBreak: true,
  typography: { fontSize: 150, letterSpacing: -3, wordSpacing: 0, lineHeight: 0.9 },
});
for (const format of formats) {
  for (const text of layoutCases) {
    const layer = createLayoutLayer(text, `layout-${format.id}`);
    layer.typography.fontSize = 240;
    const layout = calculateTextLayout(layer, format);
    assert.equal(layout.overflow, false, `${format.id}: auto layout must fit ${text}`);
    assert(layout.fontSize >= 8 && layout.fontSize <= 240, `${format.id}: fitted size must stay valid`);
  }
}
const manualLayout = createLayoutLayer('UNO\nDOS\nTRES', 'manual-layout');
assert.equal(calculateTextLayout(manualLayout, formats[0]).lineCount, 3, 'Manual line breaks must be preserved by auto layout');
const unsafeLayout = createLayoutLayer('ESTE TEXTO DELIBERADAMENTE LARGO NO DEBE ENTRAR', 'unsafe-layout');
unsafeLayout.typography.fontSize = 360;
unsafeLayout.autoFit = false;
unsafeLayout.autoLineBreak = false;
assert.equal(calculateTextLayout(unsafeLayout, formats[0]).overflow, true, 'Overflow must be detected when automatic protection is disabled');
assert.equal(getCompositionDuration([{ visible: true, startFrame: 45, durationFrames: 60 }]), 105, 'Composition duration must include clip start and duration');
assert.equal(getCompositionDuration([{ visible: true, startFrame: 0, durationFrames: 30 }]), 90, 'A short project must keep the simple three-second timeline');

// Auto duration: no durationFrames means the clip follows the animation (in + hold + out).
assert.equal(isAutoDuration({ ...animatedLayer, durationFrames: undefined }), true, 'A layer without durationFrames must be auto');
assert.equal(isAutoDuration({ ...animatedLayer, durationFrames: 120 }), false, 'A manual durationFrames must disable auto');
assert.equal(
  getLayerDuration({ ...animatedLayer, durationFrames: undefined }),
  Math.max(90, getAnimationTimelineDuration(animatedLayer) + 15),
  'Auto clip length must track the animation, floored at the project minimum',
);
assert.equal(getLayerDuration({ ...animatedLayer, durationFrames: 200 }), 200, 'A manual clip length must win over the animation');
const longHoldLayer = { ...animatedLayer, animation: { ...animatedLayer.animation, holdFrames: 240 } };
assert.equal(getLayerDuration({ ...longHoldLayer, durationFrames: undefined }) > 240, true, '"Tiempo visible" must extend an auto clip');

console.log(`MOTION_ENGINE_OK presets=${builtInPresets.length} sampledStep=0.05 graphemes=ok phases=in>hold>out layouts=${layoutCases.length * formats.length} transformOrder=${transformOrder.join('>')}`);
