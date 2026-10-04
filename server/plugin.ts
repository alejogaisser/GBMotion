import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { HttpError, isAllowedOrigin, json, readJson } from './http.ts';
import { handleMedia } from './media.ts';
import { createRenderService } from './render.ts';
import { createTranscribeService } from './transcribe.ts';

export type GbServerOptions = {
  elevenlabsKey?: string;
  groqKey?: string;
  provider?: string;
  mediaDir: string;
  mock: boolean;
};

export const gbMotionPlugin = (options: GbServerOptions): Plugin => ({
  name: 'gb-motion-server',
  configureServer(server) {
    const projectRoot = process.cwd();
    const srcDir = resolve(projectRoot, 'src');
    const port = server.config.server.port ?? 4173;
    const render = createRenderService({ projectRoot, exportsDir: resolve(projectRoot, 'exports'), mediaDir: options.mediaDir, port });

    const transcribe = createTranscribeService(options);

    const invalidateBundle = (file: string) => { if (file.includes(srcDir)) render.invalidateBundle(); };
    server.watcher.on('change', invalidateBundle);
    server.watcher.on('add', invalidateBundle);
    server.watcher.on('unlink', invalidateBundle);

    server.middlewares.use(async (request, response, next) => {
      const path = request.url?.split('?')[0] ?? '';
      const method = request.method ?? 'GET';
      try {
        // Sólo esta app puede escribir en la API local: una web ajena no puede disparar renders ni gastar crédito.
        if ((method === 'POST' || method === 'DELETE') && path.startsWith('/api/') && !isAllowedOrigin(request.headers.origin, port)) {
          return json(response, 403, { error: 'Origen no permitido' });
        }

        if (await handleMedia(request, response, path, options.mediaDir)) return;

        if (method === 'GET' && path.startsWith('/exports/')) {
          const filename = path.slice('/exports/'.length);
          const location = render.exportFile(filename);
          if (location === undefined) return json(response, 400, { error: 'Nombre de archivo inválido' });
          if (location === null) return json(response, 404, { error: 'No encuentro ese archivo' });
          response.setHeader('Content-Type', filename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
          response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          return void createReadStream(location).pipe(response);
        }

        if (method === 'GET' && path === '/api/exports') return json(response, 200, { files: render.listExports() });

        if (method === 'GET' && path.startsWith('/api/render/')) {
          const job = render.status(path.slice('/api/render/'.length));
          if (!job) return json(response, 404, { error: 'No existe ese trabajo de render' });
          return json(response, 200, job);
        }

        if (method === 'DELETE' && path.startsWith('/api/render/')) {
          render.cancel(path.slice('/api/render/'.length));
          return json(response, 200, { status: 'cancelled' });
        }

        if (method === 'GET' && path === '/api/transcribe/providers') return json(response, 200, transcribe.listProviders());

        if (method === 'GET' && path.startsWith('/api/transcribe/')) {
          const job = transcribe.status(path.slice('/api/transcribe/'.length));
          if (!job) return json(response, 404, { error: 'No existe ese trabajo de transcripción' });
          return json(response, 200, job);
        }

        if (method === 'DELETE' && path.startsWith('/api/transcribe/')) {
          transcribe.cancel(path.slice('/api/transcribe/'.length));
          return json(response, 200, { status: 'cancelled' });
        }

        if (method === 'POST' && path === '/api/transcribe') {
          const jobId = await transcribe.start(await readJson(request, 64 * 1024));
          return json(response, 202, { jobId });
        }

        if (method === 'POST' && path === '/api/render') {
          const jobId = await render.start(await readJson(request));
          return json(response, 202, { jobId });
        }
      } catch (error) {
        if (response.headersSent) return;
        if (error instanceof HttpError) return json(response, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) });
        // Mensaje fijo: el texto de un error inesperado podría arrastrar datos que no deben salir.
        return json(response, 500, { error: 'Algo salió mal en el servidor local.' });
      }
      return next();
    });
  },
});
