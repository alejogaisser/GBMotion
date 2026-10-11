import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadEnv } from 'vite';
import type { GbHandlerOptions } from './app.ts';

export const loadGbServerConfig = (projectRoot: string, mode = 'production'): GbHandlerOptions & { host: '127.0.0.1' } => {
  const root = resolve(projectRoot);
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const rawPort = env.GB_PORT ?? '4173';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('GB_PORT debe ser un puerto entre 1 y 65535.');
  const mediaDir = resolve(root, env.GB_MEDIA_DIR || (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'gb-motion', 'media') : join(homedir(), '.gb-motion', 'media')));
  return { projectRoot: root, exportsDir: resolve(root, 'exports'), mediaDir, host: '127.0.0.1', port,
    stt: { mediaDir, elevenlabsKey: env.ELEVENLABS_API_KEY || undefined, groqKey: env.GROQ_API_KEY || undefined,
      provider: env.GB_TRANSCRIBE_PROVIDER || undefined, mock: env.GB_TRANSCRIBE_MOCK === '1' } };
};
