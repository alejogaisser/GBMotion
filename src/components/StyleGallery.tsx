import { useMemo, useState } from 'react';
import { Bookmark, Search, Trash2 } from 'lucide-react';
import type { StyleCategory, TextStylePreset, TypographySettings } from '../types/motion';
import { styleCategoryLabels, styleCategoryOrder } from '../presets/styles';
import { normalizeTypography, previewCss, secondaryCss } from '../engine/textPaint';

type Props = {
  styles: TextStylePreset[];
  typography: TypographySettings;
  text: string;
  onApply: (typography: TypographySettings) => void;
  onSaveCurrent: () => void;
  onDelete: (id: string) => void;
};

/**
 * Qué campos definen "el mismo look". Sirven para marcar la tarjeta activa aun
 * después de que la persona cambie el tamaño o mueva el texto, que no son
 * parte del estilo.
 */
const signature = (t: TypographySettings) => JSON.stringify([
  t.fontFamily, t.fontWeight, t.italic, t.uppercase,
  t.fill ?? { type: 'solid', color: t.color },
  t.strokes ?? [{ color: t.strokeColor, width: t.strokeWidth }],
  t.glow ?? null, t.box ?? null, t.secondary ?? null,
  t.shadowColor, t.shadowBlur, t.shadowOpacity, t.shadowX ?? 0, t.shadowY ?? 5,
]);

/** Fondos que imitan un cuadro de video, para juzgar el contraste real. */
const backdrops = [
  'linear-gradient(155deg,#2c3a56,#10141c 58%,#2a1620)',
  'linear-gradient(155deg,#3d2a1c,#150f0b 60%,#2d2418)',
  'linear-gradient(155deg,#16332b,#0a1512 60%,#0f2a3a)',
  'linear-gradient(155deg,#2c1c3d,#120c1a 60%,#3a1526)',
  'linear-gradient(155deg,#0f1a2e,#080b12 65%,#131c2b)',
  'linear-gradient(155deg,#33241a,#141010 60%,#2b1519)',
];

/**
 * El texto de la persona, recortado para que entre en una miniatura.
 *
 * Los estilos de dos tipografías necesitan dos renglones para que se note la
 * diferencia; si la frase viene en uno solo, se parte al medio.
 */
const previewLines = (text: string, fallback: string, needsTwo: boolean) => {
  const source = text.trim() || fallback;
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 2);
  const words = source.split(/\s+/).filter(Boolean);
  if (!needsTwo) return [words.slice(0, 4).join(' ')];
  if (words.length < 2) return [words.join(' ')];
  const cut = Math.ceil(Math.min(words.length, 5) / 2);
  return [words.slice(0, cut).join(' '), words.slice(cut, 5).join(' ')];
};

const previewSize = (lines: string[]) => {
  const longest = Math.max(...lines.map((line) => line.length), 1);
  if (longest > 22) return 15;
  if (longest > 16) return 18;
  if (longest > 11) return 22;
  if (longest > 7) return 26;
  return 30;
};

export const StyleGallery = ({ styles, typography, text, onApply, onSaveCurrent, onDelete }: Props) => {
  const [category, setCategory] = useState<StyleCategory | 'todos'>('todos');
  const [query, setQuery] = useState('');
  const current = signature(typography);

  const categories = useMemo(() => {
    const present = new Set(styles.map((item) => item.category ?? 'mios'));
    return styleCategoryOrder.filter((id) => present.has(id));
  }, [styles]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return styles.filter((item) => {
      if (category !== 'todos' && (item.category ?? 'mios') !== category) return false;
      if (!needle) return true;
      return `${item.name} ${item.description}`.toLocaleLowerCase('es').includes(needle);
    });
  }, [category, query, styles]);

  return (
    <div className="gallery">
      <div className="gallery-tools">
        <label className="search">
          <Search size={14} aria-hidden="true" />
          <input type="search" value={query} placeholder="Buscar un estilo…" aria-label="Buscar un estilo" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="chip-action" onClick={onSaveCurrent} title="Guardar el look actual para reusarlo">
          <Bookmark size={13} aria-hidden="true" /> Guardar
        </button>
      </div>

      <div className="chips" role="tablist" aria-label="Categorías de estilo">
        <button type="button" role="tab" aria-selected={category === 'todos'} className={category === 'todos' ? 'on' : ''} onClick={() => setCategory('todos')}>Todos</button>
        {categories.map((id) => (
          <button type="button" role="tab" key={id} aria-selected={category === id} className={category === id ? 'on' : ''} onClick={() => setCategory(id)}>
            {styleCategoryLabels[id]}
          </button>
        ))}
      </div>

      <div className="gallery-grid">
        {visible.map((preset, index) => {
          const secondary = normalizeTypography(preset.typography).secondary;
          const lines = previewLines(text, preset.sample ?? preset.name, Boolean(secondary));
          const size = previewSize(lines);
          const selected = signature(preset.typography) === current;
          return (
            <div className={`style-card ${selected ? 'on' : ''}`} key={preset.id}>
              <button
                type="button"
                className="style-card-frame"
                style={{ backgroundImage: backdrops[index % backdrops.length] }}
                aria-pressed={selected}
                title={preset.description}
                onClick={() => onApply(preset.typography)}
              >
                <span style={previewCss(preset.typography, size)}>
                  {lines.map((line, lineIndex) => (
                    <span
                      key={`${line}-${lineIndex}`}
                      style={{
                        display: 'block',
                        ...(secondary && lineIndex > 0
                          ? secondaryCss(secondary, size / Math.max(1, preset.typography.fontSize))
                          : {}),
                      }}
                    >{line}</span>
                  ))}
                </span>
              </button>
              <span className="style-card-name">{preset.name}</span>
              {preset.custom && (
                <button type="button" className="style-card-delete" aria-label={`Borrar el estilo ${preset.name}`} onClick={() => onDelete(preset.id)}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="empty">No hay estilos con ese filtro.</p>}
      </div>
    </div>
  );
};
