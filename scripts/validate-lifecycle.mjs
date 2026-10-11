import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';

// Executes production hooks with a minimal effect/state host; transports below are real HTTP.
const react = 'data:text/javascript,' + encodeURIComponent(`
export const useState = (...args) => globalThis.__hookHost.state(...args);
export const useRef = (...args) => globalThis.__hookHost.ref(...args);
export const useEffect = (...args) => globalThis.__hookHost.effect(...args);
export const useCallback = (...args) => globalThis.__hookHost.callback(...args);
`);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL?.includes('/src/hooks/')) return { url: react, shortCircuit: true };
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
class Host {
  slots = []; index = 0; effects = []; mounted = true; lateUpdates = 0;
  constructor(hook, options) { this.hook = hook; this.options = options; this.render(); }
  state(initial) {
    const index = this.index++;
    if (!this.slots[index]) this.slots[index] = { value: typeof initial === 'function' ? initial() : initial };
    return [this.slots[index].value, (value) => { if (!this.mounted) this.lateUpdates++; this.slots[index].value = typeof value === 'function' ? value(this.slots[index].value) : value; }];
  }
  ref(initial) { const index = this.index++; return this.slots[index] ??= { current: initial }; }
  changed(slot, deps) { return !slot || !deps || deps.some((d, i) => !Object.is(d, slot.deps[i])); }
  effect(run, deps) {
    const index = this.index++;
    const previous = this.slots[index];
    if (this.changed(previous, deps)) { this.slots[index] = { deps, cleanup: previous?.cleanup }; this.effects.push(() => { previous?.cleanup?.(); this.slots[index].cleanup = run(); }); }
  }
  callback(value, deps) { const index = this.index++; if (this.changed(this.slots[index], deps)) this.slots[index] = { value, deps }; return this.slots[index].value; }
  render(options = this.options) { this.options = options; this.index = 0; globalThis.__hookHost = this; this.model = this.hook(options); for (const effect of this.effects.splice(0)) effect(); return this.model; }
  unmount() { this.mounted = false; for (const slot of this.slots) slot?.cleanup?.(); }
}
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const until = async (condition, description, timeout = 6000) => {
  const started = Date.now(); while (!condition()) { if (Date.now() - started > timeout) throw new Error(`timeout: ${description}`); await wait(10); }
};
const { useTranscription } = await import('../src/hooks/useTranscription.ts');
const { useExport } = await import('../src/hooks/useExport.ts');
const { useGuide } = await import('../src/hooks/useGuide.ts');
const { useServerCapabilities } = await import('../src/hooks/useServerCapabilities.ts');
const { createTextLayer } = await import('../src/remotion/defaults.ts');
const template = createTextLayer('UNO DOS', 'one');
const jobs = new Map(); const starts = []; const deletes = []; let healthCount = 0; let healthHold;
const words = [{ text: 'UNO', startMs: 0, endMs: 500, confidence: 1 }, { text: 'DOS', startMs: 500, endMs: 1000, confidence: 1 }];
const reply = (res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
const server = createServer(async (req, res) => {
  const path = req.url;
  if (path === '/api/health') { healthCount++; if (healthHold) return healthHold(res); return reply(res, 200, { version: 1, mode: 'local', transcriptionMode: 'mock', capabilities: { upload: true, render: true, transcribe: true } }); }
  if (path === '/api/transcribe/providers') return reply(res, 200, { providers: [{ id: 'elevenlabs', label: 'Mock', configured: true }] });
  if (path === '/api/exports') return reply(res, 200, { files: [] });
  if (path?.startsWith('/media/') && req.method === 'HEAD') { res.writeHead(200); res.end(); return; }
  if (req.method === 'POST') {
    for await (const _chunk of req) { /* receive body before allocating a real job */ }
    const id = `job-${jobs.size + 1}`;
    jobs.set(id, { status: 'running', path });
    starts.push({ id, path, release: () => reply(res, 202, { jobId: id }) });
    return;
  }
  const id = path?.split('/').at(-1); const job = jobs.get(id);
  if (req.method === 'DELETE') { assert(job, 'DELETE must name the real server job'); deletes.push(id); job.status = 'cancelled'; return reply(res, 200, { status: 'cancelled' }); }
  if (job) return reply(res, 200, path.includes('transcribe') ? { status: 'done', stage: 'done', words } : { status: 'done', url: '/exports/final.mp4' });
  reply(res, 404, { error: 'No existe ese trabajo.' });
});
const nativeFetch = globalThis.fetch;
let downloadCount = 0;
globalThis.document = { createElement: (tag) => {
  if (tag === 'a') return { click: () => downloadCount++ };
  throw new Error(`unexpected element ${tag}`);
} };
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (url, options) => nativeFetch(typeof url === 'string' && url.startsWith('/') ? `${origin}${url}` : url, options);
  for (const action of ['cancel', 'project', 'unmount']) {
    let applied = 0;
    const host = new Host(useTranscription, { mediaId: 'video-a', sessionKey: 'one', templateLayer: template, createId: () => 'caption', onApply: () => { applied++; return null; } });
    const before = starts.length;
    const task = host.model.generate(); void host.model.generate();
    await until(() => starts.length === before + 1, 'STT server receives POST');
    assert.equal(starts.length, before + 1, 'two synchronous clicks allocate one job');
    const started = starts.at(-1);
    if (action === 'cancel') host.model.cancel();
    else if (action === 'project') host.render({ ...host.options, sessionKey: 'two' });
    else host.unmount();
    started.release(); await task;
    await until(() => deletes.includes(started.id), 'late STT DELETE');
    assert.equal(jobs.get(started.id).status, 'cancelled'); assert.equal(deletes.filter((id) => id === started.id).length, 1);
    assert.equal(applied, 0); assert.equal(host.lateUpdates, 0); if (host.mounted) host.unmount();
  }
  // Moving between tools keeps the App-owned hook mounted and applies one completed result.
  {
    let applied = 0;
    const host = new Host(useTranscription, { mediaId: 'video-a', templateLayer: template, createId: () => 'caption', onApply: () => { applied++; return null; } });
    const before = starts.length; const task = host.model.generate();
    await until(() => starts.length > before, 'normal STT'); host.render(); assert.equal(host.model.running, true);
    starts.at(-1).release(); await task; assert.equal(applied, 1); host.unmount(); assert.equal(host.lateUpdates, 0);
  }
  for (const action of ['video', 'unmount']) {
    let applied = 0;
    const host = new Host(useTranscription, { mediaId: 'video-a', templateLayer: template, createId: () => 'caption', onApply: () => { applied++; return null; } });
    const before = starts.length; const task = host.model.generate(); await until(() => starts.length > before, 'polling STT start');
    const started = starts.at(-1); started.release(); await wait(30);
    if (action === 'video') host.render({ ...host.options, mediaId: 'video-b' }); else host.unmount();
    await task; await until(() => deletes.includes(started.id), 'polling STT cancellation'); assert.equal(applied, 0); assert.equal(host.lateUpdates, 0); if (host.mounted) host.unmount();
  }
  const exportOptions = { inputProps: { layers: [template], background: 'green', customBackground: '#000000' }, background: 'green', format: { id: 'portrait', width: 1080, height: 1920 }, guideMediaId: '' };
  for (const action of ['cancel', 'unmount']) {
    const host = new Host(useExport, exportOptions); const before = starts.length;
    const task = host.model.exportVideo('green'); void host.model.exportVideo('green');
    await until(() => starts.length > before, 'render server receives POST'); assert.equal(starts.length, before + 1);
    const started = starts.at(-1); if (action === 'cancel') await host.model.cancelExport(); else host.unmount();
    started.release(); await task; await until(() => deletes.includes(started.id), 'late render DELETE');
    assert.equal(jobs.get(started.id).status, 'cancelled'); assert.equal(deletes.filter((id) => id === started.id).length, 1);
    assert.equal(downloadCount, 0); assert.equal(host.lateUpdates, 0); if (host.mounted) host.unmount();
  }
  {
    const host = new Host(useExport, exportOptions); const before = starts.length; const task = host.model.exportVideo('green');
    await until(() => starts.length > before, 'polling render start'); const started = starts.at(-1); started.release(); await wait(30); host.unmount();
    await task; await until(() => deletes.includes(started.id), 'polling render cancellation'); assert.equal(downloadCount, 0); assert.equal(host.lateUpdates, 0);
  }
  {
    const host = new Host(useExport, { ...exportOptions, enabled: false }); const before = starts.length;
    await host.model.exportVideo('green'); assert.equal(starts.length, before); host.unmount();
  }
  {
    let busy = false;
    const host = new Host(useServerCapabilities, { isBusy: () => busy });
    await until(() => host.render().status === 'ready', 'health ready');
    let pending;
    healthHold = (res) => { pending = res; };
    host.model.retry(); await until(() => pending, 'health pending');
    busy = true; const before = healthCount; host.model.retry(); await wait(30); assert.equal(healthCount, before);
    reply(pending, 503, {}); await wait(30); assert.equal(host.render().status, 'ready', 'pending failure during busy preserves ready');
    busy = false; pending = undefined; host.model.retry(); await until(() => pending, 'health timeout pending'); busy = true;
    await wait(3100); assert.equal(host.render().status, 'ready', 'timeout during busy preserves ready'); pending.end();
    busy = false; healthHold = undefined; host.model.retry(); await wait(30); assert.equal(host.render().status, 'ready'); host.unmount(); assert.equal(host.lateUpdates, 0);
  }
  {
    healthHold = (res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>static hosting</html>'); };
    const host = new Host(useServerCapabilities, {}); await until(() => host.render().status === 'unavailable', 'HTML health unavailable');
    assert.deepEqual(host.model.capabilities, { upload: false, render: false, transcribe: false });
    healthHold = (res) => reply(res, 200, { version: 2, mode: 'local', transcriptionMode: 'mock', capabilities: { upload: true, render: true, transcribe: true } });
    host.model.retry(); await wait(30); assert.equal(host.render().status, 'unavailable', 'wrong schema version');
    healthHold = undefined; host.model.retry(); await until(() => host.render().status === 'ready', 'health recovered'); host.unmount();
  }

  // Controlled metadata/XHR test executes the production guide hook: A finishes after B.
  const probes = []; const uploads = []; const revoked = [];
  globalThis.document.createElement = () => {
    const probe = { duration: 2, removeAttribute() {}, load() {}, set src(value) { this.source = value; if (value) probes.push(this); } }; return probe;
  };
  const nativeCreate = URL.createObjectURL; const nativeRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (file) => `blob:${file.name}`; URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.XMLHttpRequest = class {
    upload = {}; open() {} setRequestHeader() {} send(file) { this.file = file; uploads.push(this); }
    abort() { this.onabort?.(); this.onloadend?.(); }
    complete(id) { this.status = 201; this.responseText = JSON.stringify({ mediaId: id }); this.onload(); this.onloadend?.(); }
  };
  try {
    const host = new Host(useGuide, { flashHint: () => {} });
    const a = host.model.pickGuide({ name: 'a', size: 150_000_001 });
    const b = host.model.pickGuide({ name: 'b', size: 150_000_001 });
    probes[1].onloadedmetadata(); await b; uploads[0].complete('b-id'); await wait(0);
    probes[0].onloadedmetadata(); await a;
    assert.equal(host.render().guideName, 'b'); assert.equal(host.model.guideMediaId, 'b-id'); assert(revoked.includes('blob:a'));
    const c = host.model.pickGuide({ name: 'c', size: 150_000_001 }); host.model.removeGuide(); probes[2].onloadedmetadata(); await c;
    assert.equal(host.render().guide, null); assert.equal(host.model.guideMediaId, '');
    const d = host.model.pickGuide({ name: 'd', size: 150_000_001 }); host.unmount(); probes[3].onloadedmetadata(); await d;
    assert.equal(host.lateUpdates, 0); assert(revoked.includes('blob:d'));
    const relink = new Host(useGuide, { flashHint: () => {} }); const startProbe = probes.length;
    const linkA = relink.model.relinkGuide('a-id', 'A'); await until(() => probes.length > startProbe, 'relink A metadata');
    const linkB = relink.model.relinkGuide('b-id', 'B'); await until(() => probes.length > startProbe + 1, 'relink B metadata');
    probes[startProbe + 1].onloadedmetadata(); await linkB; probes[startProbe].onloadedmetadata(); await linkA;
    assert.equal(relink.render().guideMediaId, 'b-id'); assert.equal(relink.model.guide.name, 'B'); relink.unmount(); assert.equal(relink.lateUpdates, 0);
  } finally { URL.createObjectURL = nativeCreate; URL.revokeObjectURL = nativeRevoke; }
  console.log('LIFECYCLE_OK AC9-selected/remove/relink/unmount AC10 AC11 delayed real HTTP 202 and polling, synchronous locks; AC7 HTML/schema/recovery AC36 busy failure/timeout/retry');
} finally {
  globalThis.fetch = nativeFetch;
  await new Promise((done) => { server.close(done); server.closeAllConnections(); });
}
