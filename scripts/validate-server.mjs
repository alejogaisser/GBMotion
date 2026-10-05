import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

const { readBody, readJson, parseRange, isAllowedOrigin, HttpError } = await import('../server/http.ts');
const { isSupportedFormat } = await import('../server/render.ts');
const { mapProviderError, createTranscribeService, MISSING_KEY_MESSAGE } = await import('../server/transcribe.ts');
const { isMediaId, mediaPath } = await import('../server/media.ts');
const { isAbsolute } = await import('node:path');

/* --- readBody: una ñ partida entre dos chunks (B3) --- */
{
  const bytes = Buffer.from('¿QUÉ PASÓ? ñandú', 'utf8');
  const cut = bytes.indexOf(0xc3) + 1; // entre los dos bytes de la primera letra con tilde
  const body = await readBody(Readable.from([bytes.subarray(0, cut), bytes.subarray(cut)]), 1024);
  assert.equal(body.toString('utf8'), '¿QUÉ PASÓ? ñandú');
  assert.equal(body.toString('utf8').includes('�'), false, 'no replacement characters');

  const enye = Buffer.from('{"t":"ñ"}', 'utf8');
  const split = enye.indexOf(0xc3) + 1;
  assert.deepEqual(await readJson(Readable.from([enye.subarray(0, split), enye.subarray(split)])), { t: 'ñ' });

  const big = Readable.from([Buffer.alloc(600), Buffer.alloc(600)]);
  await assert.rejects(readBody(big, 1000), (error) => error instanceof HttpError && error.status === 413);
  assert.equal(big.destroyed, true, 'the request is destroyed after the limit');
  await assert.rejects(readJson(Readable.from([Buffer.from('{roto')])), (error) => error.status === 400);
}

/* --- parseRange --- */
{
  assert.equal(parseRange(undefined, 1000), null);
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 }, 'end is clamped to the file');
  assert.equal(parseRange('bytes=1000-1100', 1000), 'invalid');
  assert.equal(parseRange('bytes=50-10', 1000), 'invalid');
  assert.equal(parseRange('bytes=-', 1000), 'invalid');
  assert.equal(parseRange('items=0-1', 1000), null, 'other units are ignored');
  assert.equal(parseRange('bytes=0-1', 0), 'invalid');
}

/* --- isAllowedOrigin (B15) --- */
{
  assert.equal(isAllowedOrigin(undefined, 4173), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:4173', 4173), true);
  assert.equal(isAllowedOrigin('http://localhost:4173', 4173), true);
  assert.equal(isAllowedOrigin('https://evil.example', 4173), false);
  assert.equal(isAllowedOrigin('http://127.0.0.1:9999', 4173), false);
  assert.equal(isAllowedOrigin('http://127.0.0.1:4173.evil.example', 4173), false);
  assert.equal(isAllowedOrigin('null', 4173), false);
}

/* --- Formatos (B2) --- */
{
  assert.equal(isSupportedFormat({ id: 'portrait', width: 1080, height: 1920 }), true);
  assert.equal(isSupportedFormat({ id: 'landscape', width: 1920, height: 1080 }), true);
  assert.equal(isSupportedFormat({ id: 'square', width: 1080, height: 1080 }), true);
  assert.equal(isSupportedFormat({ id: 'x', width: 1920, height: 1920 }), false, '1920x1920 is rejected');
  assert.equal(isSupportedFormat({ id: 'portrait', width: 1920, height: 1080 }), false, 'id and size must match');
  assert.equal(isSupportedFormat({ id: 'portrait', width: 1080, height: 1920000 }), false);
  assert.equal(isSupportedFormat(null), false);
  assert.equal(isSupportedFormat('portrait'), false);
}

/* --- Ids de media --- */
{
  assert.equal(isAbsolute(mediaPath('tmp/qa/relmedia', '559708bc-9536-45a2-8d32-ccaef5cc351c.mp4')), true, 'relative media dir resolves to an absolute path');
  assert.equal(isMediaId('559708bc-9536-45a2-8d32-ccaef5cc351c.mp4'), true);
  assert.equal(isMediaId('../secret.mp4'), false);
  assert.equal(isMediaId('559708bc-9536-45a2-8d32-ccaef5cc351c.exe'), false);
  assert.equal(isMediaId(undefined), false);
}

/* --- Errores de los proveedores: nunca llevan la clave --- */
{
  const key = 'sk_SECRET_KEY_123';
  const leaky = (status) => Object.assign(new Error(`xi-api-key: ${key} Authorization: Bearer ${key}`), { status });
  const messages = [
    mapProviderError('elevenlabs', leaky(401)),
    mapProviderError('elevenlabs', leaky(403)),
    mapProviderError('groq', leaky(401)),
    mapProviderError('groq', leaky(429)),
    mapProviderError('elevenlabs', leaky(413)),
    mapProviderError('elevenlabs', leaky(500)),
    mapProviderError('groq', leaky(422)),
    mapProviderError('elevenlabs', new TypeError(`fetch failed ${key}`)),
    mapProviderError('groq', Object.assign(new Error(key), { name: 'TimeoutError' })),
    mapProviderError('groq', Object.assign(new Error(key), { cause: { message: key } })),
  ];
  for (const message of messages) {
    assert.equal(message.includes(key), false, `the key never appears: ${message}`);
    assert.equal(/ELEVENLABS_API_KEY|GROQ_API_KEY|xi-api-key|Bearer/.test(message), false);
  }
  assert.equal(messages[0], 'La clave de ElevenLabs no es válida.');
  assert.equal(messages[2], 'La clave de Groq no es válida.');
  assert.equal(messages[3], 'Límite de uso de Groq. Probá en unos minutos.');
  assert.equal(messages[7], 'Sin conexión con ElevenLabs.');

  // El listado de servicios expone sólo id, label y configured.
  const mediaDir = mkdtempSync(join(tmpdir(), 'gb-motion-test-'));
  try {
    const withKeys = createTranscribeService({ elevenlabsKey: key, groqKey: undefined, provider: undefined, mediaDir, mock: false });
    const listing = withKeys.listProviders();
    assert.deepEqual(listing.providers.map((p) => Object.keys(p).sort()), [['configured', 'id', 'label'], ['configured', 'id', 'label']]);
    assert.deepEqual(listing.providers.map((p) => p.configured), [true, false]);
    assert.equal(JSON.stringify(listing).includes(key), false);

    const withoutKeys = createTranscribeService({ mediaDir, mock: false });
    await assert.rejects(withoutKeys.start({ mediaId: '559708bc-9536-45a2-8d32-ccaef5cc351c.mp4' }), (error) => error.status === 412 && error.code === 'missing_key' && error.message === MISSING_KEY_MESSAGE);
    assert.equal(createTranscribeService({ mediaDir, mock: true }).listProviders().providers[0].configured, true, 'the mock counts as configured');
  } finally {
    rmSync(mediaDir, { recursive: true, force: true });
  }
}

console.log('SERVER_OK readBody=utf8 range=ok origin=ok formats=ok errors=keyless');
