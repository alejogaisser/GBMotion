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
export const uploadMedia = (file: File, onProgress: (fraction: number) => void): Promise<MediaInfo> => new Promise((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open('POST', '/api/media');
  request.setRequestHeader('Content-Type', 'application/octet-stream');
  request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
  request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
  request.onerror = () => reject(new Error(UPLOAD_ERROR));
  request.onabort = () => reject(new Error('Se canceló la subida del video.'));
  request.onload = () => {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(request.responseText) as Record<string, unknown>; } catch { /* respuesta sin JSON */ }
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
    const payload = await (await fetch('/api/transcribe/providers')).json() as { providers?: ProviderInfo[] };
    return Array.isArray(payload.providers) ? payload.providers : [];
  } catch { return []; }
};

export const startTranscription = async (input: { mediaId: string; language: TranscribeLanguage; provider?: TranscribeProviderId }): Promise<string> => {
  let response: Response;
  try {
    response = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  } catch { throw new TranscribeError('No pude conectar con GB Motion. Revisá que siga abierto.'); }
  const payload = await response.json().catch(() => ({})) as { jobId?: string; error?: string; code?: string };
  if (!response.ok || !payload.jobId) throw new TranscribeError(payload.error ?? 'No pude iniciar la transcripción.', payload.code);
  return payload.jobId;
};

export const cancelTranscription = async (jobId: string) => {
  try { await fetch(`/api/transcribe/${jobId}`, { method: 'DELETE' }); } catch { /* ya se canceló del lado de la pantalla */ }
};

/** Consulta el trabajo hasta que termina. Devuelve las palabras con tiempos. */
export const pollTranscription = async (jobId: string, onStage: (stage: TranscribeStage) => void, signal: AbortSignal): Promise<TimedWord[]> => {
  for (;;) {
    await new Promise((done) => setTimeout(done, 700));
    if (signal.aborted) throw new TranscribeError('Cancelado.', 'cancelled');
    let job: { status: string; stage: TranscribeStage; error?: string; words?: TimedWord[] };
    try {
      const response = await fetch(`/api/transcribe/${jobId}`);
      if (response.status === 404) throw new TranscribeError('GB Motion se reinició mientras transcribía. Volvé a intentar.');
      job = await response.json();
    } catch (error) {
      throw error instanceof TranscribeError ? error : new TranscribeError('Se perdió la conexión con GB Motion.');
    }
    if (job.status === 'running') { onStage(job.stage); continue; }
    if (job.status === 'done' && Array.isArray(job.words)) return job.words;
    if (job.status === 'cancelled') throw new TranscribeError('Cancelado.', 'cancelled');
    throw new TranscribeError(job.error ?? 'No pude generar los subtítulos. Si reiniciaste GB Motion, volvé a intentar.');
  }
};
