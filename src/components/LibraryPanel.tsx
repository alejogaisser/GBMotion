import { useEffect, useRef, useState } from 'react';
import { libraryOperation, type LibraryEntry } from '../utils/library';
import type { ProjectState } from '../utils/project';
import type { TextLayer } from '../types/motion';
import { animationForLayer } from '../engine/layerAnimation';

export function LibraryPanel({ project, layer, onOpen, onKit, onClose }: {
  project: Omit<ProjectState, 'version'>; layer: TextLayer; onOpen: (project: Omit<ProjectState, 'version'>) => void;
  onKit: (entry: Extract<LibraryEntry, { kind: 'kit' }>) => void; onClose: () => void;
}) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [name, setName] = useState(project.name ?? 'Mi proyecto');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); void libraryOperation('list').then(setEntries).catch(() => setError('No se pudo abrir la biblioteca local. Podés descargar un JSON desde la barra superior.')); }, []);
  const save = async (kind: 'project' | 'kit') => {
    setBusy(true); setError('');
    try {
      const common = { id: crypto.randomUUID(), name: name.trim() || (kind === 'kit' ? 'Mi marca' : 'Mi proyecto'), savedAt: Date.now() };
      const entry: LibraryEntry = kind === 'project' ? { ...common, kind, project: structuredClone(project) } : { ...common, kind, typography: structuredClone(layer.typography), animation: structuredClone(animationForLayer(layer)) };
      setEntries(await libraryOperation('save', entry));
    } catch { setError('No se pudo guardar. Descargá el proyecto como JSON para conservar una copia.'); }
    finally { setBusy(false); }
  };
  const open = async (entry: Extract<LibraryEntry, { kind: 'project' }>) => {
    setBusy(true); setError('');
    try {
      // Opening another project keeps an independent recovery snapshot first.
      await libraryOperation('save', { id: crypto.randomUUID(), kind: 'project', name: `${project.name || 'Proyecto'} · recuperación`, savedAt: Date.now(), project: structuredClone(project) });
      onOpen(entry.project); onClose();
    } catch { setError('No se pudo respaldar el proyecto actual; no se cambió de proyecto.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><section className="modal library-modal" role="dialog" aria-modal="true" aria-label="Biblioteca local" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') { const focusables = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]')); const first = focusables[0]; const last = focusables[focusables.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
  }}>
    <button ref={closeRef} className="modal-close" aria-label="Cerrar biblioteca" onClick={onClose}>×</button>
    <h2>Tu biblioteca</h2><p>Proyectos y kits de marca guardados en este navegador. Cada guardado crea una copia independiente.</p>
    <label className="field"><span>Nombre de la copia o kit</span><input aria-label="Nombre en biblioteca" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
    <div className="control-row"><button className="button" disabled={busy} onClick={() => void save('project')}>Guardar proyecto</button><button className="button" disabled={busy} onClick={() => void save('kit')}>Guardar kit de marca</button></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="library-entries">{entries.map((entry) => <article key={entry.id}>
      <span className="library-preview" style={entry.kind === 'kit' ? { fontFamily: entry.typography.fontFamily, color: entry.typography.color } : {}}>{entry.kind === 'kit' ? 'Aa' : entry.project.layers[0]?.text.slice(0, 26)}</span>
      <div><strong>{entry.name}</strong><small>{entry.kind === 'kit' ? 'Kit de marca' : 'Proyecto'} · {new Date(entry.savedAt).toLocaleString('es-AR')}</small></div>
      <button className="ghost-button" disabled={busy} onClick={() => entry.kind === 'project' ? void open(entry) : (onKit(entry), onClose())}>{entry.kind === 'project' ? 'Abrir' : 'Aplicar'}</button>
    </article>)}{!entries.length && <p>Todavía no hay copias guardadas. Tu proyecto actual sigue guardándose automáticamente.</p>}</div>
    <p>Los kits conservan tipografía, colores, pintura y movimiento. El video de referencia debe volver a seleccionarse.</p>
  </section></div>;
}
