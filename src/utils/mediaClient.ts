import type { TimedWord, TranscribeLanguage, TranscribeProviderId } from '../captions/types';

export type MediaInfo = {
  mediaId: string;
  name: string;
  durationInFrames: number;
  width: number;
  height: number;
  hasAudio: boolean;
};

const UPLOAD_ERROR = 'No pude subir el video. Revisá que GB Motion siga abierto e intentá de nuevo.';

/**
 * Sube el archivo al servidor local con XHR, porque `fetch` todavía no informa el
 * progreso de una subida. El cuerpo va crudo: así no pasa por memoria ni por un FormData.
 */
export const uploadMedia = (file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<MediaInfo> => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(new Error('Se canceló la subida del video.')); return; }
  const request = new XMLHttpRequest();
  const abort = () => request.abort();
  signal?.addEventListener('abort', abort, { once: true });
  request.onloadend = () => signal?.removeEventListener('abort', abort);
  request.open('POST', '/api/media');
  request.setRequestHeader('Content-Type', 'application/octet-stream');
  request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
  request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
  request.onerror = () => reject(new Error(UPLOAD_ERROR));
  request.onabort = () => reject(new Error('Se canceló la subida del video.'));
  request.onload = () => {
    let payload: Record<string, unknown> = {};
    try { const parsed: unknown = JSON.parse(request.responseText); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>; } catch { /* respuesta sin JSON */ }
    if (request.status === 201 && typeof payload.mediaId === 'string') {
      onProgress(1);
      resolve(payload as unknown as MediaInfo);
    } else reject(new Error(typeof payload.error === 'string' ? payload.error : UPLOAD_ERROR));
  };
  request.send(file);
});

/** True si el servidor todavía tiene ese video guardado. */
export const mediaExists = async (mediaId: string): Promise<boolean> => {
  try { return (await fetch(`/media/${mediaId}`, { method: 'HEAD' })).ok; } catch { return false; }
};

/** Nunca convierte un HTML del hosting estático en un error de JSON técnico. */
export const readApiJson = async <T,>(response: Response, message: string): Promise<T> => {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(message);
  try { const value: unknown = await response.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message); return value as T; } catch { throw new Error(message); }
};

export const mediaUrl = (mediaId: string) => `/media/${mediaId}`;

/* ---------------------------------------------------------------------------
 * Subtítulos automáticos: el servidor local hace el trabajo (extrae el audio,
 * llama a la IA con la clave que sólo él conoce) y acá se consulta el avance.
 * ------------------------------------------------------------------------- */

export type ProviderInfo = { id: TranscribeProviderId; label: string; configured: boolean };
export type TranscribeStage = 'extracting' | 'uploading' | 'transcribing' | 'done' | 'error';

export class TranscribeError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export const fetchProviders = async (): Promise<ProviderInfo[]> => {
  try {
    const payload = await readApiJson<{ providers?: ProviderInfo[] }>(await fetch('/api/transcribe/providers'), 'No pude consultar la IA. Revisá que GB Motion siga abierto.');
    return Array.isArray(payload.providers) ? payload.providers : [];
  } catch { return []; }
};

export const startTranscription = async (input: { mediaId: string; language: TranscribeLanguage; provider?: TranscribeProviderId }, signal?: AbortSignal): Promise<string> => {
  if (signal?.aborted) throw new TranscribeError('Cancelado.', 'cancelled');
  let response: Response;
  try {
    // Una vez enviado el POST, conservamos la respuesta para poder cancelar por jobId.
    response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  } catch { throw new TranscribeError('No pude conectar con GB Motion. Revisá que siga abierto.'); }
  const payload = await readApiJson<{ jobId?: string; error?: string; code?: string }>(response, 'No pude iniciar la transcripción. Revisá que el servidor local esté abierto.');
  if (!response.ok || typeof payload.jobId !== 'string' || !payload.jobId) throw new TranscribeError(typeof payload.error === 'string' ? payload.error : 'No pude iniciar la transcripción.', payload.code);
  return payload.jobId;
};

export const cancelTranscription = async (jobId: string) => {
  try { return (await fetch(`/api/transcribe/${jobId}`, { method: 'DELETE' })).ok; } catch { return false; }
};

/** Consulta el trabajo hasta que termina. Devuelve las palabras con tiempos. */
export const pollTranscription = async (jobId: string, onStage: (stage: TranscribeStage) => void, signal: AbortSignal): Promise<TimedWord[]> => {
  for (;;) {
    await new Promise((done) => setTimeout(done, 700));
    if (signal.aborted) throw new TranscribeError('Cancelado.', 'cancelled');
    let job: { status: string; stage: TranscribeStage; error?: string; words?: TimedWord[] };
    try {
      const response = await fetch(`/api/transcribe/${jobId}`, { signal });
      if (response.status === 404) throw new TranscribeError('GB Motion se reinició mientras transcribía. Volvé a intentar.');
      job = await readApiJson(response, 'No pude consultar la transcripción. Revisá que el servidor local siga abierto.');
      if (!response.ok) throw new TranscribeError('No pude consultar la transcripción. Volvé a intentar.');
    } catch (error) {
      if (signal.aborted) throw new TranscribeError('Cancelado.', 'cancelled');
      throw error instanceof TranscribeError ? error : new TranscribeError('Se perdió la conexión con GB Motion.');
    }
    if (signal.aborted) throw new TranscribeError('Cancelado.', 'cancelled');
    if (job.status === 'running') { onStage(job.stage); continue; }
    if (job.status === 'done' && Array.isArray(job.words)) return job.words;
    if (job.status === 'cancelled') throw new TranscribeError('Cancelado.', 'cancelled');
    throw new TranscribeError(job.error ?? 'No pude generar los subtítulos. Si reiniciaste GB Motion, volvé a intentar.');
  }
};
