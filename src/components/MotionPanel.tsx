import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Star, Trash2 } from 'lucide-react';
import type { AnimationMode, LayerAnimation, LoopAnimation, MotionPreset, PresetCategory, TextLayer } from '../types/motion';
import { defaultLoop, loopKinds, loopLabels, loopHints } from '../engine/loopMotion';
import { overridesFor } from '../remotion/defaults';

// La vista previa real de cada efecto se baja recién cuando se abre.
const MotionPreview = lazy(() => import('./MotionPreview').then((module) => ({ default: module.MotionPreview })));

type Props = {
  presets: MotionPreset[];
  animation: LayerAnimation;
  favorites: string[];
  mode: AnimationMode;
  sampleWord: string;
  layer: TextLayer;
  onChooseIn: (preset: MotionPreset | null) => void;
  onChangeAnimation: (animation: LayerAnimation) => void;
  onMode: (mode: AnimationMode) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onLoop: (loop: LoopAnimation | null) => void;
};

/**
 * Los presets se llaman en inglés dentro del motor porque el id es el contrato
 * con los proyectos guardados. Acá se muestran por lo que hacen.
 */
const spanishNames: Record<string, string> = {
  'depth-punch': 'Golpe de profundidad',
  'camera-slam': 'Golpe de cámara',
  'elastic-pop': 'Rebote elástico',
  'hard-zoom': 'Zoom seco',
  'diagonal-hit': 'Golpe diagonal',
  'blur-reveal': 'Sale del desenfoque',
  'perspective-zoom': 'Zoom en perspectiva',
  'bottom-punch': 'Sube de abajo',
  'word-cascade': 'Palabras en cascada',
  'letter-impact': 'Letra por letra',
  'side-swipe': 'Entra de costado',
  'hero-word': 'Palabra protagonista',
  'word-rain': 'Lluvia de palabras',
  'word-sphere': 'Círculo de palabras',
  'random-riot': 'Aparición aleatoria',
  'orbit-slam': 'Entrada circular',
  'glitch-crush': 'Glitch',
  'meteor-drop': 'Caída de meteorito',
  'letter-storm': 'Palabras dispersas',
  'epic-rise': 'Ascenso épico',
  typewriter: 'Máquina de escribir',
  'typewriter-clean': 'Tecleo sin cursor',
  'typewriter-soft': 'Tecleo suave',
  'word-type': 'Palabra por palabra',
  'line-reveal': 'Línea por línea',
  'fade-in': 'Aparecer',
  'soft-rise': 'Subida suave',
  'letter-fade': 'Letras encadenadas',
  'pop-in': 'Pop',
  'bounce-in': 'Rebote',
  'stretch-in': 'Estirar',
  'flip-in': 'Voltear',
  'roll-in': 'Rodar',
  'shake-in': 'Entrada temblorosa',
  'wave-in': 'Ola de palabras',
  'spring-drop': 'Caída con resorte',
  'fade-out': 'Desvanecer',
  'zoom-out': 'Alejarse',
  'slide-out-down': 'Salir por abajo',
  'word-erase': 'Borrar palabras',
  'glitch-out': 'Corte de señal',
};

const categoryLabels: Record<PresetCategory | 'ALL' | 'FAV', string> = {
  ALL: 'Todos', FAV: 'Favoritos', REVEAL: 'Aparecer', IMPACT: 'Impacto', ZOOM: 'Zoom',
  SLIDE: 'Deslizar', BLUR: 'Desenfoque', '3D': '3D', WORDS: 'Palabras', LETTERS: 'Letras',
  EPIC: 'Épicos',
};

const displayName = (preset: MotionPreset) => preset.custom ? preset.name : spanishNames[preset.id] ?? preset.name;

const SECONDS = 30;
const toSeconds = (frames: number) => Math.round(frames / SECONDS * 10) / 10;
const toFrames = (seconds: number) => Math.max(1, Math.round(seconds * SECONDS));

const modeLabels: { id: AnimationMode; label: string }[] = [
  { id: 'text', label: 'Todo junto' },
  { id: 'words', label: 'Palabra' },
  { id: 'letters', label: 'Letra' },
  { id: 'lines', label: 'Línea' },
];

/** Control de tiempo en segundos. Nadie piensa un subtítulo en cuadros. */
const TimeField = ({ label, seconds, min, max, onChange }: {
  label: string; seconds: number; min: number; max: number; onChange: (seconds: number) => void;
}) => (
  <label className="time-field">
    <span>{label}</span>
    <input type="range" min={min} max={max} step={0.1} value={seconds} aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))} />
    <output>{seconds.toFixed(1)} s</output>
  </label>
);

export const MotionPanel = ({
  presets, animation, favorites, mode, sampleWord, layer,
  onChooseIn, onChangeAnimation, onMode, onFavorite, onDelete, onLoop,
}: Props) => {
  const [track, setTrack] = useState<'in' | 'out' | 'loop'>('in');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startPreview = (id: string) => { clearTimeout(previewTimer.current); previewTimer.current = setTimeout(() => setPreviewId(id), 180); };
  const stopPreview = () => { clearTimeout(previewTimer.current); setPreviewId(null); };
  useEffect(() => () => clearTimeout(previewTimer.current), []);
  const [category, setCategory] = useState<PresetCategory | 'ALL' | 'FAV'>('ALL');
  const [query, setQuery] = useState('');

  const categories = useMemo(() => {
    const present = new Set(presets.map((item) => item.category));
    return (['ALL', 'FAV', 'REVEAL', 'IMPACT', 'ZOOM', 'SLIDE', 'WORDS', 'LETTERS', '3D', 'BLUR', 'EPIC'] as const)
      .filter((id) => id === 'ALL' || id === 'FAV' || present.has(id));
  }, [presets]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    const matches = presets.filter((item) => {
      if (category === 'FAV' && !favorites.includes(item.id)) return false;
      if (category !== 'ALL' && category !== 'FAV' && item.category !== category) return false;
      return !needle || displayName(item).toLocaleLowerCase('es').includes(needle);
    });
    // En la pista de entrada no tiene sentido ofrecer los que están hechos
    // para salir. En la de salida sirven todos, pero los diseñados para salir
    // van primero: el resto el motor los reproduce al revés.
    if (track === 'in') return matches.filter((item) => item.intent !== 'out');
    return [...matches].sort((left, right) => Number(right.intent === 'out') - Number(left.intent === 'out'));
  }, [category, favorites, presets, query, track]);

  const loop = animation.loop ?? null;
  const inPreset = animation.in?.preset ?? null;
  const inSeconds = toSeconds(animation.in?.overrides.duration ?? 18);
  const holdSeconds = toSeconds(animation.holdFrames);
  const outSeconds = toSeconds(animation.out?.overrides.duration ?? 18);

  const setInDuration = (seconds: number) => {
    if (!animation.in) return;
    onChangeAnimation({ ...animation, in: { ...animation.in, overrides: { ...animation.in.overrides, duration: toFrames(seconds) } } });
  };
  const setOutDuration = (seconds: number) => {
    if (!animation.out) return;
    onChangeAnimation({ ...animation, out: { ...animation.out, overrides: { ...animation.out.overrides, duration: toFrames(seconds) } } });
  };
  const setOutPreset = (id: string) => {
    if (id === 'none') { onChangeAnimation({ ...animation, out: null }); return; }
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    onChangeAnimation({ ...animation, out: { preset, overrides: overridesFor(preset) } });
  };

  const chosen = track === 'in' ? inPreset : animation.out?.preset ?? null;
  const choose = (preset: MotionPreset | null) => (track === 'in' ? onChooseIn(preset) : setOutPreset(preset?.id ?? 'none'));

  return (
    <div className="motion-panel">
      <div className="segmented track-tabs" role="tablist" aria-label="Pista de animación">
        <button type="button" role="tab" aria-selected={track === 'in'} className={track === 'in' ? 'on' : ''} onClick={() => setTrack('in')}>
          Entrada{inPreset && <i className="track-dot" aria-hidden="true" />}
        </button>
        <button type="button" role="tab" aria-selected={track === 'out'} className={track === 'out' ? 'on' : ''} onClick={() => setTrack('out')}>
          Salida{animation.out && <i className="track-dot" aria-hidden="true" />}
        </button>
        <button type="button" role="tab" aria-selected={track === 'loop'} className={track === 'loop' ? 'on' : ''} onClick={() => setTrack('loop')}>Bucle{loop && <i className="track-dot" />}</button>
      </div>

      {track !== 'loop' && <>
      <div className="gallery-tools">
        <label className="search">
          <Search size={14} aria-hidden="true" />
          <input type="search" value={query} placeholder="Buscar un efecto…" aria-label="Buscar un efecto" onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="chips" role="tablist" aria-label="Tipos de efecto">
        {categories.map((id) => (
          <button type="button" role="tab" key={id} aria-selected={category === id} className={category === id ? 'on' : ''} onClick={() => setCategory(id)}>
            {categoryLabels[id]}
          </button>
        ))}
      </div>

      <div className="gallery-grid motion-grid">
        <div className={`motion-card ${!chosen ? 'on' : ''}`}>
          <button type="button" className="motion-card-frame" aria-pressed={!chosen} onClick={() => choose(null)}>
            <span className="motion-sample">{sampleWord}</span>
          </button>
          <span className="style-card-name">{track === 'in' ? 'Sin animación' : 'Se queda hasta el final'}</span>
        </div>
        {visible.map((preset) => {
          const selected = chosen?.id === preset.id;
          const isFavorite = favorites.includes(preset.id);
          // En la pista de salida, los que no fueron diseñados para salir se
          // reproducen al revés. Conviene decirlo antes de que se aplique.
          const reversed = track === 'out' && preset.intent !== 'out';
          return (
            <div className={`motion-card ${selected ? 'on' : ''}`} key={preset.id}>
              <button
                type="button"
                className="motion-card-frame"
                aria-label={`Aplicar ${displayName(preset)}`}
                onMouseEnter={() => startPreview(preset.id)} onMouseLeave={stopPreview}
                onFocus={() => startPreview(preset.id)} onBlur={stopPreview}
                aria-pressed={selected}
                title={reversed ? `${preset.description} (se reproduce al revés)` : preset.description}
                onClick={() => choose(preset)}
              >
                <span className="motion-sample">{sampleWord}</span>
                {previewId === preset.id && <Suspense fallback={null}><MotionPreview preset={preset} layer={layer} track={track} /></Suspense>}
                {reversed && <em className="motion-tag">al revés</em>}
                {track === 'out' && preset.intent === 'out' && <em className="motion-tag go">salida</em>}
              </button>
              <span className="style-card-name">{displayName(preset)}</span>
              <button
                type="button"
                className={`motion-fav ${isFavorite ? 'on' : ''}`}
                aria-label={`${isFavorite ? 'Quitar de' : 'Agregar a'} favoritos: ${displayName(preset)}`}
                aria-pressed={isFavorite}
                onClick={() => onFavorite(preset.id)}
              >
                <Star size={11} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
              {preset.custom && (
                <button type="button" className="style-card-delete" aria-label={`Borrar ${preset.name}`} onClick={() => onDelete(preset.id)}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="empty">No hay efectos con ese filtro.</p>}
      </div>

      </>}
      <div className="panel-block">
        <h3>Tiempos</h3>
        <p className="hint">El texto entra, se queda quieto para poder leerlo, y sale.</p>
        {track === 'in' && animation.in && <TimeField label="Tarda en entrar" seconds={inSeconds} min={0.1} max={3} onChange={setInDuration} />}
        {track === 'out' && animation.out && <TimeField label="Tarda en salir" seconds={outSeconds} min={0.1} max={3} onChange={setOutDuration} />}
        <TimeField label="Se queda" seconds={holdSeconds} min={0} max={8}
          onChange={(seconds) => onChangeAnimation({ ...animation, holdFrames: Math.round(seconds * SECONDS) })} />
      </div>

      {track === 'loop' && <div className="panel-block">
        <h3>Bucle</h3>
        <p className="hint">{loop ? loopHints[loop.kind] : loopHints.none}</p>
        <div className="loop-grid" role="group" aria-label="Movimiento en bucle">
          {loopKinds.map((kind) => {
            const active = (loop?.kind ?? 'none') === kind;
            return (
              <button
                type="button"
                key={kind}
                className={`loop-chip ${active ? 'on' : ''}`}
                aria-pressed={active}
                title={loopHints[kind]}
                onClick={() => onLoop(kind === 'none' ? null : defaultLoop(kind))}
              >
                {loopLabels[kind]}
              </button>
            );
          })}
        </div>
        {loop && loop.kind !== 'none' && (
          <>
            <label className="time-field">
              <span>Velocidad</span>
              <input type="range" min={0.2} max={3} step={0.1} value={loop.speed} aria-label="Velocidad del bucle"
                onChange={(event) => onLoop({ ...loop, speed: Number(event.target.value) })} />
              <output>{loop.speed.toFixed(1)}×</output>
            </label>
            <label className="time-field">
              <span>Intensidad</span>
              <input type="range" min={0.2} max={2} step={0.1} value={loop.intensity} aria-label="Intensidad del bucle"
                onChange={(event) => onLoop({ ...loop, intensity: Number(event.target.value) })} />
              <output>{Math.round(loop.intensity * 100)}%</output>
            </label>
            <label className="toggle-row">
              <span>
                <strong>Desfasar por palabra</strong>
                <small>Cada palabra se mueve un instante después que la anterior.</small>
              </span>
              <input type="checkbox" checked={loop.perUnit} aria-label="Desfasar por palabra"
                onChange={(event) => onLoop({ ...loop, perUnit: event.target.checked })} />
            </label>
          </>
        )}
      </div>}

      <div className="panel-block">
        <h3>Cómo se anima</h3>
        <p className="hint">Todo junto es lo más legible. Palabra por palabra es el subtítulo hablado.</p>
        <div className="segmented" role="group" aria-label="Cómo se anima el texto">
          {modeLabels.map((item) => (
            <button type="button" key={item.id} className={mode === item.id ? 'on' : ''} aria-pressed={mode === item.id} onClick={() => onMode(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
