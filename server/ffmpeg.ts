import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const exe = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

let cachedDir: string | undefined;

/** Carpeta del ffmpeg que trae Remotion. `GB_FFMPEG_DIR` manda sobre lo demás. */
export const binDir = (): string => {
  if (cachedDir) return cachedDir;
  const fromEnv = process.env.GB_FFMPEG_DIR;
  if (fromEnv && existsSync(join(fromEnv, exe('ffmpeg')))) return (cachedDir = fromEnv);
  const candidates: string[] = [];
  const pnpmStore = resolve(process.cwd(), 'node_modules', '.pnpm');
  if (existsSync(pnpmStore)) {
    for (const entry of readdirSync(pnpmStore)) {
      if (entry.startsWith('@remotion+compositor-')) {
        const name = entry.slice('@remotion+'.length).replace(/@[^@]*$/, '');
        candidates.push(join(pnpmStore, entry, 'node_modules', '@remotion', name));
      }
    }
  }
  const flat = resolve(process.cwd(), 'node_modules', '@remotion');
  if (existsSync(flat)) for (const entry of readdirSync(flat)) if (entry.startsWith('compositor-')) candidates.push(join(flat, entry));
  const found = candidates.find((dir) => existsSync(join(dir, exe('ffmpeg'))));
  if (!found) throw new Error('No encuentro ffmpeg. Definí GB_FFMPEG_DIR en .env.local.');
  return (cachedDir = found);
};

type RunResult = { code: number; stdout: string; stderr: string };

/** Corre un binario de la carpeta de ffmpeg con ella como cwd, para que se resuelvan las DLL. */
const run = (tool: 'ffmpeg' | 'ffprobe', args: string[], signal?: AbortSignal): Promise<RunResult> => new Promise((resolveRun, reject) => {
  const child = spawn(join(binDir(), exe(tool)), args, { cwd: binDir(), windowsHide: true, signal });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-4000); });
  child.on('error', reject);
  child.on('close', (code) => resolveRun({ code: code ?? 1, stdout, stderr }));
});

export type ProbeResult = { durationSec: number; width: number; height: number; hasAudio: boolean };

type Stream = { codec_type?: string; width?: number; height?: number; duration?: string; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } };

export const probe = async (file: string): Promise<ProbeResult> => {
  const result = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', resolve(file)]);
  if (result.code !== 0) throw new Error('ffprobe no pudo leer el archivo');
  const data = JSON.parse(result.stdout) as { streams?: Stream[]; format?: { duration?: string } };
  const streams = data.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video' && (stream.width ?? 0) > 0);
  if (!video) throw new Error('El archivo no tiene video');
  const durationSec = Number(data.format?.duration ?? video.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('Duración desconocida');
  const rotation = Math.abs(Number(video.side_data_list?.find((item) => item.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0)) % 180;
  const width = video.width ?? 0;
  const height = video.height ?? 0;
  return {
    durationSec,
    width: rotation === 90 ? height : width,
    height: rotation === 90 ? width : height,
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  };
};

/**
 * Saca el audio en mono a 16 kHz. `outBase` va sin extensión; devuelve la ruta real.
 * Si este ffmpeg no trae libmp3lame, cae a WAV.
 */
export const extractAudio = async (file: string, outBase: string, signal?: AbortSignal): Promise<string> => {
  file = resolve(file);
  outBase = resolve(outBase);
  const mp3 = `${outBase}.mp3`;
  const first = await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '64k', mp3], signal);
  if (first.code === 0) return mp3;
  const wav = `${outBase}.wav`;
  const second = await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], signal);
  if (second.code !== 0) throw new Error('No pude extraer el audio');
  return wav;
};
