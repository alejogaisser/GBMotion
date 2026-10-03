import { createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer';
import type { CompositionProps, VideoFormat } from './src/types/motion.ts';

const readJson = (request: IncomingMessage) => new Promise<unknown>((resolveBody, reject) => {
  let body = '';
  request.on('data', (chunk) => {
    body += String(chunk);
    if (body.length > 1_000_000) reject(new Error('Request is too large'));
  });
  request.on('end', () => {
    try { resolveBody(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
  });
  request.on('error', reject);
});

const json = (response: ServerResponse, status: number, payload: unknown) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
};

type ExportKind = 'mp4' | 'green' | 'alpha';
type Job = { progress: number; status: 'rendering' | 'done' | 'error' | 'cancelled'; url?: string; error?: string; cancel: () => void };

const renderPlugin = (): Plugin => {
  const projectRoot = process.cwd();
  const exportsDir = resolve(projectRoot, 'exports');
  mkdirSync(exportsDir, { recursive: true });
  let bundlePromise: Promise<string> | undefined;
  const getBundle = () => bundlePromise ??= bundle({ entryPoint: resolve(projectRoot, 'src/remotion/index.ts') });
  const jobs = new Map<string, Job>();

  const startRender = (jobId: string, props: CompositionProps, format: VideoFormat, kind: ExportKind) => {
    const job = jobs.get(jobId)!;
    const { cancelSignal, cancel } = makeCancelSignal();
    job.cancel = cancel;
    void (async () => {
      try {
        const serveUrl = await getBundle();
        const base = await selectComposition({ serveUrl, id: 'GBMotion', inputProps: props });
        const composition = { ...base, width: format.width, height: format.height };
        const filename = `gb-motion-${kind}-${Date.now()}.${kind === 'alpha' ? 'mov' : 'mp4'}`;
        const common = {
          composition,
          serveUrl,
          outputLocation: resolve(exportsDir, filename),
          inputProps: props,
          cancelSignal,
          onProgress: ({ progress }: { progress: number }) => { job.progress = progress; },
        };
        await (kind === 'alpha'
          ? renderMedia({ ...common, codec: 'prores', proResProfile: '4444', pixelFormat: 'yuva444p10le', imageFormat: 'png' })
          : renderMedia({ ...common, codec: 'h264' }));
        job.status = 'done';
        job.progress = 1;
        job.url = `/exports/${filename}`;
      } catch (error) {
        bundlePromise = undefined;
        if (job.status !== 'cancelled') {
          job.status = 'error';
          job.error = error instanceof Error ? error.message : 'Render failed';
        }
      }
    })();
  };

  return {
    name: 'gb-motion-renderer',
    configureServer(server) {
      const invalidateBundle = (file: string) => {
        if (file.includes(`${resolve(projectRoot, 'src')}`)) bundlePromise = undefined;
      };
      server.watcher.on('change', invalidateBundle);
      server.watcher.on('add', invalidateBundle);
      server.watcher.on('unlink', invalidateBundle);
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';

        if (request.method === 'GET' && path.startsWith('/exports/')) {
          const filename = path.slice('/exports/'.length);
          if (!/^[a-z0-9-]+\.(mp4|mov)$/i.test(filename)) return json(response, 400, { error: 'Invalid filename' });
          const location = resolve(exportsDir, filename);
          if (!existsSync(location)) return json(response, 404, { error: 'File not found' });
          response.setHeader('Content-Type', filename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
          response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          return createReadStream(location).pipe(response);
        }

        if (request.method === 'GET' && path === '/api/exports') {
          const files = readdirSync(exportsDir)
            .filter((name) => /^gb-motion-[a-z]+-\d+\.(mp4|mov)$/i.test(name))
            .map((name) => ({ name, at: statSync(resolve(exportsDir, name)).mtimeMs }))
            .sort((a, b) => b.at - a.at)
            .slice(0, 12)
            .map((item) => ({ url: `/exports/${item.name}`, name: item.name, at: item.at }));
          return json(response, 200, { files });
        }

        if (request.method === 'GET' && path.startsWith('/api/render/')) {
          const job = jobs.get(path.slice('/api/render/'.length));
          if (!job) return json(response, 404, { error: 'No existe ese trabajo de render' });
          return json(response, 200, { status: job.status, progress: job.progress, url: job.url, error: job.error });
        }

        if (request.method === 'DELETE' && path.startsWith('/api/render/')) {
          const job = jobs.get(path.slice('/api/render/'.length));
          if (job && job.status === 'rendering') { job.status = 'cancelled'; job.cancel(); }
          return json(response, 200, { status: 'cancelled' });
        }

        if (request.method !== 'POST' || path !== '/api/render') return next();
        try {
          const body = await readJson(request) as { props: CompositionProps; format: VideoFormat; kind?: ExportKind };
          const kind: ExportKind = body.kind === 'green' || body.kind === 'alpha' ? body.kind : 'mp4';
          if (!body.props || !body.format || ![1080, 1920].includes(body.format.width) || ![1080, 1920].includes(body.format.height)) throw new Error('Invalid render settings');
          const jobId = randomUUID();
          jobs.set(jobId, { progress: 0, status: 'rendering', cancel: () => {} });
          startRender(jobId, body.props, body.format, kind);
          return json(response, 202, { jobId });
        } catch (error) {
          return json(response, 500, { error: error instanceof Error ? error.message : 'Render failed' });
        }
      });
    }
  };
};

export default defineConfig({ plugins: [react(), renderPlugin()], server: { host: '127.0.0.1', port: 4173 }, build: { target: 'es2022', chunkSizeWarningLimit: 600 } });
