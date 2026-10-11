import { Lock } from 'lucide-react';
import type { CaptionIssue } from '../engine/captionReview';
import type { TextLayer } from '../types/motion';

type Props = {
  issues: CaptionIssue[];
  layers: TextLayer[];
  activeId: string;
  onJump: (issue: CaptionIssue) => void;
};

const clock = (frame: number) => `${(Math.max(0, frame) / 30).toFixed(1)} s`;

/**
 * Avisos de legibilidad. Sólo se leen: tocar uno selecciona la frase y mueve el
 * cabezal. No editan nada, no entran al historial y no bloquean la exportación.
 */
export const CaptionReviewPanel = ({ issues, layers, activeId, onJump }: Props) => {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  return (
    <div className="panel-block caption-review">
      <h3>{issues.length} {issues.length === 1 ? 'aviso' : 'avisos'} de lectura</h3>
      <p className="hint">Son sugerencias para que se lea mejor. No cambian nada ni impiden exportar.</p>
      {issues.length === 0 ? (
        <p className="hint" role="status">Sin avisos: la velocidad, los tiempos y los textos se ven bien.</p>
      ) : (
        <ul className="review-list">
          {issues.map((issue, index) => {
            const layer = byId.get(issue.layerId);
            const label = layer?.text.trim().slice(0, 40) || 'Frase vacía';
            return (
              <li key={`${issue.layerId}-${issue.code}-${index}`}>
                <button type="button" className={`review-item ${issue.layerId === activeId ? 'active' : ''}`}
                  aria-label={`${issue.message} Ir a «${label}», ${clock(issue.startFrame)}`} onClick={() => onJump(issue)}>
                  <span className="review-time">{clock(issue.startFrame)}</span>
                  <span className="review-text"><b>{label}</b><small>{issue.message}</small></span>
                  {layer?.locked && <Lock size={12} aria-label="Frase bloqueada" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
