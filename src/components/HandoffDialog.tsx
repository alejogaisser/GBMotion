import { useEffect, useMemo, useRef, useState } from 'react';
import { Thumbnail } from '@remotion/player';
import { X } from 'lucide-react';
import { TextComposition } from '../remotion/TextComposition';
import type { TextLayer } from '../types/motion';
import { getLayerDuration } from '../utils/duration';
import { applyHandoffToLayer, handoffTitle, type HandoffV1 } from '../utils/handoff';

export type HandoffScope = 'active' | 'all';

type Props = {
  handoff: HandoffV1;
  /** La frase seleccionada: sobre ella se arma la vista previa. */
  baseLayer: TextLayer;
  unlockedCount: number;
  /** Falso si el proyecto ya está en el máximo de frases. */
  canAddPhrase: boolean;
  onApply: (scope: HandoffScope, addPhrase: boolean) => void;
  onCancel: () => void;
};

/** Vista previa del estilo recibido y confirmación antes de tocar el proyecto. */
export const HandoffDialog = ({ handoff, baseLayer, unlockedCount, canAddPhrase, onApply, onCancel }: Props) => {
  const { style, phrase } = handoff;
  const hasPhrase = Boolean(phrase && phrase.trim());
  const [scope, setScope] = useState<HandoffScope>(unlockedCount > 1 ? 'all' : 'active');
  const [addPhrase, setAddPhrase] = useState(false);
  const applyButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    applyButton.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onCancel]);

  const preview = useMemo(() => {
    const base = structuredClone(baseLayer);
    base.startFrame = 0; base.durationFrames = undefined; base.positionX = 0; base.positionY = 0; base.rotation = 0;
    base.visible = true; base.locked = false;
    if (!base.text.trim()) base.text = 'Tu frase';
    const styled = applyHandoffToLayer(base, style, { phrase: hasPhrase ? phrase : undefined, keepFontSize: false, hold: 'payload', createWordTiming: true });
    styled.typography.fontSize = Math.min(styled.typography.fontSize, 110);
    return styled;
  }, [baseLayer, style, phrase, hasPhrase]);

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="handoff-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onCancel} aria-label="Cerrar"><X size={18} /></button>
        <span className="eyebrow">Estilo recibido</span>
        <h2 id="handoff-title">{handoffTitle(style)}</h2>
        <p>Así queda el estilo. Todavía no se cambió nada en tu proyecto.</p>
        <div className="handoff-preview" aria-label={`Vista previa de ${handoffTitle(style)}`}>
          <Thumbnail
            component={TextComposition}
            inputProps={{ layers: [preview], background: 'black', customBackground: '#0E0E0C' }}
            compositionWidth={960} compositionHeight={540} fps={30}
            durationInFrames={getLayerDuration(preview)}
            frameToDisplay={Math.floor(getLayerDuration(preview) * 0.4)}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <div className="segmented" role="group" aria-label="A qué frases se aplica">
          <button type="button" className={scope === 'active' ? 'on' : ''} aria-pressed={scope === 'active'} onClick={() => setScope('active')}>A la frase seleccionada</button>
          <button type="button" className={scope === 'all' ? 'on' : ''} aria-pressed={scope === 'all'} disabled={unlockedCount === 0} onClick={() => setScope('all')}>A todas</button>
        </div>
        <p className="hint">Se conservan los textos, los tiempos, las posiciones y los tamaños. Las frases bloqueadas no cambian.</p>
        {hasPhrase && (
          <label className="toggle-row">
            <span><strong>Agregar mi frase</strong> «{phrase}»</span>
            <input type="checkbox" aria-label="Agregar mi frase" checked={addPhrase && canAddPhrase} disabled={!canAddPhrase} onChange={(event) => setAddPhrase(event.target.checked)} />
          </label>
        )}
        {hasPhrase && !canAddPhrase && <p className="hint">El proyecto ya tiene el máximo de frases.</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" ref={applyButton} className="button primary" onClick={() => onApply(scope, addPhrase && canAddPhrase)}>Aplicar</button>
        </div>
      </div>
    </div>
  );
};
