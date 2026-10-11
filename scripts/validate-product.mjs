import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { validateRenderInput } = await import('../server/renderInput.ts');
const { pruneFinishedJobs } = await import('../server/jobs.ts');
const { createRenderService } = await import('../server/render.ts');
const { createGbMotionHandler } = await import('../server/app.ts');
const { loadGbServerConfig } = await import('../server/config.ts');
const { createTextLayer } = await import('../src/remotion/defaults.ts');
const valid = { props: { layers: [createTextLayer('¿QUÉ PASÓ? ÑANDÚ', 'one')], background: 'green', customBackground: '#000000' }, format: { id: 'portrait', width: 1080, height: 1920 }, kind: 'green' };
assert.deepEqual(validateRenderInput(valid).props, valid.props);
const invalid = [[], [{}], Array.from({ length: 401 }, () => valid.props.layers[0]), [{ ...valid.props.layers[0], startFrame: -1 }], [{ ...valid.props.layers[0], startFrame: Infinity }], [{ ...valid.props.layers[0], typography: {} }]];
for (const layers of invalid) assert.throws(() => validateRenderInput({ ...valid, props: { ...valid.props, layers } }), (e) => e.status === 400);
assert.throws(() => validateRenderInput({ ...valid, kind: 'nope' }), (e) => e.status === 400);
assert.throws(() => validateRenderInput({ ...valid, format: { ...valid.format, width: 1920 } }), (e) => e.status === 400);
const now = 4_000_000;
const jobs = new Map(Array.from({ length: 30 }, (_, i) => [`done-${i}`, { status: 'done', createdAt: now - i * 200_000 }]));
jobs.set('active', { status: 'rendering', createdAt: 0 });
jobs.set('cancel-draining', { status: 'cancelled', active: true, createdAt: 0 });
pruneFinishedJobs(jobs, { now, maxFinished: 20, maxAgeMs: 3_600_000 });
assert(jobs.has('active') && jobs.has('cancel-draining'));
assert([...jobs].filter(([, j]) => j.status === 'done').length <= 20);
assert([...jobs].filter(([, j]) => j.status === 'done').every(([, j]) => now - j.createdAt <= 3_600_000));

const root = mkdtempSync(join(tmpdir(), 'gb-product-'));
let server;
let app;
try {
  const previousPort = process.env.GB_PORT;
  try {
    for (const port of ['0', '65536', '4173.5', 'invalid', '-1']) { process.env.GB_PORT = port; assert.throws(() => loadGbServerConfig(root), /GB_PORT/); }
    process.env.GB_PORT = '4185';
    const config = loadGbServerConfig(root);
    assert.equal(config.host, '127.0.0.1'); assert.equal(config.port, 4185); assert.equal(config.projectRoot, root);
  } finally { if (previousPort === undefined) delete process.env.GB_PORT; else process.env.GB_PORT = previousPort; }
  const exportsDir = resolve(root, 'exports');
  mkdirSync(exportsDir);
  writeFileSync(resolve(exportsDir, 'gb-motion-green-1.mp4'), 'final');
  writeFileSync(resolve(exportsDir, 'gb-motion-green-2.mp4'), '');
  writeFileSync(resolve(exportsDir, 'gb-motion-green-3.partial-id.mp4'), 'partial');
  const render = createRenderService({ projectRoot: process.cwd(), exportsDir, mediaDir: root, port: 1 });
  assert.deepEqual(render.listExports().map((f) => f.name), ['gb-motion-green-1.mp4']);
  assert.equal(render.exportFile('gb-motion-green-3.partial-id.mp4'), undefined);
  assert.equal(render.exportFile('gb-motion-green-2.mp4'), null);
  await render.close();
  server = createServer((req, res) => { void app.handle(req, res).then((handled) => { if (!handled) { res.statusCode = 404; res.end(); } }); });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const port = server.address().port;
  app = createGbMotionHandler({ projectRoot: process.cwd(), exportsDir, mediaDir: root, port, stt: { mediaDir: root, mock: true } });
  const origin = `http://127.0.0.1:${port}`;
  let response = await fetch(`${origin}/api/health`);
  assert.deepEqual(await response.json(), { version: 1, mode: 'local', transcriptionMode: 'mock', capabilities: { upload: true, render: true, transcribe: true } });
  response = await fetch(`${origin}/api/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(17 * 1024 * 1024) });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'El pedido es demasiado grande.' });
  assert.equal((await fetch(`${origin}/api/health`)).status, 200);
  response = await fetch(`${origin}/api/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, props: { ...valid.props, layers: [{}] } }) });
  assert.equal(response.status, 400);
  response = await fetch(`${origin}/api/render`, { method: 'POST', headers: { Origin: 'https://other.invalid' }, body: '{}' });
  assert.equal(response.status, 403);
  assert.equal((await fetch(`${origin}/api/desconocida`)).status, 404);
  for (const [stt, transcriptionMode, transcribe] of [[{ mediaDir: root, mock: false }, 'unconfigured', false], [{ mediaDir: root, mock: false, groqKey: 'fixture-provider-key' }, 'provider', true]]) {
    await app.close(); app = createGbMotionHandler({ projectRoot: process.cwd(), exportsDir, mediaDir: root, port, stt });
    const payload = await (await fetch(`${origin}/api/health`)).json();
    assert.deepEqual(payload, { version: 1, mode: 'local', transcriptionMode, capabilities: { upload: true, render: true, transcribe } });
  }
  console.log('PRODUCT_OK AC13-invalid AC12-final-filter AC18-handler AC19 (no real render/runtime routes)');
} finally {
  if (app) await app.close();
  if (server) await new Promise((done) => { server.close(done); server.closeIdleConnections(); });
  rmSync(root, { recursive: true, force: true });
}
