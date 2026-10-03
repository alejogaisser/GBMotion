import { registerHooks } from 'node:module';
import { writeFile } from 'node:fs/promises';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) { if (s.startsWith('.') && !/\.[a-z]+$/i.test(s)) return next(`${s}.ts`, c); throw e; } } });
const { createTextLayer, overridesFor } = await import('../src/remotion/defaults.ts');
const { builtInPresets } = await import('../src/presets/builtins.ts');
const { fontById, fontStack } = await import('../src/typography/fontRegistry.ts');
const { defaultLoop } = await import('../src/engine/loopMotion.ts');
const { evenWordTiming, neutralTransform } = await import('../src/engine/editorMotion.ts');
const layers = ['ANTES Y DESPUÉS', 'MÁS POSIBILIDADES', 'HECHO PARA CREAR'].map((text, i) => {
  const preset = builtInPresets.find((p) => p.id === ['depth-punch', 'mask-left', 'mask-center'][i]);
  const layer = createTextLayer(text, `smoke-${i}`, preset);
  layer.startFrame = i * 60; layer.durationFrames = 60;
  layer.typography.fontFamily = fontStack(fontById(['inter', 'barlow-condensed', 'fraunces'][i]));
  layer.typography.fontWeight = 700;
  layer.animation = { in: { preset, overrides: overridesFor(preset) }, holdFrames: 30, out: null, loop: i === 2 ? defaultLoop('breathe') : null };
  if (i === 1) layer.wordTiming = evenWordTiming(text, 60);
  if (i === 2) layer.transformKeys = [{ ...neutralTransform }, { ...neutralTransform, frame: 59, x: 80, rotation: 5 }];
  return layer;
});
const format = { id: 'portrait', width: 1080, height: 1920, label: 'Smoke test' };
const props = { layers, background: 'green', customBackground: '#000000' };
await writeFile('exports/editor-smoke-props.json', JSON.stringify(props, null, 2));
const kind = process.argv[2] ?? 'green';
if (kind === 'alpha') props.background = 'transparent';
const started = await (await fetch('http://127.0.0.1:4173/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, format, props }) })).json();
if (!started.jobId) throw new Error(JSON.stringify(started));
const deadline = Date.now() + 300000;
while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const job = await (await fetch(`http://127.0.0.1:4173/api/render/${started.jobId}`)).json();
  if (job.status === 'done') { console.log(`RENDER_OK ${kind} ${job.url}`); await writeFile(`exports/editor-smoke-${kind}.json`, JSON.stringify(job, null, 2)); process.exit(0); }
  if (job.status !== 'rendering') throw new Error(JSON.stringify(job));
}
await fetch(`http://127.0.0.1:4173/api/render/${started.jobId}`, { method: 'DELETE' });
throw new Error('Smoke render exceeded five minutes and was cancelled');
