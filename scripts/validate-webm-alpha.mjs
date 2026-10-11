import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { binDir } = await import('../server/ffmpeg.ts');
const { createTextLayer } = await import('../src/remotion/defaults.ts');
const { evenWordTiming } = await import('../src/engine/editorMotion.ts');

// Lossless PNG RGBA decode, including all five PNG row filters. No new package.
const decodeRgba = (png) => {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width; let height; const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset); const type = png.toString('ascii', offset + 4, offset + 8); const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); assert.equal(body[8], 8); assert.equal(body[9], 6, 'PNG must contain real RGBA'); assert.equal(body[12], 0); }
    if (type === 'IDAT') chunks.push(body);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)); const stride = width * 4; const rgba = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c; const x = Math.abs(p - a); const y = Math.abs(p - b); const z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x; const a = x >= 4 ? rgba[at - 4] : 0; const b = y > 0 ? rgba[at - stride] : 0; const c = y > 0 && x >= 4 ? rgba[at - stride - 4] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      rgba[at] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  return { width, height, rgba };
};

const browserExecutable = process.env.GB_BROWSER_EXECUTABLE;
if (!browserExecutable) { console.log('WEBM_ALPHA_BLOCKED: definí GB_BROWSER_EXECUTABLE con un navegador existente; no se descarga ni instala.'); process.exit(2); }
const output = process.env.GB_SPIKE_DIR ? resolve(process.env.GB_SPIKE_DIR) : mkdtempSync(join(tmpdir(), 'gb-webm-alpha-'));
mkdirSync(output, { recursive: true });
const webm = join(output, 'gb-motion-alpha-spike.webm'); const png = join(output, 'frame-rgba.png');
const tools = binDir(); const exe = (name) => join(tools, process.platform === 'win32' ? `${name}.exe` : name);
const run = (name, args) => {
  const result = spawnSync(exe(name), args, { cwd: tools, windowsHide: true, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${name}: ${(result.stderr ?? result.error?.message ?? 'failed').slice(-2000)}`);
  return result.stdout;
};
try {
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const layer = createTextLayer('UNO DOS', 'alpha-spike'); layer.durationFrames = 90; layer.wordTiming = evenWordTiming(layer.text, 90);
  const props = { layers: [layer], background: 'transparent', customBackground: '#000000' };
  const serveUrl = await bundle({ entryPoint: resolve('src/remotion/index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'GBMotion', inputProps: props, browserExecutable });
  await renderMedia({ composition, serveUrl, inputProps: props, outputLocation: webm, codec: 'vp9', pixelFormat: 'yuva420p', imageFormat: 'png', muted: true, browserExecutable, concurrency: 2 });
  const metadata = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', webm]));
  assert.equal(metadata.streams.find((s) => s.codec_type === 'video').codec_name, 'vp9');
  run('ffmpeg', ['-y', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', webm, '-ss', '1.5', '-frames:v', '1', '-pix_fmt', 'rgba', png]);
  const { width, height, rgba } = decodeRgba(readFileSync(png));
  const black = Buffer.alloc(width * height * 3); const white = Buffer.alloc(black.length);
  let transparent = 0; let opaque = 0;
  for (let i = 0; i < width * height; i++) {
    const alpha = rgba[i * 4 + 3];
    for (let c = 0; c < 3; c++) { black[i * 3 + c] = Math.round(rgba[i * 4 + c] * alpha / 255); white[i * 3 + c] = Math.round(rgba[i * 4 + c] * alpha / 255 + 255 - alpha); }
    if (alpha === 0) { transparent++; assert(black.subarray(i * 3, i * 3 + 3).every((v) => v === 0)); assert(white.subarray(i * 3, i * 3 + 3).every((v) => v === 255)); }
    if (alpha === 255) { opaque++; assert.deepEqual(black.subarray(i * 3, i * 3 + 3), white.subarray(i * 3, i * 3 + 3)); }
  }
  assert(transparent > 0 && opaque > 0, 'real alpha=0 and alpha=255 required');
  console.log(`WEBM_ALPHA_OK AC27 codec=vp9 decoder=libvpx-vp9 PNG=RGBA8 width=${width} height=${height} transparent=${transparent} opaque=${opaque} ffmpeg=${exe('ffmpeg')} browser=${browserExecutable} evidence=${output}`);
} catch (error) { console.error(`WEBM_ALPHA_BLOCKED ${error.message}`); process.exitCode = 2; }
