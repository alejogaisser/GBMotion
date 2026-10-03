import type { TextLayer } from '../types/motion';
import { activeWord, evenWordTiming, type WordTiming } from '../engine/editorMotion';
import { getLayerDuration } from '../utils/duration';

export function WordTimingPanel({ layer, frame, onChange, onSeek }: { layer: TextLayer; frame: number; onChange: (timing: WordTiming | undefined) => void; onSeek: (frame: number) => void }) {
  const duration = getLayerDuration(layer);
  const timing = layer.wordTiming;
  const localFrame = frame - layer.startFrame;
  const active = activeWord(timing, localFrame);
  return <details className="tuner"><summary>Sincronizar palabra por palabra</summary><div className="tuner-block">
    <p className="hint">El color o la caja siguen los tiempos que fijes. La distribución inicial es una guía uniforme; escuchá el audio para ajustarla.</p>
    <button className="ghost-button" disabled={layer.locked || !layer.text.trim() || duration < (layer.text.match(/\S+/g)?.length ?? 0)} onClick={() => onChange(evenWordTiming(layer.text, duration))}>{timing ? 'Redistribuir tiempos' : 'Preparar palabras'}</button>
    {timing && <>
      <div className="control-row"><select aria-label="Tipo de resaltado por palabra" value={timing.mode} disabled={layer.locked} onChange={(e) => onChange({ ...timing, mode: e.target.value as WordTiming['mode'] })}><option value="color">Color de letra</option><option value="box">Caja de color</option></select>
        <input aria-label="Color de la palabra activa" type="color" value={timing.color} disabled={layer.locked} onChange={(e) => onChange({ ...timing, color: e.target.value })} />
      </div>
      <div className="word-timing-table">{timing.words.map((word, index) => <div className={index === active ? 'active' : ''} key={index}>
        <button className="linklike" onClick={() => onSeek(layer.startFrame + word.start)}>{word.word}</button>
        <input type="number" step={1 / 30} min={index === 0 ? 0 : timing.words[index - 1].start / 30} max={(word.end - 1) / 30} aria-label={`Inicio de palabra ${index + 1}`} value={Number((word.start / 30).toFixed(2))} disabled={layer.locked}
          onChange={(e) => { if (!e.target.value) return; const start = Math.max(index === 0 ? 0 : timing.words[index - 1].start + 1, Math.min(word.end - 1, Math.round(Number(e.target.value) * 30))); onChange({ ...timing, words: timing.words.map((w, i) => i === index ? { ...w, start } : i === index - 1 ? { ...w, end: start } : w) }); }} />
        <button className="ghost-button tiny" disabled={layer.locked || localFrame < (index === 0 ? 0 : timing.words[index - 1].start + 1) || localFrame >= word.end} onClick={() => onChange({ ...timing, words: timing.words.map((w, i) => i === index ? { ...w, start: localFrame } : i === index - 1 ? { ...w, end: localFrame } : w) })}>Marcar aquí</button>
      </div>)}</div>
      <p className="hint">Los tiempos se expresan en segundos desde el inicio de esta frase.</p>
      <button className="ghost-button" disabled={layer.locked} onClick={() => onChange(undefined)}>Quitar sincronización</button>
    </>}
  </div></details>;
}
