import { useEffect, useRef, useState } from 'react';
import type { ExportKind, ExportState, PastExport } from '../components/OutputPanel';
import type { BackgroundMode, CompositionProps, VideoFormat } from '../types/motion';
import { readApiJson } from '../utils/mediaClient';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

type Options = {
  /** Capacidad de render del servidor; se omite en los consumidores anteriores. */
  enabled?: boolean;
  /** Props de la composición tal como están en pantalla (con el video de guía). */
  inputProps: CompositionProps;
  background: BackgroundMode;
  format: VideoFormat;
  /** Id del video guardado en el servidor; hace falta para «Video con tus subtítulos». */
  guideMediaId: string;
  guideName?: string;
};

/** Exportar: pedir el video al servidor local, seguir el avance, cancelar y listar los anteriores. */
export const useExport = ({ inputProps, background, format, guideMediaId, guideName, enabled = true }: Options) => {
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [pastExports, setPastExports] = useState<PastExport[]>([]);
  const [exportVolume, setExportVolume] = useState(1);
  const exportJobId = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const mounted = useRef(false);
  const pollController = useRef<AbortController | null>(null);
  const capability = useRef(enabled);
  capability.current = enabled;
  const deleteJob = async (id: string) => {
    try {
      const response = await fetch(`/api/render/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('cancel');
    } catch { if (mounted.current && !exportJobId.current) setExportState({ status: 'error', message: 'No pude confirmar la cancelación en el servidor. Revisá que GB Motion siga abierto.' }); }
  };

  const refreshExports = async () => {
    if (!capability.current) return;
    try {
      const result = await readApiJson<{ files?: PastExport[] }>(await fetch('/api/exports'), 'No pude consultar los videos anteriores. Revisá el servidor local.');
      if (mounted.current && capability.current) setPastExports(Array.isArray(result.files) ? result.files : []);
    } catch { /* que falle el listado no es fatal */ }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const id = exportJobId.current; exportJobId.current = null; pollController.current?.abort(); if (id && !id.startsWith('starting-')) void deleteJob(id); }; }, []);
  useEffect(() => { if (enabled) void refreshExports(); }, [enabled]);

  /** Una edición vuelve el cartel a cero, salvo que haya un render en curso. */
  const resetExportState = () => setExportState((current) => current.status === 'rendering' ? current : { status: 'idle' });

  const exportVideo = async (kind: ExportKind) => {
    if (!capability.current) { setExportState({ status: 'error', message: 'Para exportar video, abrí GB Motion con el servidor local.' }); return; }
    if (exportJobId.current) return;
    if (kind === 'burn' && !guideMediaId) { setExportState({ status: 'error', message: 'Subí un video en «Video» para exportarlo con subtítulos.' }); return; }
    const requestId = `starting-${++requestSequence.current}`;
    let ownedJobId = requestId;
    exportJobId.current = requestId;
    setExportState({ status: 'rendering', message: 'Preparando tu video…', progress: 0 });
    try {
      const exportBackground = kind === 'green' ? 'green' : kind === 'alpha' || String(kind) === 'alpha-webm' ? 'transparent' : background === 'checker' ? 'black' : background;
      // El video de guía se saca siempre: su `src` es un blob de esta pestaña,
      // que el proceso de render no puede abrir, y el MP4 tiene que salir
      // limpio para componerlo en CapCut.
      const { guide: _guide, ...exportProps } = inputProps;
      // Para «Video con tus subtítulos» el servidor arma la URL del video a partir del id.
      const media = kind === 'burn' ? { mediaId: guideMediaId, name: guideName, volume: exportVolume } : undefined;
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ props: { ...exportProps, background: exportBackground }, format, kind, media }),
      });
      const started = await readApiJson<{ jobId?: string; error?: string }>(response, 'No pude iniciar el video. Revisá que el servidor local esté abierto.');
      if (!response.ok || typeof started.jobId !== 'string' || !started.jobId) throw new Error(typeof started.error === 'string' ? started.error : 'No se pudo iniciar el video');
      if (!mounted.current || exportJobId.current !== requestId) { await deleteJob(started.jobId); return; }
      exportJobId.current = started.jobId;
      ownedJobId = started.jobId;
      const abort = new AbortController();
      pollController.current = abort;
      for (;;) {
        await sleep(700);
        if (exportJobId.current !== started.jobId) return;
        const response = await fetch(`/api/render/${started.jobId}`, { signal: abort.signal });
        const job = await readApiJson<{ status: string; progress?: number; url?: string; error?: string }>(response, 'No pude consultar el video. Revisá que el servidor local siga abierto.');
        if (!response.ok) throw new Error(job.error ?? 'El servidor perdió el trabajo de video. Volvé a exportarlo.');
        if (exportJobId.current !== ownedJobId) return;
        if (job.status === 'rendering') { setExportState({ status: 'rendering', message: 'Creando tu video…', progress: job.progress ?? 0 }); continue; }
        if (job.status === 'cancelled') { exportJobId.current = null; setExportState({ status: 'idle' }); return; }
        if (job.status === 'done' && job.url) {
          exportJobId.current = null;
          setExportState({ status: 'done', message: '¡Tu video está listo!', url: job.url });
          const anchor = document.createElement('a');
          anchor.href = job.url;
          anchor.download = '';
          anchor.click();
          void refreshExports();
          return;
        }
        throw new Error(job.error ?? 'No se pudo crear el video');
      }
    } catch (error) {
      if (!mounted.current || exportJobId.current !== ownedJobId) {
        if (ownedJobId === requestId) console.warn('Se perdió la respuesta del render; no se pudo confirmar la cancelación en el servidor.');
        return;
      }
      exportJobId.current = null;
      setExportState({ status: 'error', message: error instanceof TypeError ? 'Se perdió la conexión con GB Motion. Revisá que siga abierto y volvé a exportar.' : error instanceof Error ? error.message : 'No se pudo crear el video' });
    }
  };

  const cancelExport = async () => {
    const jobId = exportJobId.current;
    exportJobId.current = null;
    pollController.current?.abort();
    setExportState({ status: 'idle' });
    if (jobId && !jobId.startsWith('starting-')) await deleteJob(jobId);
  };

  return { exportState, pastExports, exportVolume, setExportVolume, exportVideo, cancelExport, resetExportState };
};
