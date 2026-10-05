import { Link2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TextLayer } from '../types/motion';
import type { CaptionCue } from '../utils/subtitles';
import { CaptionTools } from './CaptionTools';

type Props = {
  layers: TextLayer[];
  activeId: string;
  currentFrame: number;
  onSeek: (frame: number) => void;
  onSelect: (id: string) => void;
  /** Cambia el texto de una frase conservando los tiempos de las palabras que no se tocaron. */
  onText: (id: string, text: string) => void;
  onMerge: (id: string) => void;
  onDelete: (id: string) => void;
  countMatches: (find: string) => number;
  /** Devuelve cuántas frases cambió. Es un solo paso de deshacer. */
  onReplaceAll: (find: string, replacement: string) => number;
  onImport: (cues: CaptionCue[]) => void;
  onExport: (kind: 'srt' | 'vtt') => void;
  flashHint: (message: string) => void;
};

const seconds = (frames: number) => `${(Math.max(0, frames) / 30).toFixed(1)} s`;

/**
 * El guion como lista: una fila por subtítulo, en orden de tiempo. Se corrige el texto,
 * se salta a la frase, se unen dos y se busca y reemplaza en todas a la vez.
 * Con cientos de filas, `content-visibility: auto` evita pintar las que no se ven.
 */
export const SubtitlesPanel = ({
  layers, activeId, currentFrame, onSeek, onSelect, onText, onMerge, onDelete, countMatches, onReplaceAll, onImport, onExport, flashHint,
}: Props) => {
  const [find, setFind] = useState('');
  const [replacement, setReplacement] = useState('');
  const ordered = useMemo(() => layers.map((layer, index) => ({ layer, index })).sort((a, b) => a.layer.startFrame - b.layer.startFrame || a.index - b.index).map((item) => item.layer), [layers]);
  const matches = useMemo(() => countMatches(find), [find, layers]);

  return (
    <div className="subtitles-panel">
      <div className="panel-block">
        <h3>Buscar y reemplazar</h3>
        <div className="control-row">
          <label className="field"><span>Buscar</span><input type="text" aria-label="Buscar en los subtítulos" value={find} onChange={(event) => setFind(event.target.value)} /></label>
          <label className="field"><span>Reemplazar con</span><input type="text" aria-label="Reemplazar con" value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>
        </div>
        <p className="hint" role="status">{find ? `${matches} ${matches === 1 ? 'frase coincide' : 'frases coinciden'}.` : 'No distingue mayúsculas. Las frases bloqueadas no se tocan.'}</p>
        <button type="button" className="ghost-button" disabled={!find || matches === 0} onClick={() => {
          const changed = onReplaceAll(find, replacement);
          flashHint(changed ? `Se reemplazó en ${changed} ${changed === 1 ? 'frase' : 'frases'}. Se deshace con un solo Ctrl+Z.` : 'No hubo cambios.');
        }}>Reemplazar todo</button>
      </div>

      <CaptionTools onImport={onImport} currentFrame={currentFrame} onExport={onExport} />

      <div className="panel-block">
        <h3>{ordered.length} {ordered.length === 1 ? 'subtítulo' : 'subtítulos'}</h3>
        <ol className="sub-list">
          {ordered.map((layer, index) => (
            <li key={layer.id} className={`sub-row ${layer.id === activeId ? 'active' : ''} ${layer.locked ? 'locked' : ''}`}>
              <button type="button" className="linklike sub-time" aria-label={`Ir al subtítulo ${index + 1}, empieza en ${seconds(layer.startFrame)}`} onClick={() => { onSelect(layer.id); onSeek(layer.startFrame); }}>
                <b>{index + 1}</b> {seconds(layer.startFrame)}
              </button>
              <textarea
                className="sub-text"
                aria-label={`Texto del subtítulo ${index + 1}`}
                rows={2}
                maxLength={180}
                value={layer.text}
                disabled={layer.locked}
                onFocus={() => onSelect(layer.id)}
                onChange={(event) => onText(layer.id, event.target.value)}
              />
              <div className="sub-actions">
                <button type="button" className="ghost-button tiny" disabled={layer.locked || index === ordered.length - 1 || ordered[index + 1].locked}
                  aria-label={`Unir el subtítulo ${index + 1} con la siguiente`} title="Unir con la siguiente" onClick={() => onMerge(layer.id)}><Link2 size={12} /> Unir con la siguiente</button>
                <button type="button" className="ghost-button tiny" disabled={layers.length === 1 || layer.locked}
                  aria-label={`Eliminar el subtítulo ${index + 1}`} title="Eliminar" onClick={() => onDelete(layer.id)}><Trash2 size={12} /></button>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
