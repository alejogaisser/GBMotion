import { Download, Film, Layers, Loader2, Sparkles } from 'lucide-react';
import type { BackgroundMode, VideoFormat } from '../types/motion';

export type ExportKind = 'mp4' | 'green' | 'alpha' | 'burn';
export type ExportState = { status: 'idle' | 'rendering' | 'done' | 'error'; message?: string; url?: string; progress?: number };
export type PastExport = { url: string; name: string; at: number };

type Props = {
  formats: VideoFormat[];
  formatId: string;
  background: BackgroundMode;
  customBackground: string;
  exportState: ExportState;
  pastExports: PastExport[];
  advanced: boolean;
  /** El video ya está guardado en el servidor, que es lo que necesita el export con subtítulos. */
  hasMedia: boolean;
  audioVolume: number;
  onAudioVolume: (volume: number) => void;
  onFormat: (id: string) => void;
  onBackground: (mode: BackgroundMode) => void;
  onCustomBackground: (color: string) => void;
  onExport: (kind: ExportKind) => void;
  onCancel: () => void;
};

const backgrounds: { id: BackgroundMode; label: string; hint?: string; swatch: string }[] = [
  { id: 'green', label: 'Verde', hint: 'Para CapCut', swatch: '#00ff00' },
  { id: 'black', label: 'Negro', swatch: '#050505' },
  { id: 'white', label: 'Blanco', swatch: '#ffffff' },
  { id: 'checker', label: 'Cuadros', hint: 'Solo para ver', swatch: 'repeating-conic-gradient(#3a3f4a 0% 25%, #23262d 0% 50%) 50% / 12px 12px' },
];

export const OutputPanel = ({
  formats, formatId, background, customBackground, exportState, pastExports, advanced, hasMedia, audioVolume, onAudioVolume,
  onFormat, onBackground, onCustomBackground, onExport, onCancel,
}: Props) => {
  const rendering = exportState.status === 'rendering';
  return (
    <div className="output-panel">
      <div className="panel-block">
        <h3>Tamaño del video</h3>
        <div className="segmented vertical" role="group" aria-label="Tamaño del video">
          {formats.map((format) => (
            <button type="button" key={format.id} className={formatId === format.id ? 'on' : ''} aria-pressed={formatId === format.id}
              onClick={() => onFormat(format.id)}>
              {format.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-block">
        <h3>Fondo</h3>
        <p className="hint">Para poner el subtítulo encima de otro video en CapCut, elegí verde y usá el chroma.</p>
        <div className="bg-row">
          {backgrounds.map((item) => (
            <button type="button" key={item.id} className={`bg-option ${background === item.id ? 'on' : ''}`}
              aria-pressed={background === item.id} onClick={() => onBackground(item.id)}>
              <i style={{ background: item.swatch }} />
              <span>{item.label}</span>
              {item.hint && <small>{item.hint}</small>}
            </button>
          ))}
          <label className={`bg-option ${background === 'custom' ? 'on' : ''}`}>
            <i style={{ background: customBackground }} />
            <span>Otro</span>
            <input type="color" aria-label="Color de fondo" value={customBackground}
              onChange={(event) => { onCustomBackground(event.target.value); onBackground('custom'); }} />
          </label>
        </div>
      </div>

      <div className="panel-block">
        <h3>Descargar</h3>
        <button type="button" className="button primary block" disabled={rendering || !hasMedia} onClick={() => onExport('burn')}>
          <Film size={15} /> Video con tus subtítulos
        </button>
        {hasMedia ? (
          <label className="time-field">
            <span>Volumen del audio original</span>
            <input type="range" min={0} max={1} step={0.05} value={audioVolume} aria-label="Volumen del audio original"
              onChange={(event) => onAudioVolume(Number(event.target.value))} />
            <output>{Math.round(audioVolume * 100)}%</output>
          </label>
        ) : (
          <p className="hint">Subí un video en «Video» para exportarlo con subtítulos.</p>
        )}
        <p className="hint">Sale listo para publicar: tu video con los subtítulos quemados y el audio original.</p>
        <button type="button" className="button secondary block" disabled={rendering} onClick={() => onExport('green')}>
          <Download size={15} /> Video con fondo verde
        </button>
        <p className="hint">Para CapCut: se importa y se le quita el verde con chroma.</p>
        <button type="button" className="button secondary block" disabled={rendering} onClick={() => onExport('mp4')}>
          MP4 con el fondo elegido
        </button>
        {advanced && (
          <button type="button" className="button secondary block" disabled={rendering} onClick={() => onExport('alpha')}>
            <Layers size={14} /> Transparencia (beta)
          </button>
        )}

        {rendering && (
          <div className="export-status" role="status" aria-live="polite">
            <Loader2 size={14} className="spin" />
            <span>{exportState.message}</span>
            <span className="export-bar"><i style={{ width: `${Math.round((exportState.progress ?? 0) * 100)}%` }} /></span>
            <button type="button" className="linklike" onClick={onCancel}>Cancelar</button>
          </div>
        )}
        {exportState.status === 'done' && (
          <div className="export-status done" role="status" aria-live="polite">
            <Sparkles size={14} /> <span>{exportState.message}</span>
            {exportState.url && <a href={exportState.url} download>Descargar otra vez</a>}
          </div>
        )}
        {exportState.status === 'error' && (
          <div className="export-status error" role="status" aria-live="polite">{exportState.message}</div>
        )}
      </div>

      {pastExports.length > 0 && (
        <div className="panel-block">
          <h3>Videos anteriores</h3>
          <ul className="export-list">
            {pastExports.slice(0, 8).map((item) => (
              <li key={item.name}>
                <span>{new Date(item.at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <a href={item.url} download>{item.name.endsWith('.mov') ? 'Transparencia' : /-burn-/.test(item.name) ? 'Con video' : /green/.test(item.name) ? 'Verde' : 'MP4'} ↓</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
