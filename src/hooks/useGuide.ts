import { useEffect, useRef, useState } from 'react';
import type { GuideUpload } from '../components/GuidePanel';
import type { VideoGuide } from '../types/motion';
import { readWaveform } from '../utils/audio';
import { mediaExists, mediaUrl, uploadMedia } from '../utils/mediaClient';

type Options = {
  /** Id y nombre del video guardados en el proyecto que se restauró al abrir. */
  initialMediaId?: string;
  initialName?: string;
  flashHint: (message: string) => void;
};

/** Lee la duración real del archivo antes de mostrarlo, para dimensionar la línea de tiempo. */
const readDuration = async (src: string) => {
  const probe = document.createElement('video');
  try {
    return await new Promise<number>((resolve, reject) => {
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => resolve(probe.duration);
      probe.onerror = () => reject(new Error('formato no soportado'));
      probe.src = src;
    });
  } finally {
    // Sin esto el elemento de prueba sigue sosteniendo el archivo.
    probe.removeAttribute('src');
    probe.load();
  }
};

const revokeBlob = (src: string) => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); };

/**
 * El video de guía: elegirlo, subirlo al servidor local, re-vincularlo después de
 * recargar y quitarlo. El blob de la pestaña sólo se libera al desmontar (ver la
 * lección de render sobre las URLs blob).
 */
export const useGuide = ({ initialMediaId, initialName, flashHint }: Options) => {
  const [guide, setGuide] = useState<VideoGuide | null>(null);
  const [guideName, setGuideName] = useState(initialName ?? '');
  const [guideMediaId, setGuideMediaId] = useState(initialMediaId ?? '');
  const [guideUpload, setGuideUpload] = useState<GuideUpload>({ status: 'idle', progress: 0 });
  const uploadToken = useRef(0);
  const uploadController = useRef<AbortController | null>(null);
  const blobs = useRef(new Set<string>());
  const begin = () => { uploadController.current?.abort(); return ++uploadToken.current; };

  const pickGuide = async (file: File) => {
    const token = begin();
    const src = URL.createObjectURL(file);
    blobs.current.add(src);
    try {
      const seconds = await readDuration(src);
      if (uploadToken.current !== token) { revokeBlob(src); blobs.current.delete(src); return; }
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('duración desconocida');
      setGuideName(file.name);
      setGuide((current) => {
        if (current) revokeBlob(current.src);
        return { src, name: file.name, durationInFrames: Math.round(seconds * 30), volume: 1 };
      });
      // El video se guarda en el servidor local para que sobreviva a una recarga y
      // para poder exportarlo con los subtítulos adentro.
      const abort = new AbortController();
      uploadController.current = abort;
      setGuideMediaId('');
      setGuideUpload({ status: 'uploading', progress: 0 });
      uploadMedia(file, (progress) => { if (uploadToken.current === token) setGuideUpload({ status: 'uploading', progress }); }, abort.signal)
        .then((info) => {
          if (uploadToken.current !== token) return;
          setGuide((current) => current?.src === src ? { ...current, mediaId: info.mediaId } : current);
          setGuideMediaId(info.mediaId);
          setGuideUpload({ status: 'idle', progress: 1 });
          flashHint('Video guardado.');
        })
        .catch((error: unknown) => {
          if (uploadToken.current !== token) return;
          setGuideUpload({ status: 'error', progress: 0 });
          flashHint(error instanceof Error ? error.message : 'No pude guardar el video.');
        });
      flashHint('Video cargado. Preparando la forma de onda…');
      if (file.size <= 150_000_000) void readWaveform(file).then((waveform) => { if (uploadToken.current === token) setGuide((current) => current?.src === src ? { ...current, waveform } : current); }).catch(() => { if (uploadToken.current === token) flashHint('Video listo. No se pudo leer la forma de onda; podés sincronizar escuchando el audio.'); });
      else flashHint('Video listo. La forma de onda se omite en archivos mayores de 150 MB.');
    } catch {
      URL.revokeObjectURL(src);
      blobs.current.delete(src);
      if (uploadToken.current === token) flashHint('No pude leer ese video. Probá con un MP4.');
    }
  };

  const removeGuide = () => {
    begin();
    setGuideName(''); setGuideMediaId(''); setGuideUpload({ status: 'idle', progress: 0 });
    setGuide((current) => {
      if (current) revokeBlob(current.src);
      return null;
    });
  };

  /** Vuelve a conectar un video ya subido (después de recargar o de abrir un proyecto). */
  const relinkGuide = async (mediaId: string, name: string) => {
    const token = begin();
    setGuideMediaId(mediaId);
    const exists = await mediaExists(mediaId);
    if (uploadToken.current !== token) return;
    if (!exists) { setGuideMediaId(''); return; }
    const src = mediaUrl(mediaId);
    try {
      const seconds = await readDuration(src);
      if (uploadToken.current !== token) return;
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('duración desconocida');
      setGuideName(name);
      setGuide((current) => { if (current) revokeBlob(current.src); return { src, name: name || 'video', durationInFrames: Math.round(seconds * 30), volume: 1, mediaId }; });
    } catch {
      if (uploadToken.current === token) setGuideMediaId('');
    }
  };
  useEffect(() => { if (initialMediaId) void relinkGuide(initialMediaId, initialName ?? ''); }, []);

  // El blob se libera sólo al desmontar. Con `guide` como dependencia, cualquier
  // cambio de volumen dispararía la limpieza y revocaría la URL que el video
  // sigue usando.
  const guideRef = useRef<VideoGuide | null>(null);
  guideRef.current = guide;
  useEffect(() => () => { begin(); if (guideRef.current) revokeBlob(guideRef.current.src); for (const src of blobs.current) revokeBlob(src); blobs.current.clear(); }, []);

  return { guide, setGuide, guideName, setGuideName, guideMediaId, guideUpload, pickGuide, removeGuide, relinkGuide };
};
