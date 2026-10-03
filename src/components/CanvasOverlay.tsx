import { Clock, Lock, MoveDiagonal2, RotateCw } from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TextLayer, VideoFormat } from '../types/motion';
import { calculateTextLayout } from '../engine/textLayout';
import { getLayerDuration } from '../utils/duration';

type Props = {
  onEdit: (id: string) => void;
  layers: TextLayer[];
  activeId: string;
  format: VideoFormat;
  currentFrame: number;
  onSelect: (id: string) => void;
  onBeginInteraction: () => void;
  onChange: (id: string, patch: Partial<TextLayer>) => void;
};

const framesToClock = (frame: number) => {
  const s = Math.floor(Math.max(0, frame) / 30);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Guide = { x?: number; y?: number };

export const estimateLayerBox = (layer: TextLayer, format: VideoFormat) => {
  const result = calculateTextLayout(layer, format);
  return {
    width: Math.min(format.width, Math.max(result.fontSize * 1.2, result.width)),
    height: Math.min(format.height, Math.max(result.fontSize * 0.9, result.height)),
  };
};

const nearestSnap = (value: number, targets: number[], threshold = 18) => {
  const nearest = targets.reduce((best, target) => Math.abs(target - value) < Math.abs(best - value) ? target : best, targets[0] ?? value);
  return Math.abs(nearest - value) <= threshold ? nearest : value;
};

export const CanvasOverlay = ({ layers, activeId, format, currentFrame, onEdit, onSelect, onBeginInteraction, onChange }: Props) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [guide, setGuide] = useState<Guide>({});

  const begin = (event: ReactPointerEvent, layer: TextLayer, action: 'drag' | 'resize' | 'rotate') => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(layer.id);
    if (layer.locked || !overlayRef.current) return;
    onBeginInteraction();

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const scaleX = overlayRect.width / format.width;
    const scaleY = overlayRect.height / format.height;
    const startX = event.clientX;
    const startY = event.clientY;
    const startPositionX = layer.positionX;
    const startPositionY = layer.positionY;
    const startSize = layer.typography.fontSize;
    const box = estimateLayerBox(layer, format);
    const safeX = Math.max(0, format.width / 2 - format.width * 0.08 - box.width / 2);
    const safeY = Math.max(0, format.height / 2 - format.height * 0.08 - box.height / 2);
    const otherLayers = layers.filter((item) => item.id !== layer.id && item.visible);
    const snapX = [0, -safeX, safeX, ...otherLayers.map((item) => item.positionX)];
    const snapY = [0, -safeY, safeY, ...otherLayers.map((item) => item.positionY)];
    const centerX = overlayRect.left + overlayRect.width / 2 + layer.positionX * scaleX;
    const centerY = overlayRect.top + overlayRect.height / 2 + layer.positionY * scaleY;

    const move = (pointer: PointerEvent) => {
      if (action === 'drag') {
        const rawX = startPositionX + (pointer.clientX - startX) / scaleX;
        const rawY = startPositionY + (pointer.clientY - startY) / scaleY;
        const positionX = nearestSnap(rawX, snapX);
        const positionY = nearestSnap(rawY, snapY);
        setGuide({ x: positionX !== rawX ? positionX : undefined, y: positionY !== rawY ? positionY : undefined });
        onChange(layer.id, { positionX, positionY });
      }
      if (action === 'resize') {
        const delta = ((pointer.clientX - startX) / scaleX + (pointer.clientY - startY) / scaleY) / 3;
        onChange(layer.id, { typography: { ...layer.typography, fontSize: Math.max(36, Math.min(360, startSize + delta)) } });
      }
      if (action === 'rotate') {
        const rotation = Math.atan2(pointer.clientY - centerY, pointer.clientX - centerX) * 180 / Math.PI + 90;
        const snappedRotation = nearestSnap(rotation, [0, 45, 90, 135, 180, -45, -90, -135, -180], 4);
        onChange(layer.id, { rotation: snappedRotation });
      }
    };

    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      setGuide({});
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  };

  return (
    <div className="canvas-overlay" ref={overlayRef} aria-label="Edición directa del lienzo">
      {guide.x !== undefined && <span className="smart-guide vertical" style={{ left: `${50 + guide.x / format.width * 100}%` }} />}
      {guide.y !== undefined && <span className="smart-guide horizontal" style={{ top: `${50 + guide.y / format.height * 100}%` }} />}
      {layers.filter((layer) => layer.visible).map((layer) => {
        const box = estimateLayerBox(layer, format);
        const active = layer.id === activeId;
        const start = Math.max(0, layer.startFrame ?? 0);
        const end = start + getLayerDuration(layer);
        const inWindow = currentFrame >= start && currentFrame < end;
        return (
          <div
            key={layer.id}
            role="button"
            tabIndex={active ? 0 : -1}
            aria-label={`${active ? 'Texto seleccionado' : 'Seleccionar texto'}: ${layer.name}${layer.locked ? ', bloqueado' : ''}${inWindow ? '' : `, aparece en ${framesToClock(start)}`}`}
            className={`canvas-layer-box ${active ? 'active' : ''} ${layer.locked ? 'locked' : ''} ${inWindow ? '' : 'out-of-time'}`}
            style={{
              width: `${box.width / format.width * 100}%`,
              height: `${box.height / format.height * 100}%`,
              left: `${50 + layer.positionX / format.width * 100}%`,
              top: `${50 + layer.positionY / format.height * 100}%`,
              transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg)`,
            }}
            onDoubleClick={() => { if (!layer.locked) onEdit(layer.id); }}
            onPointerDown={(event) => begin(event, layer, 'drag')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(layer.id); return; }
              if (layer.locked) return;
              const step = event.shiftKey ? 40 : 8;
              const nudge: Record<string, Partial<TextLayer>> = {
                ArrowLeft: { positionX: layer.positionX - step },
                ArrowRight: { positionX: layer.positionX + step },
                ArrowUp: { positionY: layer.positionY - step },
                ArrowDown: { positionY: layer.positionY + step },
              };
              const patch = nudge[event.key];
              if (patch) { event.preventDefault(); onChange(layer.id, patch); }
            }}
          >
            {!inWindow && <span className="canvas-time-badge"><Clock size={10} /> {framesToClock(start)}</span>}
            {active && <>
              <span className="canvas-label">{layer.locked ? <><Lock size={11} /> Bloqueado</> : !inWindow ? `Aparece en ${framesToClock(start)}` : 'Arrastrá para mover'}</span>
              {!layer.locked && <>
                <button type="button" className="canvas-handle rotate" aria-label="Girar texto" onPointerDown={(event) => begin(event, layer, 'rotate')}><RotateCw size={12} /></button>
                <button type="button" className="canvas-handle resize" aria-label="Cambiar tamaño del texto" onPointerDown={(event) => begin(event, layer, 'resize')}><MoveDiagonal2 size={12} /></button>
              </>}
            </>}
          </div>
        );
      })}
    </div>
  );
};
