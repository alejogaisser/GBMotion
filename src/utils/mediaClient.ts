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
