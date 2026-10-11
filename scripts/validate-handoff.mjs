import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { encodeHandoff, decodeHandoff, validateHandoff, parseHandoffFragment, applyHandoffToLayer, checkStyleShare, buildStyleLink, payloadFromTemplateId, sanitizeTypography, knownTemplateIds } = await import('../src/utils/handoff.ts');
const { captionTemplates, brokenTemplateRefs, resolveTemplateParts, applyTemplateToLayers, evenWordTiming } = await import('../src/presets/templates.ts');
const { createTextLayer } = await import('../src/remotion/defaults.ts');
const { defaultLoop } = await import('../src/engine/loopMotion.ts');
const failures = []; let checks = 0;
const check = (name, run) => { checks++; try { run(); } catch (error) { failures.push({ name, message: error.message }); console.error(`HANDOFF_FAIL ${name}: ${error.message}`); } };
const rawEncode = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString('base64url');
const baseStyle = payloadFromTemplateId('amarillo-impacto');
const valid = { style: baseStyle, phrase: '¿QUÉ PASÓ? ÑANDÚ 🛠️' };
const mutate = (fn) => { const value = structuredClone(valid); fn(value); return value; };
const rejected = (value, reason = 'bad-fields') => assert.deepEqual(decodeHandoff(rawEncode(value)), { ok: false, reason });

check('AC23 encoding and length boundaries', () => {
  for (const hash of ['', '#', '#demo=', '#estilo=']) assert.deepEqual(decodeHandoff(hash), { ok: false, reason: 'empty' });
  for (const hash of ['%', '@abc', 'abc=', 'a', 'abc+/', Buffer.from([0xff, 0xfe]).toString('base64url')]) assert.deepEqual(decodeHandoff(hash), { ok: false, reason: 'bad-encoding' });
  for (const hash of [rawEncode('{broken'), rawEncode('null'), rawEncode('[]'), rawEncode('42')]) assert.deepEqual(decodeHandoff(hash), { ok: false, reason: 'bad-json' });
  assert.deepEqual(decodeHandoff('A'.repeat(4097)), { ok: false, reason: 'too-large' });
  assert.deepEqual(decodeHandoff('#estilo=' + 'A'.repeat(4090)), { ok: false, reason: 'too-large' });
  assert.equal(decodeHandoff('A'.repeat(4096)).reason, 'bad-json', 'exact 4096 remains in range but malformed');
  assert.deepEqual(decodeHandoff(undefined), { ok: false, reason: 'empty' });
});
check('AC21 UTF8 roundtrip and fragment forms', () => {
  const encoded = encodeHandoff(valid); assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  for (const hash of [encoded, `#${encoded}`, `demo=${encoded}`, `#demo=${encoded}`]) assert.deepEqual(decodeHandoff(hash), { ok: true, value: valid });
  assert.equal(parseHandoffFragment(`#demo=${encoded}`).result.value.phrase, valid.phrase);
  assert.equal(parseHandoffFragment('#other=example'), null);
  assert.equal(parseHandoffFragment(`#estilo=${encoded}`).result.value.phrase, undefined);
});
check('AC23 version and required structures', () => {
  rejected({ v: 2, ...valid }, 'bad-version'); rejected(mutate((v) => { v.style.v = 2; }), 'bad-version');
  rejected({}); rejected({ style: [] }); rejected(mutate((v) => { delete v.style.highlight; }));
  rejected(mutate((v) => { v.style.templateId = 'missing-template'; }));
  rejected(mutate((v) => { v.style.motion.in = 'custom-missing'; })); rejected(mutate((v) => { v.style.motion.out = 'missing'; }));
  rejected(mutate((v) => { v.style.highlight.mode = 'zone-safe'; })); rejected(mutate((v) => { v.style.highlight.color = '#fff'; }));
  rejected(mutate((v) => { v.style.typography.fontFamily = 'Nonexistent Font'; }));
});
check('AC23 scalar range and finite checks', () => {
  const invalid = { fontSize: [0, 1001, null, '132', NaN, Infinity], fontWeight: [700, 401, null], letterSpacing: [-101, 101], wordSpacing: [-101, 301], lineHeight: [0.29, 4.01], strokeWidth: [-1, 51], shadowBlur: [-1, 201], shadowOpacity: [-0.1, 1.1], shadowX: [-201, 201], shadowY: [-201, 201], italic: ['true'], uppercase: [1], textAlign: ['justify'] };
  for (const [field, values] of Object.entries(invalid)) for (const candidate of values) rejected(mutate((v) => { v.style.typography[field] = candidate; }));
  for (const hold of [-1, 36001, 1.5, NaN, Infinity]) rejected(mutate((v) => { v.style.motion.holdFrames = hold; }));
  for (const name of ['', ' '.repeat(4), 'X'.repeat(41), null]) rejected(mutate((v) => { v.style.name = name; }));
  rejected(mutate((v) => { v.phrase = 'X'.repeat(81); }));
  for (const size of [1, 1000]) assert.equal(validateHandoff(mutate((v) => { v.style.typography.fontSize = size; })).ok, true);
  for (const hold of [0, 36000]) assert.equal(validateHandoff(mutate((v) => { v.style.motion.holdFrames = hold; })).ok, true);
  assert.equal(validateHandoff(mutate((v) => { v.style.name = 'X'.repeat(40); v.phrase = 'X'.repeat(80); })).ok, true);
});
check('AC23 nested whitelist and ranges', () => {
  const invalid = {
    fill: [{}, { type: 'solid', color: 'red' }, { type: 'gradient', angle: 361, stops: [{ color: '#000000', at: 0 }, { color: '#FFFFFF', at: 1 }] }, { type: 'gradient', angle: 90, stops: [{ color: '#000000', at: -1 }, { color: '#FFFFFF', at: 1 }] }],
    strokes: [{ arbitrary: true }, [{ width: 51, color: '#FFFFFF' }], [{ width: 1, color: '#fff' }]],
    glow: [{ arbitrary: true }, { color: '#FFFFFF', radius: 101, intensity: 1 }, { color: '#FFFFFF', radius: 2, intensity: 11 }],
    box: [{ arbitrary: true }, { color: '#FFFFFF', paddingX: 301, paddingY: 1, radius: 1 }],
    secondary: [{ arbitrary: true }, { fontFamily: 'Missing', fontWeight: 400, fontSizeScale: 1, italic: false, uppercase: false, letterSpacing: 0, fill: { type: 'solid', color: '#FFFFFF' }, strokes: [] }],
  };
  for (const [field, values] of Object.entries(invalid)) for (const candidate of values) rejected(mutate((v) => { v.style.typography[field] = candidate; }));
  const extended = mutate((v) => {
    Object.assign(v.style.typography, { fill: { type: 'gradient', angle: 360, stops: [{ color: '#000000', at: 0 }, { color: '#FFFFFF', at: 1 }] }, strokes: [{ color: '#000000', width: 50 }], glow: { color: '#FFFFFF', radius: 100, intensity: 10 }, box: { color: '#000000', paddingX: 300, paddingY: 300, radius: 300 }, secondary: { fontFamily: baseStyle.typography.fontFamily, fontWeight: 400, fontSizeScale: 3, italic: false, uppercase: false, letterSpacing: -100, fill: { type: 'solid', color: '#FFFFFF' }, strokes: [] } });
  });
  assert.equal(validateHandoff(extended).ok, true);
  for (const [field, candidate] of [['fontSizeScale', 3.1], ['fontWeight', 700], ['letterSpacing', 101]]) rejected(mutate((v) => { v.style.typography.secondary = { ...extended.style.typography.secondary, [field]: candidate }; }));
  const extras = mutate((v) => { v.projectText = 'PRIVATE'; v.style.position = { x: 10 }; v.style.typography.arbitrary = { secret: 'PRIVATE' }; v.style.typography.fill = { type: 'solid', color: '#FFFFFF', arbitrary: true }; });
  const canonical = validateHandoff(extras); assert.equal(canonical.ok, true);
  assert.equal(JSON.stringify(canonical.value).includes('PRIVATE'), false); assert.equal(canonical.value.style.typography.fill.arbitrary, undefined);
});

check('AC24 all eight template refs, immutable apply, locked layers', () => {
  assert.equal(captionTemplates.length, 8); assert.equal(new Set(knownTemplateIds()).size, 8); assert.deepEqual(brokenTemplateRefs(), []);
  const original = createTextLayer('SECRETO 123', 'selected'); original.typography.fontSize = 87; original.startFrame = 18; original.durationFrames = 120; original.wordTiming = evenWordTiming(original.text, 120, { mode: 'scale', color: '#FFFFFF' });
  const locked = { ...structuredClone(original), id: 'locked', locked: true }; const before = structuredClone(original);
  for (const template of captionTemplates) {
    const parts = resolveTemplateParts(template); assert(parts.typography.fontFamily && parts.animationIn.preset.id);
    const applied = applyTemplateToLayers([original, locked], template); assert.strictEqual(applied[1], locked);
    for (const key of ['text', 'startFrame', 'durationFrames', 'positionX', 'positionY']) assert.deepEqual(applied[0][key], before[key]);
    assert.equal(applied[0].typography.fontSize, 87); assert.deepEqual(applied[0].wordTiming.words, before.wordTiming.words);
    assert.equal(applied[0].wordTiming.mode, template.highlight.mode); assert.equal(applied[0].wordTiming.color, template.highlight.color);
    assert.equal(decodeHandoff(encodeHandoff({ style: payloadFromTemplateId(template.id), phrase: 'HOLA ÑANDÚ' })).ok, true);
    assert.deepEqual(original, before);
  }
});
check('AC21/22 handoff apply preserves selected size and timing', () => {
  const original = createTextLayer('SECRETO 123', 'selected'); original.typography.fontSize = 87; original.startFrame = 18; original.durationFrames = 120;
  original.wordTiming = evenWordTiming(original.text, 120, { mode: 'scale', color: '#FFFFFF' }); const before = structuredClone(original);
  const applied = applyHandoffToLayer(original, baseStyle);
  assert.equal(applied.typography.fontSize, 87); assert.equal(applied.text, original.text); assert.deepEqual(applied.wordTiming.words, original.wordTiming.words);
  assert.equal(applied.startFrame, 18); assert.equal(applied.durationFrames, 120); assert.deepEqual(original, before);
  const demo = applyHandoffToLayer(original, baseStyle, { phrase: 'HOLA ÑANDÚ', createWordTiming: true, hold: 'payload' });
  assert.equal(demo.text, 'HOLA ÑANDÚ'); assert.equal(demo.typography.fontSize, 87); assert.equal(demo.wordTiming.words.length, 2);
  assert.equal(demo.animation.holdFrames, baseStyle.motion.holdFrames); assert.deepEqual(original, before);
});
check('AC26 full share excludes text, media, positions and times', () => {
  const layer = applyHandoffToLayer(createTextLayer('SECRETO 123', 'private-id'), baseStyle, { hold: 'payload' });
  layer.wordTiming = evenWordTiming(layer.text, 120, baseStyle.highlight);
  const share = checkStyleShare(layer, 'Mi estilo'); assert.equal(share.mode, 'full');
  const link = buildStyleLink(share.payload, 'http://127.0.0.1:4173'); assert.equal(link.ok, true); assert.match(link.url, /^https?:\/\/[^/]+\/editor\/#estilo=[A-Za-z0-9_-]+$/); assert(link.url.length <= 4096);
  const decoded = decodeHandoff(new URL(link.url).hash); assert.equal(decoded.ok, true); assert.deepEqual(decoded.value.style, share.payload);
  const serialized = Buffer.from(new URL(link.url).hash.slice('#estilo='.length), 'base64url').toString('utf8');
  for (const secret of ['SECRETO', 'private-id', 'phrase', 'positionX', 'startFrame', 'mediaId', 'words']) assert.equal(serialized.includes(secret), false, secret);
  assert.equal(buildStyleLink({ ...share.payload, name: 'X'.repeat(41) }, 'http://127.0.0.1:4173').ok, false);
  assert.equal(buildStyleLink(share.payload, 'https://example.com/path').ok, false);
});
check('AC26 custom/override/loop share is explicit look-only and preserves target motion', () => {
  const layer = applyHandoffToLayer(createTextLayer('SECRETO 123', 'private'), baseStyle);
  const custom = structuredClone(layer); custom.animation.in.preset.id = 'custom-local';
  const modified = structuredClone(layer); modified.animation.in.overrides.x += 10;
  const loop = structuredClone(layer); loop.animation.loop = defaultLoop('wave');
  for (const source of [custom, modified, loop]) {
    const share = checkStyleShare(source); assert.equal(share.mode, 'look-only'); assert(share.reason.length > 0); assert.equal(share.payload.motion, undefined);
    const link = buildStyleLink(share.payload, 'https://example.com'); assert.equal(link.ok, true); assert.equal(decodeHandoff(new URL(link.url).hash).ok, true);
    const target = createTextLayer('DESTINO', 'target'); target.typography.fontSize = 79; target.animation.loop = defaultLoop('heartbeat'); const before = structuredClone(target);
    const applied = applyHandoffToLayer(target, share.payload); assert.deepEqual(applied.animation, before.animation); assert.equal(applied.typography.fontSize, 79); assert.deepEqual(target, before);
  }
  assert.equal(checkStyleShare({ ...layer, typography: { ...layer.typography, fontSize: 1001 } }).mode, 'none');
  assert.equal(sanitizeTypography({ arbitrary: true }), null);
});
if (failures.length) { console.error(`HANDOFF_FAILED checks=${checks} failures=${failures.length}`); process.exitCode = 1; }
else console.log(`HANDOFF_OK checks=${checks} AC21/22-pure AC23 AC24-ref/apply AC26-schema/share (browser/history integration not tested)`);
