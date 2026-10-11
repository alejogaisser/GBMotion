import { useState } from 'react';
import type { CaptionTemplate } from '../presets/templates';

export type TemplateScope = 'active' | 'all';

type Props = {
  templates: CaptionTemplate[];
  activeLocked: boolean;
  unlockedCount: number;
  onApply: (template: CaptionTemplate, scope: TemplateScope) => void;
};

/** «Plantillas»: look + entrada/salida + resaltado con nombre. Un clic, un paso de historial. */
export const TemplatePicker = ({ templates, activeLocked, unlockedCount, onApply }: Props) => {
  const [scope, setScope] = useState<TemplateScope>('active');
  const blocked = scope === 'active' ? activeLocked : unlockedCount === 0;
  const reason = scope === 'active' ? 'La frase está bloqueada: desbloqueala para aplicarle una plantilla.' : 'Todas las frases están bloqueadas.';
  return (
    <div className="panel-block template-picker-named">
      <h3>Plantillas</h3>
      <p className="hint">Look, entrada, salida y resaltado de la palabra, todo junto. Se conservan el texto, los tiempos, la posición y el tamaño.</p>
      <div className="segmented" role="group" aria-label="A qué frases se aplica">
        <button type="button" className={scope === 'active' ? 'on' : ''} aria-pressed={scope === 'active'} onClick={() => setScope('active')}>A esta frase</button>
        <button type="button" className={scope === 'all' ? 'on' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>A todas</button>
      </div>
      <ul className="template-grid">
        {templates.map((template) => (
          <li key={template.id}>
            <button type="button" className="template-card" disabled={blocked} onClick={() => onApply(template, scope)}>
              <strong>{template.name}</strong>
              <small>{template.description}</small>
            </button>
          </li>
        ))}
      </ul>
      {blocked && <p className="hint" role="status">{reason}</p>}
    </div>
  );
};
