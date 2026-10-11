import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGbMotionHandler } from './app.ts';
import { loadGbServerConfig } from './config.ts';
import { json } from './http.ts';

const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

export const startRuntime = async (projectRoot: string) => {
  const config = loadGbServerConfig(projectRoot);
  const dist = resolve(config.projectRoot, 'dist');
  for (const name of ['index.html', 'editor/index.html', '404.html']) {
    if (!existsSync(resolve(dist, name))) throw new Error('Falta el build. Ejecutá npm run build antes de iniciar GB Motion.');
  }
  const app = createGbMotionHandler(config);
  const server = createServer((req, res) => {
    void (async () => {
      if (await app.handle(req, res)) return;
      let path: string;
      try { path = decodeURIComponent((req.url ?? '/').split('?')[0]); } catch { return json(res, 400, { error: 'La dirección no es válida.' }); }
      if (path === '/editor') { res.writeHead(308, { Location: '/editor/' }); res.end(); return; }
      const relative = path === '/' ? 'index.html' : path === '/editor/' ? 'editor/index.html' : path.slice(1);
      let location = resolve(dist, relative);
      const safe = location.startsWith(`${dist}${sep}`) && !path.includes('\\') && !path.split('/').includes('..');
      const found = safe && existsSync(location) && statSync(location).isFile();
      if (!found) location = resolve(dist, '404.html');
      res.statusCode = found ? 200 : 404;
      res.setHeader('Content-Type', mime[extname(location)] ?? 'application/octet-stream');
      if (req.method === 'HEAD') { res.end(); return; }
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
      createReadStream(location).on('error', () => res.destroy()).pipe(res);
    })().catch(() => { if (!res.headersSent) json(res, 500, { error: 'Algo salió mal en el servidor local.' }); });
  });
  try {
    await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(config.port, config.host, () => { server.off('error', fail); done(); }); });
  } catch (error) { await app.close(); throw error; }
  const close = async () => { const stopped = new Promise<void>((done) => server.close(() => done())); await app.close(); server.closeIdleConnections(); await stopped; };
  return { server, close };
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  startRuntime(projectRoot).then(({ close }) => {
    const stop = () => { void close().then(() => process.exit(0)); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    console.log('GB Motion local listo. Abrí /editor/ en el puerto configurado.');
  }).catch(() => { console.error('No pude iniciar GB Motion. Revisá GB_PORT, el puerto disponible y ejecutá npm run build.'); process.exitCode = 1; });
}
