import { createReadStream } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, isAllowedOrigin, json, readJson } from './http.ts';
import { handleMedia } from './media.ts';
import { createRenderService } from './render.ts';
import { createTranscribeService } from './transcribe.ts';

export type GbHandlerOptions = { projectRoot: string; exportsDir: string; port: number; mediaDir: string; stt: {
  elevenlabsKey?: string;
  groqKey?: string;
  provider?: string;
  mediaDir: string;
  mock: boolean; };
};

export const createGbMotionHandler = (options: GbHandlerOptions) => {
  const { projectRoot, exportsDir, port } = options;
  const render = createRenderService({ projectRoot, exportsDir, mediaDir: options.mediaDir, port });

  const transcribe = createTranscribeService({ ...options.stt, mediaDir: options.mediaDir });

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const path = request.url?.split('?')[0] ?? '';
    const method = request.method ?? 'GET';
    const send = (status: number, payload: unknown) => { json(response, status, payload); return true; };
    try {
      // Sólo esta app puede escribir en la API local: una web ajena no puede disparar renders ni gastar crédito.
      if ((method === 'POST' || method === 'DELETE') && path.startsWith('/api/') && !isAllowedOrigin(request.headers.origin, port)) {
        return send(403, { error: 'Origen no permitido' });
      }

      if (path === '/api/health' && method === 'GET') return send(200, { version: 1, mode: 'local', transcriptionMode: options.stt.mock ? 'mock' : options.stt.elevenlabsKey || options.stt.groqKey ? 'provider' : 'unconfigured', capabilities: { upload: true, render: true, transcribe: options.stt.mock || Boolean(options.stt.elevenlabsKey || options.stt.groqKey) } });
      if (await handleMedia(request, response, path, options.mediaDir)) return true;

      if (method === 'GET' && path.startsWith('/exports/')) {
        const filename = path.slice('/exports/'.length);
        const location = render.exportFile(filename);
        if (location === undefined) return send(400, { error: 'Nombre de archivo inválido' });
        if (location === null) return send(404, { error: 'No encuentro ese archivo' });
        response.setHeader('Content-Type', filename.endsWith('.mov') ? 'video/quicktime' : filename.endsWith('.webm') ? 'video/webm' : 'video/mp4');
        response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        createReadStream(location).on('error', () => response.destroy()).pipe(response); return true;
      }

      if (method === 'GET' && path === '/api/exports') return send(200, { files: render.listExports() });

      if (method === 'GET' && path.startsWith('/api/render/')) {
        const job = render.status(path.slice('/api/render/'.length));
        if (!job) return send(404, { error: 'No existe ese trabajo de render' });
        return send(200, job);
      }

      if (method === 'DELETE' && path.startsWith('/api/render/')) {
        render.cancel(path.slice('/api/render/'.length));
        return send(200, { status: 'cancelled' });
      }

      if (method === 'GET' && path === '/api/transcribe/providers') return send(200, transcribe.listProviders());

      if (method === 'GET' && path.startsWith('/api/transcribe/')) {
        const job = transcribe.status(path.slice('/api/transcribe/'.length));
        if (!job) return send(404, { error: 'No existe ese trabajo de transcripción' });
        return send(200, job);
      }

      if (method === 'DELETE' && path.startsWith('/api/transcribe/')) {
        transcribe.cancel(path.slice('/api/transcribe/'.length));
        return send(200, { status: 'cancelled' });
      }

      if (method === 'POST' && path === '/api/transcribe') {
        const jobId = await transcribe.start(await readJson(request, 64 * 1024));
        return send(202, { jobId });
      }

      if (method === 'POST' && path === '/api/render') {
        const jobId = await render.start(await readJson(request));
        return send(202, { jobId });
      }
    } catch (error) {
      if (response.headersSent) return true;
      if (error instanceof HttpError) return send(error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) });
      // Mensaje fijo: el texto de un error inesperado podría arrastrar datos que no deben salir.
      return send(500, { error: 'Algo salió mal en el servidor local.' });
    }
    if (path.startsWith('/api/')) return send(404, { error: 'No existe esa ruta de la API.' });
    return false;
  };
  return { handle, invalidateBundle: render.invalidateBundle, close: async () => { await Promise.all([render.close(), transcribe.close()]); } };
};
