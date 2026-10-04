import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { gbMotionPlugin } from './server/plugin.ts';

export default defineConfig(({ mode }) => {
  // Las claves se leen sólo acá, en el servidor. Ninguna lleva el prefijo VITE_,
  // así que Vite nunca las mete en el código que baja al navegador.
  const env = loadEnv(mode, process.cwd(), '');
  const mediaDir = env.GB_MEDIA_DIR
    || (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'gb-motion', 'media') : join(homedir(), '.gb-motion', 'media'));
  return {
    plugins: [
      react(),
      gbMotionPlugin({
        elevenlabsKey: env.ELEVENLABS_API_KEY || undefined,
        groqKey: env.GROQ_API_KEY || undefined,
        provider: env.GB_TRANSCRIBE_PROVIDER || undefined,
        mediaDir,
        mock: env.GB_TRANSCRIBE_MOCK === '1',
      }),
    ],
    server: {
      host: '127.0.0.1',
      port: 4173,
      watch: { ignored: ['**/exports/**', '**/media/**', '**/backups/**'] },
    },
    build: { target: 'es2022', chunkSizeWarningLimit: 600 },
  };
});
