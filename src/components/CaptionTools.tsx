import { useRef, useState } from 'react';
import { parseSubtitles, scriptToCues, type CaptionCue } from '../utils/subtitles';

export function CaptionTools({ onImport, currentFrame, onExport }: {
  onImport: (cues: CaptionCue[]) => void; currentFrame: number; onExport: (kind: 'srt' | 'vtt') => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [script, setScript] = useState('');
  const [seconds, setSeconds] = useState(3);
  const [error, setError] = useState('');
  return <details className="tuner caption-tools">
    <summary>Guion y subtítulos</summary>
    <div className="tuner-block">
      <p className="hint">Agregá frases sin reemplazar las que ya tenés. Los archivos conservan sus tiempos originales.</p>
      <button className="ghost-button" onClick={() => input.current?.click()}>Importar SRT / VTT</button>
      <input hidden ref={input} type="file" accept=".srt,.vtt" onChange={async (e) => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        try { if (file.size > 1_000_000) throw new Error('El archivo supera 1 MB.'); onImport(parseSubtitles(await file.text())); setError(''); }
        catch (err) { setError(err instanceof Error ? err.message : 'No se pudo importar.'); }
      }} />
      <label className="field"><span>Una frase por renglón</span><textarea aria-label="Guion para agregar frases" rows={5} value={script} maxLength={22000} onChange={(e) => setScript(e.target.value)} placeholder={'La primera idea\nLa segunda idea\nEl cierre'} /></label>
      <label className="field"><span>Segundos por frase</span><input aria-label="Segundos por frase del guion" type="number" min={0.5} max={30} step={0.5} value={seconds} onChange={(e) => setSeconds(Math.max(0.5, Math.min(30, Number(e.target.value))))} /></label>
      <button className="button block" onClick={() => { try { onImport(scriptToCues(script, currentFrame, seconds)); setScript(''); setError(''); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo agregar.'); } }}>Agregar desde el playhead</button>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="control-row"><button className="ghost-button" onClick={() => onExport('srt')}>Descargar SRT</button><button className="ghost-button" onClick={() => onExport('vtt')}>Descargar VTT</button></div>
      <p className="hint">SRT y VTT guardan texto y tiempos. Los estilos y animaciones quedan en el proyecto y el video.</p>
    </div>
  </details>;
}
