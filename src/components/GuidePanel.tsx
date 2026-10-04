import { Film, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { useRef } from 'react';
import type { VideoGuide } from '../types/motion';

export type GuideUpload = { status: 'idle' | 'uploading' | 'error'; progress: number };

type Props = {
  guide: VideoGuide | null;
  upload: GuideUpload;
  expectedName: string;
  formatLabel: string;
  onPick: (file: File) => void;
  onVolume: (volume: number) => void;
  onRemove: () => void;
};

const clock = (frames: number) => {
  const seconds = Math.max(0, frames) / 30;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

export const GuidePanel = ({ guide, upload, expectedName, formatLabel, onPick, onVolume, onRemove }: Props) => {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="guide-panel">
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.target.value = '';
        }}
      />

      {!guide ? (
        <div className="panel-block">
          <button type="button" className="guide-drop" onClick={() => input.current?.click()}>
            <Film size={22} aria-hidden="true" />
            <strong>{expectedName ? 'Volver a vincular el video' : 'Subir un video'}</strong>
            <small>{expectedName || 'Para calzar los subtítulos con la imagen y el audio.'}</small>
          </button>
          <p className="hint">
            El video se guarda en esta computadora para que no tengas que subirlo de nuevo.
            El MP4 con fondo verde sigue saliendo sin el video, para componer en CapCut; el
            «Video con tus subtítulos» sí lo lleva adentro.
          </p>
        </div>
      ) : (
        <>
          <div className="panel-block">
            <h3>Video cargado</h3>
            <div className="guide-file">
              <Film size={15} aria-hidden="true" />
              <span title={guide.name}>{guide.name}</span>
              <button type="button" aria-label="Quitar el video" title="Quitar el video" onClick={onRemove}>
                <X size={14} />
              </button>
            </div>
            <p className="hint">Dura {clock(guide.durationInFrames)}. La línea de tiempo se estiró para cubrirlo entero.</p>
            <p className="hint" role="status" aria-live="polite">
              {guide.mediaId
                ? 'Video guardado. Sigue acá aunque recargues la página.'
                : upload.status === 'uploading'
                  ? `Subiendo… ${Math.round(upload.progress * 100)}%`
                  : 'No se pudo guardar el video: sirve para mirar, pero no para exportarlo con subtítulos.'}
            </p>
            <button type="button" className="ghost-button" onClick={() => input.current?.click()}>
              <Upload size={13} /> Cambiar el video
            </button>
          </div>

          <div className="panel-block">
            <h3>Audio</h3>
            <p className="hint">Escuchar lo que se dice es la forma más rápida de ubicar cada frase.</p>
            <div className="control-row">
              <button
                type="button"
                className={`icon-button ${guide.volume > 0 ? 'on' : ''}`}
                aria-label={guide.volume > 0 ? 'Silenciar' : 'Activar el sonido'}
                title={guide.volume > 0 ? 'Silenciar' : 'Activar el sonido'}
                onClick={() => onVolume(guide.volume > 0 ? 0 : 1)}
              >
                {guide.volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <label className="time-field" style={{ flex: 1, marginTop: 0 }}>
                <span>Volumen</span>
                <input
                  type="range" min={0} max={1} step={0.05} value={guide.volume}
                  aria-label="Volumen del video de guía"
                  onChange={(event) => onVolume(Number(event.target.value))}
                />
                <output>{Math.round(guide.volume * 100)}%</output>
              </label>
            </div>
          </div>

          <div className="panel-block">
            <h3>Cómo se ve</h3>
            <p className="hint">
              El video se recorta para llenar el formato {formatLabel}. Si tu video es horizontal y
              estás en vertical, vas a ver los costados cortados — igual que va a pasar en CapCut.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
