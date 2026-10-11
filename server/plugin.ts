import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { createGbMotionHandler } from './app.ts';
import type { TranscribeOptions } from './transcribe.ts';

export type GbServerOptions = TranscribeOptions;

/** Vite sólo aporta transporte y la invalidación del bundle del editor. */
export const gbMotionPlugin = (options: GbServerOptions): Plugin => ({
  name: 'gb-motion-server',
  configureServer(server) {
    const projectRoot = process.cwd();
    const srcDir = resolve(projectRoot, 'src');
    const app = createGbMotionHandler({ projectRoot, exportsDir: resolve(projectRoot, 'exports'), mediaDir: options.mediaDir,
      port: server.config.server.port ?? 4173, stt: options });
    const invalidate = (file: string) => { if (file.startsWith(srcDir)) app.invalidateBundle(); };
    for (const event of ['change', 'add', 'unlink']) server.watcher.on(event, invalidate);
    server.httpServer?.once('close', () => { void app.close(); });
    server.middlewares.use((req, res, next) => { void app.handle(req, res).then((handled) => { if (!handled) next(); }).catch(next); });
  },
});
