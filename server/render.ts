import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { CompositionProps, VideoFormat } from '../src/types/motion.ts';
import { videoFormats } from '../src/types/motion.ts';
import { HttpError } from './http.ts';
import { probe } from './ffmpeg.ts';
import { FPS, isMediaId, mediaPath } from './media.ts';

export type ExportKind = 'mp4' | 'green' | 'alpha' | 'burn';
type JobStatus = 'rendering' | 'done' | 'error' | 'cancelled';
type Job = { progress: number; status: JobStatus; url?: string; error?: string; cancel: () => void };

export const BUSY_MESSAGE = 'Ya hay un video en proceso. Esperá a que termine o cancelalo.';
export const NO_VIDEO_MESSAGE = 'Subí un video en «Video» para exportarlo con subtítulos.';

/** Sólo los tamaños que ofrece la app: el id y las dos medidas tienen que coincidir. */
export const isSupportedFormat = (value: unknown): value is VideoFormat => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return videoFormats.some((format) => format.id === item.id && format.width === item.width && format.height === item.height);
};

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type RenderOptions = { projectRoot: string; exportsDir: string; mediaDir: string; port: number };

export const createRenderService = ({ projectRoot, exportsDir, mediaDir, port }: RenderOptions) => {
  mkdirSync(exportsDir, { recursive: true });
  let bundlePromise: Promise<string> | undefined;
  const getBundle = () => bundlePromise ??= import('@remotion/bundler').then(({ bundle }) => bundle({ entryPoint: resolve(projectRoot, 'src/remotion/index.ts') }));
  const jobs = new Map<string, Job>();
  const isBusy = () => [...jobs.values()].some((job) => job.status === 'rendering');

  const run = async (jobId: string, props: CompositionProps, format: VideoFormat, kind: ExportKind) => {
    const job = jobs.get(jobId)!;
    const wasCancelled = () => job.status === 'cancelled';
    try {
      const { makeCancelSignal, renderMedia, selectComposition } = await import('@remotion/renderer');
      const { cancelSignal, cancel } = makeCancelSignal();
      job.cancel = cancel;
      if (wasCancelled()) return;
      const serveUrl = await getBundle();
      const base = await selectComposition({ serveUrl, id: 'GBMotion', inputProps: props as unknown as Record<string, unknown> });
      const composition = { ...base, width: format.width, height: format.height };
      const filename = `gb-motion-${kind}-${Date.now()}.${kind === 'alpha' ? 'mov' : 'mp4'}`;
      const common = {
        composition,
        serveUrl,
        outputLocation: resolve(exportsDir, filename),
        inputProps: props as unknown as Record<string, unknown>,
        cancelSignal,
        // Sólo «Video con tus subtítulos» lleva audio; el resto sale sin pista de audio.
        muted: kind !== 'burn',
        onProgress: ({ progress }: { progress: number }) => { job.progress = progress; },
      };
      await (kind === 'alpha'
        ? renderMedia({ ...common, codec: 'prores', proResProfile: '4444', pixelFormat: 'yuva444p10le', imageFormat: 'png' })
        : renderMedia({ ...common, codec: 'h264' }));
      if (!wasCancelled()) {
        job.status = 'done';
        job.progress = 1;
        job.url = `/exports/${filename}`;
      }
    } catch (error) {
      bundlePromise = undefined;
      if (!wasCancelled()) {
        job.status = 'error';
        job.error = error instanceof Error ? error.message : 'No se pudo crear el video.';
      }
    }
  };

  /** Valida el pedido, reserva el único lugar de render y lo lanza. Devuelve el id del trabajo. */
  const start = async (body: unknown): Promise<string> => {
    if (!record(body) || !record(body.props) || !Array.isArray(body.props.layers)) throw new HttpError(400, 'Faltan los datos del video.');
    const requested = body.format;
    if (!isSupportedFormat(requested)) throw new HttpError(400, 'Ese tamaño de video no está disponible.');
    const format = videoFormats.find((item) => item.id === requested.id)!;
    const kind: ExportKind = body.kind === 'green' || body.kind === 'alpha' || body.kind === 'burn' ? body.kind : 'mp4';
    const props = { ...body.props } as unknown as CompositionProps;
    delete props.guide;

    let burn: { mediaId: string; name: string; volume: number } | null = null;
    if (kind === 'burn') {
      const media = record(body.media) ? body.media : null;
      if (!media || media.mediaId === undefined || media.mediaId === null || media.mediaId === '') throw new HttpError(400, NO_VIDEO_MESSAGE);
      if (!isMediaId(media.mediaId) || !existsSync(mediaPath(mediaDir, media.mediaId))) throw new HttpError(400, 'No encuentro ese video. Volvé a subirlo en «Video».');
      const volume = typeof media.volume === 'number' && Number.isFinite(media.volume) ? Math.min(1, Math.max(0, media.volume)) : 1;
      burn = { mediaId: media.mediaId, name: typeof media.name === 'string' ? media.name.slice(0, 200) : 'video', volume };
    }

    if (isBusy()) throw new HttpError(409, BUSY_MESSAGE);
    const jobId = randomUUID();
    jobs.set(jobId, { progress: 0, status: 'rendering', cancel: () => {} });
    if (burn) {
      try {
        const info = await probe(mediaPath(mediaDir, burn.mediaId));
        // La URL la arma el servidor: un `src` mandado por el cliente nunca se usa.
        props.guide = { src: `http://127.0.0.1:${port}/media/${burn.mediaId}`, name: burn.name, durationInFrames: Math.max(1, Math.round(info.durationSec * FPS)), volume: burn.volume };
      } catch {
        jobs.delete(jobId);
        throw new HttpError(400, 'No pude leer ese video. Volvé a subirlo en «Video».');
      }
    }
    void run(jobId, props, format, kind);
    return jobId;
  };

  const status = (jobId: string) => {
    const job = jobs.get(jobId);
    return job ? { status: job.status, progress: job.progress, url: job.url, error: job.error } : null;
  };

  const cancel = (jobId: string) => {
    const job = jobs.get(jobId);
    if (job && job.status === 'rendering') { job.status = 'cancelled'; job.cancel(); }
  };

  const listExports = () => readdirSync(exportsDir)
    .filter((name) => /^gb-motion-[a-z]+-\d+\.(mp4|mov)$/i.test(name))
    .map((name) => ({ name, at: statSync(resolve(exportsDir, name)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12)
    .map((item) => ({ url: `/exports/${item.name}`, name: item.name, at: item.at }));

  const exportFile = (filename: string): string | null | undefined => {
    if (!/^[a-z0-9-]+\.(mp4|mov)$/i.test(filename)) return undefined;
    const location = resolve(exportsDir, filename);
    return existsSync(location) ? location : null;
  };

  const invalidateBundle = () => { bundlePromise = undefined; };

  return { start, status, cancel, listExports, exportFile, invalidateBundle };
};
