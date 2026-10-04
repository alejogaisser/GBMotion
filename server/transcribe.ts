import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { TimedWord, TranscribeLanguage, TranscribeProviderId } from '../src/captions/types.ts';
import { fromElevenLabs, fromGroq } from '../src/captions/providers.ts';
import { HttpError } from './http.ts';
import { extractAudio, probe } from './ffmpeg.ts';
import { isMediaId, mediaPath } from './media.ts';

export type TranscribeOptions = {
  elevenlabsKey?: string;
  groqKey?: string;
  provider?: string;
  mediaDir: string;
  mock: boolean;
};

type Stage = 'extracting' | 'uploading' | 'transcribing' | 'done' | 'error';
type JobStatus = 'running' | 'done' | 'error' | 'cancelled';
type Job = {
  status: JobStatus;
  stage: Stage;
  words?: TimedWord[];
  error?: string;
  cached?: boolean;
  abort: AbortController;
  createdAt: number;
};

const PROVIDERS: { id: TranscribeProviderId; label: string; short: string }[] = [
  { id: 'elevenlabs', label: 'ElevenLabs Scribe v2', short: 'ElevenLabs' },
  { id: 'groq', label: 'Groq Whisper large-v3', short: 'Groq' },
];
const LANGUAGES: TranscribeLanguage[] = ['es', 'auto', 'en', 'pt'];
const GROQ_LIMIT_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 600_000;

export const MISSING_KEY_MESSAGE = 'Falta la clave de la IA. Agregá ELEVENLABS_API_KEY o GROQ_API_KEY en .env.local y reiniciá GB Motion.';
export const NO_AUDIO_MESSAGE = 'Ese video no tiene audio.';

const shortName = (provider: TranscribeProviderId) => PROVIDERS.find((item) => item.id === provider)?.short ?? 'la IA';

/** Error de un proveedor: sólo el código HTTP, nunca el cuerpo ni los encabezados (ahí podría ir la clave). */
export class ProviderError extends Error {
  status?: number;
  constructor(status?: number) {
    super(`provider status ${status ?? 'none'}`);
    this.status = status;
  }
}

/**
 * Traduce cualquier falla de un proveedor a un mensaje en español. Mira sólo el
 * código HTTP y el tipo de error: el texto del error original no se usa, así que la
 * clave nunca llega al mensaje.
 */
export const mapProviderError = (provider: TranscribeProviderId, error: unknown): string => {
  const name = shortName(provider);
  const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined;
  if (status === 401 || status === 403) return `La clave de ${name} no es válida.`;
  if (status === 429) return `Límite de uso de ${name}. Probá en unos minutos.`;
  if (status === 413) return `El audio es demasiado largo para ${name}.`;
  const errorName = (error as { name?: unknown })?.name;
  if (errorName === 'TimeoutError') return `${name} tardó demasiado en responder.`;
  if (status !== undefined) return `${name} no pudo transcribir el audio (error ${status}).`;
  return `Sin conexión con ${name}.`;
};

export const createTranscribeService = (options: TranscribeOptions) => {
  const jobs = new Map<string, Job>();
  const keyFor = (provider: TranscribeProviderId) => (provider === 'elevenlabs' ? options.elevenlabsKey : options.groqKey);
  const isConfigured = (provider: TranscribeProviderId) => Boolean(keyFor(provider)) || (options.mock && provider === 'elevenlabs');

  const listProviders = () => ({ providers: PROVIDERS.map(({ id, label }) => ({ id, label, configured: isConfigured(id) })) });

  const chooseProvider = (requested: unknown): TranscribeProviderId => {
    const wanted = PROVIDERS.find((item) => item.id === requested)?.id
      ?? PROVIDERS.find((item) => item.id === options.provider)?.id;
    if (wanted && isConfigured(wanted)) return wanted;
    const found = PROVIDERS.find((item) => isConfigured(item.id));
    if (!found) throw new HttpError(412, MISSING_KEY_MESSAGE, 'missing_key');
    return found.id;
  };

  const cacheFile = (mediaId: string, provider: string, language: string) => resolve(options.mediaDir, `${mediaId}.${provider}.${language}.json`);

  const callProvider = async (provider: TranscribeProviderId, audioFile: string, language: TranscribeLanguage, signal: AbortSignal): Promise<TimedWord[]> => {
    const audio = new Blob([await readFile(audioFile)]);
    const form = new FormData();
    const name = basename(audioFile);
    let url: string;
    let headers: Record<string, string>;
    if (provider === 'elevenlabs') {
      url = 'https://api.elevenlabs.io/v1/speech-to-text';
      headers = { 'xi-api-key': options.elevenlabsKey ?? '' };
      form.append('model_id', 'scribe_v2');
      if (language !== 'auto') form.append('language_code', language);
      form.append('timestamps_granularity', 'word');
      form.append('tag_audio_events', 'false');
      form.append('file', audio, name);
    } else {
      url = 'https://api.groq.com/openai/v1/audio/transcriptions';
      headers = { Authorization: `Bearer ${options.groqKey ?? ''}` };
      form.append('model', 'whisper-large-v3');
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      if (language !== 'auto') form.append('language', language);
      form.append('file', audio, name);
    }
    const response = await fetch(url, { method: 'POST', headers, body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) });
    if (!response.ok) throw new ProviderError(response.status);
    const payload: unknown = await response.json();
    return provider === 'elevenlabs' ? fromElevenLabs(payload) : fromGroq(payload);
  };

  const run = async (jobId: string, mediaId: string, provider: TranscribeProviderId, language: TranscribeLanguage) => {
    const job = jobs.get(jobId)!;
    const aborted = () => job.abort.signal.aborted;
    const cache = cacheFile(mediaId, options.mock ? 'mock' : provider, language);
    let workDir: string | undefined;
    let stageTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (existsSync(cache)) {
        console.log(`[transcribe] cache ${mediaId} ${options.mock ? 'mock' : provider} ${language}`);
        job.words = JSON.parse(await readFile(cache, 'utf8')) as TimedWord[];
        job.cached = true;
      } else if (options.mock) {
        console.log(`[transcribe] mock ${mediaId} ${language}`);
        job.stage = 'transcribing';
        const fixture = JSON.parse(await readFile(resolve(process.cwd(), 'scripts', 'fixtures', 'elevenlabs-es.json'), 'utf8')) as unknown;
        job.words = fromElevenLabs(fixture);
        await new Promise((done) => setTimeout(done, 400));
      } else {
        console.log(`[transcribe] extract ${mediaId} ${provider} ${language}`);
        workDir = await mkdtemp(join(tmpdir(), 'gb-motion-'));
        job.stage = 'extracting';
        const audioFile = await extractAudio(mediaPath(options.mediaDir, mediaId), join(workDir, 'audio'), job.abort.signal);
        if (provider === 'groq') {
          const size = (await stat(audioFile)).size;
          if (size > GROQ_LIMIT_BYTES) throw new HttpError(413, audioFile.endsWith('.wav') ? 'El audio es muy largo para Groq (máx. 13 min en WAV).' : 'El audio es muy largo para Groq.');
        }
        if (aborted()) return;
        console.log(`[transcribe] send ${mediaId} ${provider}`);
        job.stage = 'uploading';
        // El envío del audio es corto; después queda esperando al proveedor.
        stageTimer = setTimeout(() => { if (job.status === 'running') job.stage = 'transcribing'; }, 1500);
        job.words = await callProvider(provider, audioFile, language, job.abort.signal);
      }
      if (aborted()) return;
      if (!job.words || job.words.length === 0) throw new HttpError(422, 'No se detectó voz en el video.');
      if (!job.cached) await writeFile(cache, JSON.stringify(job.words), 'utf8');
      job.status = 'done';
      job.stage = 'done';
    } catch (error) {
      if (aborted()) return;
      job.status = 'error';
      job.stage = 'error';
      if (error instanceof HttpError) job.error = error.message;
      else if (error instanceof ProviderError || (error as { name?: string })?.name === 'TimeoutError' || error instanceof TypeError) job.error = mapProviderError(provider, error);
      else job.error = 'No pude generar los subtítulos.';
      console.log(`[transcribe] error ${mediaId} ${provider} ${error instanceof ProviderError ? error.status : (error as { name?: string })?.name ?? 'unknown'}`);
    } finally {
      clearTimeout(stageTimer);
      if (workDir) void rm(workDir, { recursive: true, force: true });
    }
  };

  const start = async (body: unknown): Promise<string> => {
    const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const provider = chooseProvider(input.provider);
    const language = LANGUAGES.includes(input.language as TranscribeLanguage) ? input.language as TranscribeLanguage : 'es';
    if (!isMediaId(input.mediaId) || !existsSync(mediaPath(options.mediaDir, input.mediaId))) throw new HttpError(400, 'No encuentro ese video. Volvé a subirlo en «Video».');
    const mediaId = input.mediaId;
    try {
      if (!(await probe(mediaPath(options.mediaDir, mediaId))).hasAudio) throw new HttpError(422, NO_AUDIO_MESSAGE);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(422, 'No pude leer ese video. Probá con un MP4.');
    }
    // Los trabajos viejos ya terminaron: se limpian para que el mapa no crezca.
    const limit = Date.now() - 60 * 60 * 1000;
    for (const [id, job] of jobs) if (job.status !== 'running' && job.createdAt < limit) jobs.delete(id);
    const jobId = randomUUID();
    jobs.set(jobId, { status: 'running', stage: 'extracting', abort: new AbortController(), createdAt: Date.now() });
    void run(jobId, mediaId, provider, language);
    return jobId;
  };

  const status = (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) return null;
    return { status: job.status, stage: job.stage, cached: job.cached, error: job.error, words: job.status === 'done' ? job.words : undefined };
  };

  const cancel = (jobId: string) => {
    const job = jobs.get(jobId);
    if (job && job.status === 'running') { job.status = 'cancelled'; job.abort.abort(); }
  };

  return { listProviders, start, status, cancel };
};
