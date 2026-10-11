import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { CompositionProps, VideoFormat } from '../src/types/motion.ts';
import { videoFormats } from '../src/types/motion.ts';
import { HttpError } from './http.ts';
import { probe } from './ffmpeg.ts';
import { FPS, isMediaId, mediaPath } from './media.ts';
import { pruneFinishedJobs } from './jobs.ts';
import { validateRenderInput } from './renderInput.ts';
export { isSupportedFormat } from './renderInput.ts';

export type ExportKind = 'mp4' | 'green' | 'alpha' | 'alpha-webm' | 'burn';
type JobStatus = 'rendering' | 'done' | 'error' | 'cancelled';
type Job = { progress: number; status: JobStatus; url?: string; error?: string; cancel: () => void; createdAt: number; finishedAt?: number; active: boolean };

export const BUSY_MESSAGE = 'Ya hay un video en proceso. Esperá a que termine o cancelalo.';
export const NO_VIDEO_MESSAGE = 'Subí un video en «Video» para exportarlo con subtítulos.';

/** Sólo los tamaños que ofrece la app: el id y las dos medidas tienen que coincidir. */
type RenderOptions = { projectRoot: string; exportsDir: string; mediaDir: string; port: number };

export const createRenderService = ({ projectRoot, exportsDir, mediaDir, port }: RenderOptions) => {
  mkdirSync(exportsDir, { recursive: true });
  let bundlePromise: Promise<string> | undefined;
  const getBundle = () => bundlePromise ??= import('@remotion/bundler').then(({ bundle }) => bundle({ entryPoint: resolve(projectRoot, 'src/remotion/index.ts') }));
  const jobs = new Map<string, Job>();
  const pending = new Set<Promise<void>>();
  let closed = false;
  const isBusy = () => [...jobs.values()].some((job) => job.active);

  const run = async (jobId: string, props: CompositionProps, format: VideoFormat, kind: ExportKind) => {
    const job = jobs.get(jobId)!;
    const wasCancelled = () => job.status === 'cancelled';
    let partial: string | undefined;
    try {
      const { makeCancelSignal, renderMedia, selectComposition } = await import('@remotion/renderer');
      const { cancelSignal, cancel } = makeCancelSignal();
      job.cancel = cancel;
      if (wasCancelled()) return;
      const serveUrl = await getBundle();
      if (wasCancelled()) return;
      const base = await selectComposition({ serveUrl, id: 'GBMotion', inputProps: props as unknown as Record<string, unknown> });
      if (wasCancelled()) return;
      const composition = { ...base, width: format.width, height: format.height };
      const filename = `gb-motion-${kind}-${Date.now()}.${kind === 'alpha' ? 'mov' : kind === 'alpha-webm' ? 'webm' : 'mp4'}`;
      partial = resolve(exportsDir, filename.replace(/\.(mp4|mov|webm)$/, `.partial-${jobId}.$1`));
      const common = {
        composition,
        serveUrl,
        outputLocation: partial,
        inputProps: props as unknown as Record<string, unknown>,
        cancelSignal,
        // Sólo «Video con tus subtítulos» lleva audio; el resto sale sin pista de audio.
        muted: kind !== 'burn',
        onProgress: ({ progress }: { progress: number }) => { if (!wasCancelled()) job.progress = progress; },
      };
      await (kind === 'alpha'
        ? renderMedia({ ...common, codec: 'prores', proResProfile: '4444', pixelFormat: 'yuva444p10le', imageFormat: 'png' })
        : kind === 'alpha-webm' ? renderMedia({ ...common, codec: 'vp9', pixelFormat: 'yuva420p', imageFormat: 'png' })
        : renderMedia({ ...common, codec: 'h264' }));
      if (!wasCancelled()) {
        if (statSync(partial).size === 0) throw new Error('empty render');
        const destination = resolve(exportsDir, filename);
        await rename(partial, destination);
        if (wasCancelled()) { await rm(destination, { force: true }); return; }
        job.status = 'done';
        job.progress = 1;
        job.url = `/exports/${filename}`;
      }
    } catch (error) {
      bundlePromise = undefined;
      if (!wasCancelled()) {
        job.status = 'error';
        job.error = 'No pude crear el video. Revisá el proyecto y volvé a exportarlo.';
      }
    } finally {
      if (partial) await rm(partial, { force: true }).catch(() => {});
      job.active = false;
      job.finishedAt = Date.now();
    }
  };

  /** Valida el pedido, reserva el único lugar de render y lo lanza. Devuelve el id del trabajo. */
  const start = async (body: unknown): Promise<string> => {
    const input = validateRenderInput(body);
    if (closed) throw new HttpError(503, 'El servidor se está cerrando. Volvé a abrir GB Motion.');
    const requested = input.format;
    const format = videoFormats.find((item) => item.id === requested.id)!;
    const kind = input.kind;
    const props = input.props;
    delete props.guide;

    let burn: { mediaId: string; name: string; volume: number } | null = null;
    if (kind === 'burn') {
      const media = input.media;
      if (!media || media.mediaId === undefined || media.mediaId === null || media.mediaId === '') throw new HttpError(400, NO_VIDEO_MESSAGE);
      if (!isMediaId(media.mediaId) || !existsSync(mediaPath(mediaDir, media.mediaId))) throw new HttpError(400, 'No encuentro ese video. Volvé a subirlo en «Video».');
      const volume = typeof media.volume === 'number' && Number.isFinite(media.volume) ? Math.min(1, Math.max(0, media.volume)) : 1;
      burn = { mediaId: media.mediaId, name: typeof media.name === 'string' ? media.name.slice(0, 200) : 'video', volume };
    }

    if (isBusy()) throw new HttpError(409, BUSY_MESSAGE);
    pruneFinishedJobs(jobs);
    const jobId = randomUUID();
    jobs.set(jobId, { progress: 0, status: 'rendering', cancel: () => {}, createdAt: Date.now(), active: true });
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
    const task = run(jobId, props, format, kind);
    pending.add(task);
    void task.finally(() => pending.delete(task));
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
    .filter((name) => /^gb-motion-(mp4|green|alpha|alpha-webm|burn)-\d+\.(mp4|mov|webm)$/i.test(name) && statSync(resolve(exportsDir, name)).isFile() && statSync(resolve(exportsDir, name)).size > 0)
    .map((name) => ({ name, at: statSync(resolve(exportsDir, name)).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12)
    .map((item) => ({ url: `/exports/${item.name}`, name: item.name, at: item.at }));

  const exportFile = (filename: string): string | null | undefined => {
    if (!/^gb-motion-(mp4|green|alpha|alpha-webm|burn)-\d+\.(mp4|mov|webm)$/i.test(filename)) return undefined;
    const location = resolve(exportsDir, filename);
    return existsSync(location) && statSync(location).isFile() && statSync(location).size > 0 ? location : null;
  };

  const invalidateBundle = () => { bundlePromise = undefined; };

  const close = async () => { closed = true; for (const id of jobs.keys()) cancel(id); await Promise.allSettled([...pending]); };
  return { start, status, cancel, listExports, exportFile, invalidateBundle, close };
};
