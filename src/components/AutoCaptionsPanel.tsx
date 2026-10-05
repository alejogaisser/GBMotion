import { Loader2, Wand2 } from 'lucide-react';
import type { TranscribeLanguage, TranscribeProviderId } from '../captions/types';
import { useTranscription } from '../hooks/useTranscription';
import type { TextLayer, WordHighlightMode } from '../types/motion';
import type { TranscribeStage } from '../utils/mediaClient';

type Props = {
  /** Id del video guardado en el servidor; vacío si todavía no hay uno. */
  mediaId: string;
  /** La frase seleccionada: su look y su movimiento se pueden usar como plantilla. */
  templateLayer: TextLayer;
  createId: () => string;
  /** Aplica los subtítulos como un solo paso de historial. Devuelve un mensaje si no entran. */
  onApply: (layers: TextLayer[], mode: 'replace' | 'append') => string | null;
};

const stageText: Record<TranscribeStage, string> = {
  extracting: 'Extrayendo el audio…',
  uploading: 'Enviando el audio a la IA…',
  transcribing: 'Transcribiendo…',
  done: 'Listo.',
  error: 'Algo falló.',
};

const highlights: { id: WordHighlightMode; label: string }[] = [
  { id: 'color', label: 'Color de letra' },
  { id: 'box', label: 'Caja de color' },
  { id: 'karaoke', label: 'Karaoke (las dichas quedan de color)' },
  { id: 'reveal', label: 'Aparecen al decirse' },
  { id: 'scale', label: 'Crece la palabra activa' },
];

export const AutoCaptionsPanel = ({ mediaId, templateLayer, createId, onApply }: Props) => {
  const t = useTranscription({ mediaId, templateLayer, createId, onApply });
  const {
    providers, language, setLanguage, provider, setProvider, maxWords, setMaxWords, maxChars, setMaxChars,
    onSilence, setOnSilence, removeFillers, setRemoveFillers, highlight, setHighlight, color, setColor,
    useLook, setUseLook, applyMode, setApplyMode, stage, running, error, done, generate, cancel,
  } = t;
  const configured = providers.filter((item) => item.configured);

  return (
    <div className="panel-block auto-captions">
      <h3>Subtítulos automáticos</h3>
      <p className="hint">La IA escucha el audio de tu video y arma los subtítulos con el tiempo de cada palabra. Sólo se envía el audio; el video queda en tu computadora.</p>

      <div className="control-row">
        <label className="field"><span>Idioma</span>
          <select aria-label="Idioma del video" value={language} disabled={running} onChange={(event) => setLanguage(event.target.value as TranscribeLanguage)}>
            <option value="es">Español</option><option value="auto">Detectar</option><option value="en">Inglés</option><option value="pt">Portugués</option>
          </select>
        </label>
        <label className="field"><span>Servicio</span>
          <select aria-label="Servicio de transcripción" value={provider} disabled={running || configured.length === 0} onChange={(event) => setProvider(event.target.value as '' | TranscribeProviderId)}>
            {configured.length === 0 ? <option value="">Sin claves</option> : <option value="">Automático</option>}
            {configured.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <label className="time-field"><span>Palabras por subtítulo</span>
        <input type="range" min={1} max={8} step={1} value={maxWords} disabled={running} aria-label="Palabras por subtítulo" onChange={(event) => setMaxWords(Number(event.target.value))} />
        <output>{maxWords}</output>
      </label>
      <label className="time-field"><span>Máx. caracteres</span>
        <input type="range" min={8} max={42} step={1} value={maxChars} disabled={running} aria-label="Máximo de caracteres" onChange={(event) => setMaxChars(Number(event.target.value))} />
        <output>{maxChars}</output>
      </label>
      <label className="toggle-row"><span><strong>Cortar en pausas</strong></span><input type="checkbox" aria-label="Cortar en pausas" checked={onSilence} disabled={running} onChange={(event) => setOnSilence(event.target.checked)} /></label>
      <label className="toggle-row"><span><strong>Quitar muletillas (eh, mm…)</strong></span><input type="checkbox" aria-label="Quitar muletillas (eh, mm…)" checked={removeFillers} disabled={running} onChange={(event) => setRemoveFillers(event.target.checked)} /></label>

      <div className="control-row">
        <label className="field"><span>Resaltado</span>
          <select aria-label="Resaltado de la palabra" value={highlight} disabled={running} onChange={(event) => setHighlight(event.target.value as WordHighlightMode)}>
            {highlights.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <input type="color" aria-label="Color del resaltado" value={color} disabled={running} onChange={(event) => setColor(event.target.value)} />
      </div>
      <label className="toggle-row"><span><strong>Usar el look de la frase seleccionada</strong></span><input type="checkbox" aria-label="Usar el look de la frase seleccionada" checked={useLook} disabled={running} onChange={(event) => setUseLook(event.target.checked)} /></label>

      <div className="segmented" role="group" aria-label="Qué hacer con los subtítulos actuales">
        <button type="button" className={applyMode === 'replace' ? 'on' : ''} aria-pressed={applyMode === 'replace'} disabled={running} onClick={() => setApplyMode('replace')}>Reemplazar</button>
        <button type="button" className={applyMode === 'append' ? 'on' : ''} aria-pressed={applyMode === 'append'} disabled={running} onClick={() => setApplyMode('append')}>Agregar</button>
      </div>
      <p className="hint">«Reemplazar» borra las frases actuales y conserva las bloqueadas.</p>

      <button type="button" className="button primary block" disabled={running || !mediaId} onClick={() => void generate()}>
        {running ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />} Generar subtítulos
      </button>
      {!mediaId && <p className="hint">Primero subí un video.</p>}

      {running && stage && (
        <div className="export-status" role="status" aria-live="polite">
          <Loader2 size={14} className="spin" /> <span>{stageText[stage]}</span>
          <button type="button" className="linklike" onClick={cancel}>Cancelar</button>
          <small className="hint">Si cancelás después de enviar el audio, el servicio igual puede cobrarlo.</small>
        </div>
      )}
      {done && <p className="hint" role="status">{done}</p>}
      {error && <p role="alert" className="export-status error">{error}</p>}
    </div>
  );
};
