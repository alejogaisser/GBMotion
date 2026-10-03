import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import {
  fontCategoryLabels,
  fontFromFamily,
  fontRegistry,
  type FontCategory,
  type FontDefinition,
} from '../typography/fontRegistry';

type FontView = 'all' | 'favorites' | 'recent' | FontCategory;

type Props = {
  fontFamily: string;
  text: string;
  onSelect: (font: FontDefinition) => void;
};

const FAVORITES_KEY = 'gb-motion:font-favorites';
const RECENTS_KEY = 'gb-motion:font-recents';

const readIds = (key: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeIds = (key: string, ids: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* The font browser remains usable without persistence. */ }
};

const viewLabels: { id: FontView; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'favorites', label: 'Favoritas' },
  { id: 'recent', label: 'Recientes' },
  ...Object.entries(fontCategoryLabels).map(([id, label]) => ({ id: id as FontCategory, label })),
];

export const FontBrowser = ({ fontFamily, text, onSelect }: Props) => {
  const selected = fontFromFamily(fontFamily);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<FontView>('all');
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_KEY));
  const [recents, setRecents] = useState<string[]>(() => readIds(RECENTS_KEY));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const visibleFonts = useMemo(() => {
    const recentFonts = recents
      .map((id) => fontRegistry.find((item) => item.id === id))
      .filter((item): item is FontDefinition => Boolean(item));
    const base = view === 'recent' ? recentFonts : fontRegistry;
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return base.filter((item) => {
      if (view === 'favorites' && !favorites.includes(item.id)) return false;
      if (!['all', 'favorites', 'recent'].includes(view) && item.category !== view) return false;
      return !normalizedQuery || `${item.displayName} ${fontCategoryLabels[item.category]}`.toLocaleLowerCase('es').includes(normalizedQuery);
    });
  }, [favorites, query, recents, view]);

  const choose = (definition: FontDefinition) => {
    const nextRecents = [definition.id, ...recents.filter((id) => id !== definition.id)].slice(0, 6);
    setRecents(nextRecents);
    writeIds(RECENTS_KEY, nextRecents);
    onSelect(definition);
    setOpen(false);
  };

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    writeIds(FAVORITES_KEY, next);
  };

  return (
    <div className="font-browser">
      <span className="field-label">Tipo de letra</span>
      <button
        type="button"
        className="font-browser-trigger"
        aria-expanded={open}
        aria-controls="font-browser-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span style={{ fontFamily: `"${selected.family}"`, fontWeight: selected.defaultWeight }}>{selected.displayName}</span>
        <small>{fontCategoryLabels[selected.category]}</small>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="font-browser-panel" id="font-browser-panel" aria-label="Explorador de fuentes">
          <div className="font-browser-heading">
            <div><strong>Elegí una letra</strong><small>Podés probarlas sin miedo</small></div>
            <button type="button" aria-label="Cerrar fuentes" onClick={() => setOpen(false)}><X size={17} /></button>
          </div>
          <label className="font-search">
            <Search size={15} aria-hidden="true" />
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar una fuente…" />
          </label>
          <div className="font-filters" aria-label="Filtrar fuentes">
            {viewLabels.map((item) => (
              <button type="button" key={item.id} className={view === item.id ? 'active' : ''} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</button>
            ))}
          </div>
          <div className="font-list" aria-live="polite">
            {visibleFonts.map((definition) => (
              <div className={`font-option ${definition.id === selected.id ? 'selected' : ''}`} key={definition.id}>
                <button type="button" className="font-option-main" onClick={() => choose(definition)}>
                  <span className="font-option-name">{definition.displayName}</span>
                  <strong style={{ fontFamily: `"${definition.family}"`, fontWeight: definition.defaultWeight }}>{text.trim().slice(0, 70) || 'Tu próxima gran idea'}</strong>
                  <small>{fontCategoryLabels[definition.category]} · {definition.availableStyles.includes('italic') ? 'con cursiva' : 'sin cursiva'}</small>
                </button>
                <button
                  type="button"
                  className={`font-favorite ${favorites.includes(definition.id) ? 'active' : ''}`}
                  aria-label={`${favorites.includes(definition.id) ? 'Quitar' : 'Agregar'} ${definition.displayName} ${favorites.includes(definition.id) ? 'de' : 'a'} favoritas`}
                  aria-pressed={favorites.includes(definition.id)}
                  onClick={() => toggleFavorite(definition.id)}
                >
                  <Star size={16} fill={favorites.includes(definition.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
            {visibleFonts.length === 0 && <p className="font-empty">No encontré fuentes con ese filtro.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
