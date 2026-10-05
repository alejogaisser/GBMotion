import { useEffect, useRef, useState } from 'react';
import type { ExportKind, ExportState, PastExport } from '../components/OutputPanel';
import type { BackgroundMode, CompositionProps, VideoFormat } from '../types/motion';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

type Options = {
  /** Props de la composición tal como están en pantalla (con el video de guía). */
  inputProps: CompositionProps;
  background: BackgroundMode;
  format: VideoFormat;
  /** Id del video guardado en el servidor; hace falta para «Video con tus subtítulos». */
  guideMediaId: string;
  guideName?: string;
};

/** Exportar: pedir el video al servidor local, seguir el avance, cancelar y listar los anteriores. */
export const useExport = ({ inputProps, background, format, guideMediaId, guideName }: Options) => {
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [pastExports, setPastExports] = useState<PastExport[]>([]);
  const [exportVolume, setExportVolume] = useState(1);
  const exportJobId = useRef<string | null>(null);

  const refreshExports = async () => {
    try {
      const result = await (await fetch('/api/exports')).json() as { files?: PastExport[] };
      setPastExports(result.files ?? []);
    } catch { /* que falle el listado no es fatal */ }
  };
  useEffect(() => { void refreshExports(); }, []);

  /** Una edición vuelve el cartel a cero, salvo que haya un render en curso. */
  const resetExportState = () => setExportState((current) => current.status === 'rendering' ? current : { status: 'idle' });

  const exportVideo = async (kind: ExportKind) => {
    if (exportJobId.current) return;
    if (kind === 'burn' && !guideMediaId) { setExportState({ status: 'error', message: 'Subí un video en «Video» para exportarlo con subtítulos.' }); return; }
    const requestId = `starting-${Date.now()}`;
    let ownedJobId = requestId;
    exportJobId.current = requestId;
    setExportState({ status: 'rendering', message: 'Preparando tu video…', progress: 0 });
    try {
      const exportBackground = kind === 'green' ? 'green' : kind === 'alpha' ? 'transparent' : background === 'checker' ? 'black' : background;
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
      const started = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !started.jobId) throw new Error(started.error ?? 'No se pudo iniciar el video');
      if (exportJobId.current !== requestId) { await fetch(`/api/render/${started.jobId}`, { method: 'DELETE' }); return; }
      exportJobId.current = started.jobId;
      ownedJobId = started.jobId;
      for (;;) {
        await sleep(700);
        if (exportJobId.current !== started.jobId) return;
        const job = await (await fetch(`/api/render/${started.jobId}`)).json() as { status: string; progress?: number; url?: string; error?: string };
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
      if (exportJobId.current !== ownedJobId) return;
      exportJobId.current = null;
      setExportState({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear el video' });
    }
  };

  const cancelExport = async () => {
    const jobId = exportJobId.current;
    exportJobId.current = null;
    setExportState({ status: 'idle' });
    if (jobId) { try { await fetch(`/api/render/${jobId}`, { method: 'DELETE' }); } catch { /* ignorar */ } }
  };

  return { exportState, pastExports, exportVolume, setExportVolume, exportVideo, cancelExport, resetExportState };
};
