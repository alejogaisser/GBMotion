import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type SavePresetKind = 'motion' | 'style' | 'combo';
type Props = {
  suggestedName: string;
  /** Cuando viene, el modal guarda sólo eso y no muestra el selector. */
  lockedKind?: SavePresetKind;
  onCancel: () => void;
  onSave: (name: string, kind: SavePresetKind) => void;
};

const kindTitles: Record<SavePresetKind, string> = {
  motion: 'Guardar este movimiento',
  style: 'Guardar este estilo',
  combo: 'Guardar estilo y movimiento',
};

export const SavePresetModal = ({ suggestedName, lockedKind, onCancel, onSave }: Props) => {
  const [name, setName] = useState(suggestedName);
  const [kind, setKind] = useState<SavePresetKind>(lockedKind ?? 'motion');
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="save-preset-title" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave(name.trim(), kind); }} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onCancel} aria-label="Cerrar"><X size={18} /></button>
        <span className="eyebrow">Mi biblioteca</span><h2 id="save-preset-title">{kindTitles[kind]}</h2>
        <p>{lockedKind === 'style' ? 'Va a quedar en «Mis estilos» para aplicarlo en cualquier video.' : 'Elegí si querés guardar sólo el aspecto, sólo el movimiento o los dos juntos.'}</p>
        {!lockedKind && <label className="field"><span>Qué querés guardar</span><select value={kind} onChange={(event) => setKind(event.target.value as SavePresetKind)}><option value="motion">Sólo movimiento</option><option value="style">Sólo estilo de texto</option><option value="combo">Combinación completa</option></select></label>}
        <label className="field"><span>Nombre</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancelar</button><button type="submit" className="button primary">Guardar</button></div>
      </form>
    </div>
  );
};
