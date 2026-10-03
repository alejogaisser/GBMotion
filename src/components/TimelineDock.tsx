import { Copy, Eye, EyeOff, Lock, LockOpen, Plus, Trash2, Wand2 } from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TextLayer } from '../types/motion';
import { getLayerDuration, isAutoDuration } from '../utils/duration';
import { animationForLayer, getSegmentTimelineDuration } from '../engine/layerAnimation';

type Props = {
  layers: TextLayer[];
  activeId: string;
  selectedIds: string[];
  duration: number;
  currentFrame: number;
  canAdd: boolean;
  onSplit: () => void;
  waveform?: number[];
  guideDuration?: number;
  onSeek: (frame: number) => void;
  onSelect: (id: string, multiple?: boolean) => void;
  onChange: (id: string, patch: Partial<TextLayer>) => void;
  onBeginInteraction: () => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
};

const clock = (frame: number) => {
  const seconds = Math.max(0, frame) / 30;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

export const TimelineDock = ({
  layers, activeId, selectedIds, duration, currentFrame, canAdd, onSplit, waveform, guideDuration,
  onSeek, onSelect, onChange, onBeginInteraction, onAdd, onDuplicate, onDelete, onToggleVisible, onToggleLock,
}: Props) => {
  const lanesRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const lastFrame = Math.max(0, duration - 1);
  // Todo lo que se dibuja mapea un cuadro contra `span`, el mismo rango que
  // cubre el scrubber, así el cabezal cae exacto debajo del control.
  const span = Math.max(1, lastFrame);
  const tickStep = Math.max(1, Math.ceil(duration / 30 / (10 * zoom))) * 30;
  const ticks = Array.from({ length: Math.floor(lastFrame / tickStep) + 1 }, (_, index) => index * tickStep);
  const snapFrame = (value: number, width: number, exclude: string) => {
    if (!snap) return value;
    const targets = [0, currentFrame, ...layers.filter((l) => l.id !== exclude).flatMap((l) => [l.startFrame, l.startFrame + getLayerDuration(l)])];
    const nearest = targets.reduce((best, t) => Math.abs(t - value) < Math.abs(best - value) ? t : best, value + 10000);
    return Math.abs(nearest - value) <= span * 8 / width ? nearest : value;
  };

  const begin = (event: ReactPointerEvent, layer: TextLayer, action: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    if (!lanesRef.current || layer.locked) return;
    onSelect(layer.id);
    onBeginInteraction();
    const rect = lanesRef.current.querySelector('.dock-lane')!.getBoundingClientRect();
    const startClientX = event.clientX;
    const initialStart = layer.startFrame ?? 0;
    const initialDuration = getLayerDuration(layer);
    const move = (pointer: PointerEvent) => {
      const delta = Math.round((pointer.clientX - startClientX) / Math.max(1, rect.width) * span);
      if (action === 'move') onChange(layer.id, { startFrame: Math.max(0, snapFrame(initialStart + delta, rect.width, layer.id)) });
      else onChange(layer.id, { durationFrames: Math.max(15, snapFrame(initialStart + initialDuration + delta, rect.width, layer.id) - initialStart) });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  };

  /**
   * Arrastre de los tiradores de entrada y salida dentro del clip.
   *
   * Lo que se ve pintado es la duración completa del tramo (retardo + animación
   * + el desfase acumulado de las unidades), pero lo que se arrastra es sólo
   * `overrides.duration`. El desfase entre palabras es parte del efecto, no
   * algo que se ajuste tirando del borde.
   */
  const beginFx = (event: ReactPointerEvent, layer: TextLayer, slot: 'in' | 'out') => {
    event.preventDefault();
    event.stopPropagation();
    if (!lanesRef.current || layer.locked) return;
    onSelect(layer.id);
    onBeginInteraction();
    const animation = animationForLayer(layer);
    const segment = slot === 'in' ? animation.in : animation.out;
    if (!segment) return;
    const rect = lanesRef.current.querySelector('.dock-lane')!.getBoundingClientRect();
    const startClientX = event.clientX;
    const initial = segment.overrides.duration;
    const move = (pointer: PointerEvent) => {
      const raw = Math.round((pointer.clientX - startClientX) / Math.max(1, rect.width) * span);
      // La salida crece hacia la izquierda: su tirador va contra el arrastre.
      const delta = slot === 'in' ? raw : -raw;
      const duration = Math.max(3, Math.min(120, initial + delta));
      const current = animationForLayer(layer);
      const target = slot === 'in' ? current.in : current.out;
      if (!target) return;
      const next = { ...target, overrides: { ...target.overrides, duration } };
      onChange(layer.id, {
        animation: slot === 'in' ? { ...current, in: next } : { ...current, out: next },
        ...(slot === 'in' ? { overrides: next.overrides, preset: next.preset } : {}),
      });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  };

  const activeLayer = layers.find((layer) => layer.id === activeId) ?? layers[0];
  const activeAuto = activeLayer ? isAutoDuration(activeLayer) : true;

  return (
    <section className="dock" aria-label="Cuándo aparece cada frase">
      <div className="dock-head">
        <span className="dock-title">Tus frases</span>
        <output className="dock-clock">{clock(currentFrame)}<i>:{String(Math.floor(currentFrame % 30)).padStart(2, '0')}</i></output>
        <span className="dock-total">de {clock(duration)}</span>
        <div className="dock-head-actions">
          <button type="button" className="ghost-button tiny" aria-pressed={snap} onClick={() => setSnap(!snap)}>Imán {snap ? 'activo' : 'inactivo'}</button>
          <label className="timeline-zoom">Zoom <select aria-label="Zoom de la línea de tiempo" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>{[1, 2, 4, 8].map((z) => <option key={z} value={z}>{z}×</option>)}</select></label>
          <button type="button" className="ghost-button tiny" disabled={!canAdd || !activeLayer || activeLayer.locked || currentFrame <= activeLayer.startFrame || currentFrame >= activeLayer.startFrame + getLayerDuration(activeLayer) - 1} onClick={onSplit}>Dividir aquí</button>
          {activeLayer && !activeAuto && (
            <button type="button" className="ghost-button tiny" disabled={activeLayer.locked} onClick={() => { onBeginInteraction(); onChange(activeId, { durationFrames: undefined }); }}>
              <Wand2 size={12} /> Duración automática
            </button>
          )}
          <button type="button" className="ghost-button tiny" disabled={!canAdd} onClick={onAdd}>
            <Plus size={13} /> Agregar frase
          </button>
        </div>
      </div>

      <div className="timeline-scroll"><div className="timeline-content" style={{ width: `${zoom * 100}%` }}>
      <div className="dock-ruler" aria-hidden="true">
        {ticks.map((frame) => <span key={frame} style={{ left: `${frame / span * 100}%` }}>{clock(frame)}</span>)}
      </div>

      {waveform && waveform.length > 0 && <div className="waveform" aria-label="Forma de onda del audio de referencia">
        <svg viewBox={`0 0 ${waveform.length} 40`} preserveAspectRatio="none" style={{ width: `${Math.min(1, (guideDuration ?? duration) / duration) * 100}%` }}>
          <path d={waveform.map((peak, i) => `M${i},${20 - peak * 19}v${Math.max(0.5, peak * 38)}`).join(' ')} stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>}
      <div className="dock-tracks">
        <input
          className="dock-scrubber"
          aria-label="Posición del video"
          type="range"
          min={0}
          max={lastFrame}
          value={Math.min(currentFrame, lastFrame)}
          onInput={(event) => onSeek(Number(event.currentTarget.value))}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <div className="dock-rows" ref={lanesRef}>

          {layers.map((layer, index) => {
            const start = Math.max(0, layer.startFrame ?? 0);
            const clipDuration = getLayerDuration(layer);
            const left = start / span * 100;
            const active = activeId === layer.id;
            const animation = animationForLayer(layer);
            // Fracción del clip que ocupa cada tramo, para pintarlas adentro.
            const inShare = Math.min(0.48, getSegmentTimelineDuration(animation.in, layer.text) / Math.max(1, clipDuration));
            const outShare = Math.min(0.48, getSegmentTimelineDuration(animation.out, layer.text) / Math.max(1, clipDuration));
            return (
              <div className={`dock-row ${active ? 'active' : ''} ${selectedIds.includes(layer.id) ? 'multi-selected' : ''}`} key={layer.id}>
                <div className="dock-row-head">
                  <input type="checkbox" className="layer-select" aria-label={`Seleccionar ${layer.name} en grupo`} checked={selectedIds.includes(layer.id)} onChange={() => onSelect(layer.id, true)} />
                  <button type="button" className="dock-row-name" onClick={() => onSelect(layer.id)} title={layer.text}>
                    <b>{index + 1}</b><span>{layer.name}</span>
                  </button>
                  <div className="dock-row-actions">
                    <button type="button" aria-label={layer.visible ? `Ocultar ${layer.name}` : `Mostrar ${layer.name}`} onClick={() => onToggleVisible(layer.id)}>
                      {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button type="button" aria-label={layer.locked ? `Desbloquear ${layer.name}` : `Bloquear ${layer.name}`} onClick={() => { onBeginInteraction(); onToggleLock(layer.id); }}>
                      {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                    </button>
                    <button type="button" aria-label={`Duplicar ${layer.name}`} onClick={() => onDuplicate(layer.id)}><Copy size={13} /></button>
                    <button type="button" aria-label={`Eliminar ${layer.name}`} disabled={layers.length === 1 || layer.locked} onClick={() => onDelete(layer.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="dock-lane">
                  <span className="dock-playhead" style={{ left: `${Math.min(currentFrame, lastFrame) / span * 100}%` }} aria-hidden="true" />
                  <button
                    type="button"
                    className={`dock-clip ${layer.locked ? 'locked' : ''} ${isAutoDuration(layer) ? 'auto' : ''} ${layer.visible ? '' : 'hidden-layer'}`}
                    style={{ left: `${left}%`, width: `${Math.min(100 - left, Math.max(0.1, clipDuration / span * 100))}%` }}
                    onPointerDown={(event) => begin(event, layer, 'move')}
                    onClick={() => onSelect(layer.id)}
                    aria-label={`${layer.name}: empieza en ${clock(start)}, dura ${(clipDuration / 30).toFixed(1)} segundos${isAutoDuration(layer) ? ' (automático)' : ''}`}
                  >
                    {inShare > 0 && (
                      <b className="clip-fx in" style={{ width: `${inShare * 100}%` }} title={`Entrada: ${(getSegmentTimelineDuration(animation.in, layer.text) / 30).toFixed(1)} s`}>
                        <i role="slider" tabIndex={-1} aria-label="Cuánto tarda en entrar"
                          aria-valuenow={Math.round(getSegmentTimelineDuration(animation.in, layer.text))}
                          onPointerDown={(event) => beginFx(event, layer, 'in')} />
                      </b>
                    )}
                    {outShare > 0 && (
                      <b className="clip-fx out" style={{ width: `${outShare * 100}%` }} title={`Salida: ${(getSegmentTimelineDuration(animation.out, layer.text) / 30).toFixed(1)} s`}>
                        <i role="slider" tabIndex={-1} aria-label="Cuánto tarda en salir"
                          aria-valuenow={Math.round(getSegmentTimelineDuration(animation.out, layer.text))}
                          onPointerDown={(event) => beginFx(event, layer, 'out')} />
                      </b>
                    )}
                    <span>{layer.text.trim() || layer.name}</span>
                    <i className="clip-resize" aria-label="Cambiar cuánto dura" onPointerDown={(event) => begin(event, layer, 'resize')} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div></div>
      {activeLayer && <div className="clip-times">
        <label>Inicio <input type="number" aria-label="Inicio de la frase en segundos" min={0} step={1 / 30} value={Number((activeLayer.startFrame / 30).toFixed(2))} disabled={activeLayer.locked} onChange={(e) => { if (e.target.value !== '') onChange(activeId, { startFrame: Math.max(0, Math.round(Number(e.target.value) * 30)) }); }} /> s</label>
        <label>Duración <input type="number" aria-label="Duración de la frase en segundos" min={0.5} step={1 / 30} value={Number((getLayerDuration(activeLayer) / 30).toFixed(2))} disabled={activeLayer.locked} onChange={(e) => { if (e.target.value !== '') onChange(activeId, { durationFrames: Math.max(15, Math.round(Number(e.target.value) * 30)) }); }} /> s</label>
        <span>{activeAuto ? 'Duración automática' : 'Duración manual'} · {layers.length} frases</span>
      </div>}
    </section>
  );
};
