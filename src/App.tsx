import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  Captions, Check, Clapperboard, Download, Film, FolderOpen, HardDriveDownload, Palette, Pause, Play, Redo2, RotateCcw, Save, Sliders, Type, Undo2, Volume2, VolumeX, Zap,
} from 'lucide-react';
import { WordTimingPanel } from './components/WordTimingPanel';
import { alignLayers, distributeLayers } from './engine/editorMotion';
import { builtInComboPresets } from './presets/combos';
import { StyleGallery } from './components/StyleGallery';
import { StyleTuner } from './components/StyleTuner';
import { MotionPanel } from './components/MotionPanel';
import { TextPanel } from './components/TextPanel';
import { OutputPanel } from './components/OutputPanel';
import { GuidePanel } from './components/GuidePanel';
import { AutoCaptionsPanel } from './components/AutoCaptionsPanel';
import { SubtitlesPanel } from './components/SubtitlesPanel';
import { EmptyState } from './components/EmptyState';
import { SafeZoneOverlay, safeZoneLabels, type SafeZone } from './components/SafeZoneOverlay';
import { CanvasOverlay } from './components/CanvasOverlay';
import { TimelineDock } from './components/TimelineDock';
import type { SavePresetKind } from './components/SavePresetModal';
import { TextComposition } from './remotion/TextComposition';
import { formats, overridesFor } from './remotion/defaults';
import { builtInPresets, defaultPreset } from './presets/builtins';
import { builtInStylePresets } from './presets/styles';
import { resolvePreset } from './engine/resolvePreset';
import { animationForLayer } from './engine/layerAnimation';
import { cloneAnimation, cloneLayer, MAX_LAYERS } from './utils/editor';
import { getCompositionDuration } from './utils/duration';
import { loadCustomComboPresets, loadCustomPresets, loadCustomStylePresets, loadFavorites, saveCustomComboPresets, saveCustomPresets, saveCustomStylePresets, saveFavorites } from './utils/storage';
import { loadProject, parseProjectFile } from './utils/project';
import { useGuide } from './hooks/useGuide';
import { useExport } from './hooks/useExport';
import { createLayerId, useProject, withText } from './hooks/useProject';
import type { AnimationMode, ComboPreset, CompositionProps, KeywordStyle, MotionPreset } from './types/motion';

// Los paneles pesados o poco usados se bajan recién cuando se abren.
const LibraryPanel = lazy(() => import('./components/LibraryPanel').then((module) => ({ default: module.LibraryPanel })));
const SavePresetModal = lazy(() => import('./components/SavePresetModal').then((module) => ({ default: module.SavePresetModal })));
const KeyframePanel = lazy(() => import('./components/KeyframePanel').then((module) => ({ default: module.KeyframePanel })));

type Tool = 'video' | 'subtitulos' | 'texto' | 'estilo' | 'movimiento' | 'salida';

/** El orden de la columna sigue el flujo: subir, subtitular, retocar, estilizar, animar, exportar. */
const tools: { id: Tool; label: string; Icon: typeof Palette; title: string }[] = [
  { id: 'video', label: 'Video', Icon: Clapperboard, title: 'Subir tu video y generar los subtítulos con IA' },
  { id: 'subtitulos', label: 'Subtítulos', Icon: Captions, title: 'El guion: corregir, buscar y reemplazar' },
  { id: 'texto', label: 'Texto', Icon: Type, title: 'Qué dice y dónde va' },
  { id: 'estilo', label: 'Estilo', Icon: Palette, title: 'Cómo se ve la letra' },
  { id: 'movimiento', label: 'Efectos', Icon: Zap, title: 'Cómo entra y sale' },
  { id: 'salida', label: 'Exportar', Icon: Download, title: 'Tamaño, fondo y descarga' },
];

const panelTitles: Record<Tool, { title: string; hint: string }> = {
  video: { title: 'Video', hint: 'Subilo una vez: queda guardado para calzar y exportar tus subtítulos.' },
  subtitulos: { title: 'Subtítulos', hint: 'Todo lo que dice tu video, en orden. Corregí, uní o reemplazá.' },
  texto: { title: 'Texto', hint: 'Qué dice, con qué letra y dónde se ubica.' },
  estilo: { title: 'Estilo del subtítulo', hint: 'Elegí un look. Se aplica a la frase seleccionada.' },
  movimiento: { title: 'Efectos', hint: 'Cómo aparece, cuánto se queda y cómo se va.' },
  salida: { title: 'Exportar', hint: 'Formato, fondo y descarga del video.' },
};

export default function App() {
  const [restored] = useState(loadProject);
  const [tool, setTool] = useState<Tool>('texto');
  const [hint, setHint] = useState('');
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashHint = (message: string) => {
    setHint(message);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 3600);
  };

  const playerRef = useRef<PlayerRef>(null);
  const seekTargetFrame = useRef<number | null>(null);
  const projectFileInput = useRef<HTMLInputElement>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  const [currentFrame, setCurrentFrame] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [safeZone, setSafeZone] = useState<SafeZone>('none');
  const [panelWidth, setPanelWidth] = useState(360);
  const [timelineHeight, setTimelineHeight] = useState(220);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveKind, setSaveKind] = useState<SavePresetKind | null>(null);
  const [advanced, setAdvanced] = useState(() => {
    try { return localStorage.getItem('gb-motion:interface-mode') === 'advanced'; } catch { return false; }
  });
  const [customPresets, setCustomPresets] = useState<MotionPreset[]>(loadCustomPresets);
  const [customStylePresets, setCustomStylePresets] = useState(loadCustomStylePresets);
  const [customCombos, setCustomCombos] = useState<ComboPreset[]>(loadCustomComboPresets);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [appearanceClipboard, setAppearanceClipboard] = useState<ReturnType<typeof cloneLayer> | null>(null);

  const stageViewport = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 640, height: 480 });
  useEffect(() => {
    const element = stageViewport.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element); return () => observer.disconnect();
  }, []);

  const guideApi = useGuide({ initialMediaId: restored?.guideMediaId, initialName: restored?.guideName, flashHint });
  const { guide, setGuide, guideName, guideMediaId, guideUpload, pickGuide, removeGuide, relinkGuide } = guideApi;

  // `useExport` se arma después del proyecto (necesita las frases); este puente le avisa de cada edición.
  const editedRef = useRef(() => {});
  const project = useProject({
    restored, guideName, guideMediaId, flashHint,
    onEdited: () => editedRef.current(),
    onProjectReplaced: () => {
      seekTargetFrame.current = null; removeGuide();
      playerRef.current?.seekTo(0); setCurrentFrame(0);
    },
    onRelink: (mediaId, name) => void relinkGuide(mediaId, name),
    onGuideName: guideApi.setGuideName,
    onLayerAdded: () => setTool('texto'),
  });
  const {
    layers, setLayers, activeLayer, selectedIds, selected, selectLayer, projectName, setProjectName, background, setBackground, customBackground, setCustomBackground,
    formatId, setFormatId, format, projectSaved, historyStatus, layerClipboard, recordHistory, updateLayer, updateActive, undo, redo,
  } = project;
  const activeAnimation = animationForLayer(activeLayer);

  const inputProps: CompositionProps = { layers, background, customBackground, guide };
  const exportApi = useExport({ inputProps, background, format, guideMediaId, guideName: guide?.name });
  editedRef.current = exportApi.resetExportState;
  const { exportState, pastExports, exportVolume, setExportVolume, exportVideo, cancelExport } = exportApi;

  const presets = useMemo(() => [...builtInPresets, ...customPresets], [customPresets]);
  const stylePresets = useMemo(() => [...builtInStylePresets, ...customStylePresets], [customStylePresets]);
  // Con un video cargado la línea de tiempo tiene que cubrirlo entero, aunque
  // los subtítulos todavía no lleguen hasta el final.
  const duration = Math.max(getCompositionDuration(layers), guide?.durationInFrames ?? 0);

  // Cada herramienta arranca desde arriba: sin esto, entrar a «Exportar» después
  // de scrollear la galería deja el panel a mitad de camino.
  useEffect(() => { if (panelBody.current) panelBody.current.scrollTop = 0; }, [tool]);
  useEffect(() => saveFavorites(favorites), [favorites]);
  useEffect(() => saveCustomPresets(customPresets), [customPresets]);
  useEffect(() => saveCustomStylePresets(customStylePresets), [customStylePresets]);
  useEffect(() => saveCustomComboPresets(customCombos), [customCombos]);
  useEffect(() => {
    try { localStorage.setItem('gb-motion:interface-mode', advanced ? 'advanced' : 'simple'); } catch { /* la sesión sigue siendo usable */ }
  }, [advanced]);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const updateFrame = (event: { detail: { frame: number } }) => {
      if (seekTargetFrame.current !== null && event.detail.frame !== seekTargetFrame.current) return;
      seekTargetFrame.current = null;
      setCurrentFrame(event.detail.frame);
    };
    const onPlay = () => setPlaying(true); const onPause = () => setPlaying(false);
    player.addEventListener('frameupdate', updateFrame); player.addEventListener('play', onPlay); player.addEventListener('pause', onPause);
    return () => { player.removeEventListener('frameupdate', updateFrame); player.removeEventListener('play', onPlay); player.removeEventListener('pause', onPause); };
  }, [duration]);
  useEffect(() => {
    if (currentFrame < duration) return;
    const next = Math.max(0, duration - 1);
    playerRef.current?.seekTo(next);
    setCurrentFrame(next);
  }, [currentFrame, duration]);

  // El menú «Proyecto» se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!(event.target instanceof Element && event.target.closest('.project-menu'))) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);

  const seek = (frame: number) => { const target = Math.max(0, Math.min(duration - 1, frame)); seekTargetFrame.current = target; playerRef.current?.pause(); playerRef.current?.seekTo(target); setCurrentFrame(target); };

  const chooseInPreset = (next: MotionPreset | null) => {
    if (next && next.intent === 'out') {
      const outOverrides = overridesFor(next);
      updateActive((layer) => {
        const animation = animationForLayer(layer);
        const entry = animation.in ?? { preset: defaultPreset, overrides: overridesFor(defaultPreset) };
        return { ...layer, preset: entry.preset, overrides: entry.overrides, animation: { ...animation, in: entry, out: { preset: next, overrides: { ...outOverrides } } } };
      });
      flashHint(`"${next.name}" es un efecto de salida: se aplicó al final de la frase.`);
      return;
    }
    updateActive((layer) => {
      const animation = animationForLayer(layer);
      if (!next) return { ...layer, animation: { ...animation, in: null } };
      // El modo lo impone el preset: "Máquina de escribir" no es máquina de
      // escribir si se anima todo junto, y "Palabra por palabra" tampoco.
      // Después la persona puede cambiarlo desde «Cómo se anima».
      const overrides = overridesFor(next);
      return { ...layer, preset: next, overrides, animation: { ...animation, in: { preset: next, overrides: { ...overrides } } } };
    });
  };

  /** El modo vive en los overrides y tiene que quedar igual en entrada y salida. */
  const setAnimationMode = (mode: AnimationMode) => updateActive((layer) => {
    const animation = animationForLayer(layer);
    const overrides = { ...layer.overrides, mode };
    return {
      ...layer,
      overrides,
      animation: {
        ...animation,
        in: animation.in ? { ...animation.in, overrides: { ...animation.in.overrides, mode } } : null,
        out: animation.out ? { ...animation.out, overrides: { ...animation.out.overrides, mode } } : null,
      },
    };
  });

  const resetProject = () => { if (project.reset()) setShowEmpty(true); };

  const applyAutoCaptions = (created: Parameters<typeof project.applyAutoCaptions>[0], mode: 'replace' | 'append') => {
    const problem = project.applyAutoCaptions(created, mode);
    if (!problem) setShowEmpty(false);
    return problem;
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (document.querySelector('[role="dialog"]')) return;
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      // Espacio: reproducir o pausar, salvo que el foco esté en algo que ya usa Espacio.
      if (!modifier && (event.code === 'Space' || event.key === ' ')) {
        if (target instanceof HTMLElement && target.closest('button, a, summary, [role="button"], [role="slider"]')) return;
        event.preventDefault();
        if (playerRef.current?.isPlaying()) playerRef.current.pause(); else playerRef.current?.play();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'c') { event.preventDefault(); layerClipboard.current = cloneLayer(activeLayer); }
      if (modifier && event.key.toLowerCase() === 'v' && layerClipboard.current && layers.length < MAX_LAYERS) {
        event.preventDefault();
        recordHistory();
        const next = cloneLayer(layerClipboard.current);
        next.id = createLayerId(); next.name = `${next.name} copia`; next.startFrame = (next.startFrame ?? 0) + 15;
        setLayers((current) => [...current, next]); project.setActiveLayerId(next.id);
      }
      if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); project.duplicateLayer(activeLayer.id); }
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (event.key === 'Delete' && layers.length > 1 && !activeLayer.locked) { event.preventDefault(); project.deleteLayer(activeLayer.id); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const savePreset = (name: string, kind: SavePresetKind) => {
    const timestamp = Date.now();
    if (kind === 'style') {
      setCustomStylePresets((current) => [...current, {
        id: `custom-style-${timestamp}`,
        name,
        description: 'Estilo guardado por vos.',
        category: 'mios',
        sample: activeLayer.text.split(/\s+/).slice(0, 3).join(' '),
        typography: { ...activeLayer.typography },
        custom: true,
      }]);
      setSaveKind(null);
      flashHint(`Guardado en «Mis estilos» como "${name}".`);
      return;
    }
    if (kind === 'combo') {
      setCustomCombos((current) => [...current, {
        id: `custom-combo-${timestamp}`,
        name,
        description: 'Combinación guardada por vos.',
        typography: structuredClone(activeLayer.typography),
        animation: cloneAnimation(activeAnimation),
        custom: true,
      }]);
      setSaveKind(null);
      flashHint(`Guardado en «Combinaciones» como "${name}".`);
      return;
    }
    const source = activeAnimation.in ?? { preset: activeLayer.preset, overrides: activeLayer.overrides };
    const saved: MotionPreset = { ...resolvePreset(source.preset, source.overrides), id: `custom-${timestamp}`, name, custom: true };
    const overrides = overridesFor(saved);
    setCustomPresets((current) => [...current, saved]);
    updateActive((layer) => ({ ...layer, preset: saved, overrides, animation: { ...animationForLayer(layer), in: { preset: saved, overrides } } }));
    setSaveKind(null);
  };

  const deleteMotionPreset = (id: string) => {
    setCustomPresets((current) => current.filter((item) => item.id !== id));
    setFavorites((current) => current.filter((item) => item !== id));
    setLayers((current) => current.map((layer) => {
      const animation = layer.animation;
      const inHit = animation?.in?.preset.id === id;
      const outHit = animation?.out?.preset.id === id;
      const presetHit = layer.preset.id === id;
      if (!inHit && !outHit && !presetHit) return layer;
      return {
        ...layer,
        preset: presetHit ? defaultPreset : layer.preset,
        overrides: presetHit ? overridesFor(defaultPreset) : layer.overrides,
        animation: animation ? {
          ...animation,
          in: inHit ? { preset: defaultPreset, overrides: overridesFor(defaultPreset) } : animation.in,
          out: outHit ? null : animation.out,
        } : animation,
      };
    }));
  };

  const sampleWord = activeLayer.text.trim().split(/\s+/)[0]?.slice(0, 9) || 'Aa';
  const stageWidth = Math.max(1, Math.min(stageSize.width - 32, (stageSize.height - 32) * format.width / format.height)) * canvasZoom;
  const stageHeight = Math.max(1, Math.min(stageSize.height - 32, (stageSize.width - 32) * format.height / format.width)) * canvasZoom;

  return (
    <div className="app" style={{ '--panel-width': `${panelWidth}px`, '--timeline-height': `${timelineHeight}px` } as React.CSSProperties} onPointerDownCapture={recordHistory} onFocusCapture={recordHistory}
      onKeyDownCapture={(event) => { if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) recordHistory(); }}>
      <header className="topbar">
        <span className="brand"><span className="brand-mark"><Film size={15} /></span>GB <b>MOTION</b></span>
        <div className="topbar-group">
          <div className="project-menu">
            <button type="button" className="ghost-button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Proyecto</button>
            {menuOpen && (
              <div className="project-menu-list" role="menu" aria-label="Proyecto">
                <button type="button" role="menuitem" title="Abrir un proyecto guardado" aria-label="Abrir proyecto" onClick={() => { setMenuOpen(false); projectFileInput.current?.click(); }}><FolderOpen size={14} /> Abrir proyecto</button>
                <button type="button" role="menuitem" title="Descargar este proyecto" aria-label="Descargar proyecto" onClick={() => { setMenuOpen(false); project.downloadProject(); }}><HardDriveDownload size={14} /> Descargar proyecto</button>
                <button type="button" role="menuitem" title="Empezar de nuevo" aria-label="Empezar de nuevo" onClick={() => { setMenuOpen(false); resetProject(); }}><RotateCcw size={14} /> Empezar de nuevo</button>
              </div>
            )}
          </div>
          <button type="button" className="icon-button" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!historyStatus.undo} onClick={undo}><Undo2 size={16} /></button>
          <button type="button" className="icon-button" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={!historyStatus.redo} onClick={redo}><Redo2 size={16} /></button>
          <input className="project-name" aria-label="Nombre del proyecto" value={projectName} maxLength={80} onChange={(event) => setProjectName(event.target.value)} />
          <span title={projectSaved === null ? 'No se pudo guardar. Descargá el proyecto como respaldo.' : 'Guardado en este navegador'} className={`saved ${projectSaved ? 'on' : ''}`}>{projectSaved ? <><Check size={12} /> Guardado</> : projectSaved === null ? 'Sin guardar' : 'Guardando…'}</span>
        </div>
        <div className="topbar-right">
          <button className="ghost-button" onClick={() => setLibraryOpen(true)}>Biblioteca</button>
          <button type="button" className={`icon-button ${advanced ? 'on' : ''}`} aria-pressed={advanced}
            title={advanced ? 'Ajustes finos activados' : 'Mostrar ajustes finos'} aria-label="Ajustes finos" onClick={() => setAdvanced((value) => !value)}>
            <Sliders size={15} />
          </button>
          {advanced && <button type="button" className="icon-button" title="Guardar en mi biblioteca" aria-label="Guardar en mi biblioteca" onClick={() => setSaveKind('motion')}><Save size={15} /></button>}
          <button type="button" className="button primary" disabled={exportState.status === 'rendering'} onClick={() => setTool('salida')}>
            <Play size={14} /> Exportar
          </button>
        </div>
      </header>

      <input ref={projectFileInput} type="file" accept="application/json,.json" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void project.openProjectFile(file);
        event.target.value = '';
      }} />

      <div className="workbench">
        <nav className="rail" aria-label="Qué querés cambiar">
          {tools.map(({ id, label, Icon, title }) => (
            <button type="button" key={id} className={tool === id ? 'on' : ''} aria-pressed={tool === id} title={title} onClick={() => setTool(id)}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <main className="stage">
          <div className="stage-toolbar">
            <button className="ghost-button" aria-label={playing ? 'Pausar' : 'Reproducir'} onClick={() => playing ? playerRef.current?.pause() : playerRef.current?.play()}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
            <button className="ghost-button" onClick={() => { const frame = activeLayer.startFrame; seekTargetFrame.current = frame; playerRef.current?.seekTo(frame); setCurrentFrame(frame); playerRef.current?.play(); }}>Ver entrada</button>
            <button className="ghost-button" aria-label={muted ? 'Activar audio' : 'Silenciar audio'} onClick={() => { if (muted) playerRef.current?.unmute(); else playerRef.current?.mute(); setMuted(!muted); }}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
            <label>Vista <select aria-label="Zoom del lienzo" value={canvasZoom} onChange={(e) => setCanvasZoom(Number(e.target.value))}><option value={1}>Ajustar</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
            <label>Zona segura <select aria-label="Zona segura" value={safeZone} onChange={(e) => setSafeZone(e.target.value as SafeZone)}>{(Object.keys(safeZoneLabels) as SafeZone[]).map((id) => <option key={id} value={id}>{safeZoneLabels[id]}</option>)}</select></label>
            <span className="stage-format">{format.width} × {format.height}</span>
          </div>
          <div className="stage-viewport" ref={stageViewport}>
            <div className={`stage-frame ratio-${format.id}`} style={{ width: stageWidth, height: stageHeight }}>
              <Player
                ref={playerRef}
                component={TextComposition}
                inputProps={inputProps}
                durationInFrames={duration}
                fps={30}
                compositionWidth={format.width}
                compositionHeight={format.height}
                controls={false}
                initialFrame={Math.min(30, duration - 1)}
                loop
                initiallyMuted
                acknowledgeRemotionLicense
                style={{ width: '100%', height: '100%' }}
              />
              <span className="safe-zone" aria-hidden="true" />
              <SafeZoneOverlay zone={safeZone} />
              <CanvasOverlay
                layers={layers}
                activeId={activeLayer.id}
                format={format}
                currentFrame={currentFrame}
                onEdit={(id) => { project.setActiveLayerId(id); setTool('texto'); setTimeout(() => panelBody.current?.querySelector('textarea.caption-input')?.scrollIntoView({ block: 'center' }), 0); setTimeout(() => (panelBody.current?.querySelector('textarea.caption-input') as HTMLTextAreaElement | null)?.focus(), 0); }}
                onSelect={selectLayer}
                onBeginInteraction={recordHistory}
                onChange={(id, patch) => updateLayer(id, (layer) => ({ ...layer, ...patch }))}
              />
            </div>
            {showEmpty && !guide && (
              <EmptyState
                onPickVideo={(file) => { setShowEmpty(false); setTool('video'); void pickGuide(file); }}
                onWriteByHand={() => { setShowEmpty(false); setTool('texto'); }}
              />
            )}
          </div>
        </main>

        <aside className="panel" aria-label={panelTitles[tool].title}>
          <header className="panel-head">
            <h2>{panelTitles[tool].title}</h2>
            <p>{panelTitles[tool].hint}</p>
            {selected.length > 1 && <div className="selection-tools"><strong>{selected.length} frases seleccionadas</strong><div className="appearance-actions">
              <button className="ghost-button tiny" onClick={() => setLayers((all) => alignLayers(all, selectedIds, 'x', activeLayer.positionX))}>Alinear X</button>
              <button className="ghost-button tiny" onClick={() => setLayers((all) => alignLayers(all, selectedIds, 'y', activeLayer.positionY))}>Alinear Y</button>
              <button className="ghost-button tiny" disabled={selected.length < 3} onClick={() => setLayers((all) => distributeLayers(all, selectedIds, 'x'))}>Distribuir X</button>
              <button className="ghost-button tiny" disabled={selected.length < 3} onClick={() => setLayers((all) => distributeLayers(all, selectedIds, 'y'))}>Distribuir Y</button>
              <button className="ghost-button tiny" onClick={() => setLayers((all) => all.map((l) => selectedIds.includes(l.id) && !l.locked ? { ...l, typography: { ...structuredClone(activeLayer.typography), fontSize: l.typography.fontSize } } : l))}>Mismo look</button>
            </div></div>}
            {(tool === 'texto' || tool === 'estilo' || tool === 'movimiento') && <div className="appearance-actions">
              <button className="ghost-button tiny" onClick={() => { setAppearanceClipboard(cloneLayer(activeLayer)); flashHint('Look y movimiento copiados. Elegí otra frase para pegarlos.'); }}>Copiar ajustes</button>
              {appearanceClipboard && <><button className="ghost-button tiny" disabled={activeLayer.locked} onClick={() => updateActive((l) => ({ ...l, typography: { ...structuredClone(appearanceClipboard.typography), fontSize: l.typography.fontSize } }))}>Pegar look</button>
              <button className="ghost-button tiny" disabled={activeLayer.locked} onClick={() => updateActive((l) => ({ ...l, animation: cloneAnimation(animationForLayer(appearanceClipboard)), preset: structuredClone(appearanceClipboard.preset), overrides: { ...appearanceClipboard.overrides } }))}>Pegar movimiento</button></>}
            </div>}
            <details className="workspace-options"><summary>Acomodar paneles</summary><label>Ancho del panel<input aria-label="Ancho del panel" type="range" min={300} max={520} value={panelWidth} onChange={(e) => setPanelWidth(Number(e.target.value))} /></label><label>Alto del timeline<input aria-label="Alto de la línea de tiempo" type="range" min={180} max={360} value={timelineHeight} onChange={(e) => setTimelineHeight(Number(e.target.value))} /></label></details>
          </header>
          <div className="panel-body" ref={panelBody}>
            {tool === 'video' && (
              <>
                <GuidePanel
                  guide={guide}
                  upload={guideUpload}
                  expectedName={guideName}
                  formatLabel={format.label}
                  onPick={(file) => void pickGuide(file)}
                  onVolume={(volume) => setGuide((current) => current ? { ...current, volume } : current)}
                  onRemove={removeGuide}
                />
                <AutoCaptionsPanel mediaId={guideMediaId} templateLayer={activeLayer} createId={createLayerId} onApply={applyAutoCaptions} />
              </>
            )}
            {tool === 'subtitulos' && (
              <SubtitlesPanel
                layers={layers}
                activeId={activeLayer.id}
                currentFrame={currentFrame}
                onSeek={seek}
                onSelect={(id) => selectLayer(id)}
                onText={(id, text) => updateLayer(id, (layer) => layer.locked ? layer : withText(layer, text))}
                onMerge={project.mergeWithNext}
                onDelete={project.deleteLayer}
                countMatches={project.countMatches}
                onReplaceAll={project.replaceInAll}
                onImport={project.importCaptions}
                onExport={project.downloadCaptions}
                flashHint={flashHint}
              />
            )}
            {tool === 'texto' && (
              <>
                <WordTimingPanel layer={activeLayer} frame={currentFrame} onSeek={seek} onChange={(wordTiming) => updateActive((l) => ({ ...l, wordTiming }))} />
                <TextPanel
                  key={activeLayer.id}
                  text={activeLayer.text}
                  typography={activeLayer.typography}
                  keywords={activeLayer.keywords}
                  positionX={activeLayer.positionX}
                  positionY={activeLayer.positionY}
                  onText={(text) => updateActive((layer) => withText(layer, text))}
                  onTypography={(patch) => updateActive((layer) => ({ ...layer, typography: { ...layer.typography, ...patch } }))}
                  onPosition={(patch) => updateActive((layer) => ({ ...layer, ...patch }))}
                  onKeyword={(index) => updateActive((layer) => layer.keywords[index] ? layer : ({
                    ...layer,
                    keywords: { ...layer.keywords, [index]: { word: layer.text.split(/\s+/).filter(Boolean)[index], color: '#FFE94A', fontSizeScale: 1.06, fontWeight: 900 } },
                  }))}
                  onKeywordStyle={(index, patch) => updateActive((layer) => ({ ...layer, keywords: { ...layer.keywords, [index]: { ...layer.keywords[index], ...patch } as KeywordStyle } }))}
                  onKeywordRemove={(index) => updateActive((layer) => { const keywords = { ...layer.keywords }; delete keywords[index]; return { ...layer, keywords }; })}
                />
              </>
            )}
            {tool === 'estilo' && (
              <>
                <details className="tuner template-picker"><summary>Combinaciones listas para usar</summary><div className="tuner-block template-list">
                  {[...builtInComboPresets, ...customCombos].map((combo) => <span className="combo-item" key={combo.id}>
                    <button className="ghost-button" title={combo.description} onClick={() => updateActive((l) => ({ ...l, typography: structuredClone(combo.typography), animation: cloneAnimation(combo.animation), preset: combo.animation.in?.preset ?? l.preset, overrides: combo.animation.in?.overrides ?? l.overrides }))}>{combo.name}</button>
                    {combo.custom && <button className="ghost-button tiny" aria-label={`Borrar la combinación ${combo.name}`} title="Borrar esta combinación" onClick={() => setCustomCombos((current) => current.filter((item) => item.id !== combo.id))}>×</button>}
                  </span>)}
                </div></details>
                <div className="control-row">
                  <button className="ghost-button" onClick={project.applyStyleToAll}>Aplicar look a todas</button>
                  <button className="ghost-button" title="Copia el look, los efectos de entrada, salida y bucle y el resaltado de esta frase a todas las demás" onClick={project.applyTemplateToAll}>Aplicar plantilla a todos</button>
                </div>
                <StyleGallery
                  styles={stylePresets}
                  typography={activeLayer.typography}
                  text={activeLayer.text}
                  onApply={(typography) => { recordHistory(); updateActive((layer) => ({ ...layer, typography: { ...typography } })); }}
                  onSaveCurrent={() => setSaveKind('style')}
                  onDelete={(id) => setCustomStylePresets((current) => current.filter((item) => item.id !== id))}
                />
                <StyleTuner
                  key={activeLayer.id}
                  typography={activeLayer.typography}
                  onChange={(patch) => updateActive((layer) => ({ ...layer, typography: { ...layer.typography, ...patch } }))}
                />
              </>
            )}
            {tool === 'movimiento' && (
              <>
                <MotionPanel
                  presets={presets}
                  animation={activeAnimation}
                  favorites={favorites}
                  mode={activeLayer.overrides.mode}
                  sampleWord={sampleWord}
                  layer={activeLayer}
                  onChooseIn={chooseInPreset}
                  onChangeAnimation={(animation) => updateActive((layer) => animation.in
                    ? { ...layer, animation, preset: animation.in.preset, overrides: animation.in.overrides }
                    : { ...layer, animation })}
                  onMode={setAnimationMode}
                  onFavorite={(id) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                  onDelete={deleteMotionPreset}
                  onLoop={(loop) => updateActive((layer) => ({ ...layer, animation: { ...animationForLayer(layer), loop } }))}
                />
                {advanced && <Suspense fallback={null}><KeyframePanel layer={activeLayer} frame={currentFrame} onSeek={seek} onChange={(transformKeys) => updateActive((l) => ({ ...l, transformKeys }))} /></Suspense>}
              </>
            )}
            {tool === 'salida' && (
              <OutputPanel
                formats={formats}
                formatId={formatId}
                background={background}
                customBackground={customBackground}
                exportState={exportState}
                pastExports={pastExports}
                advanced={advanced}
                hasMedia={Boolean(guideMediaId)}
                audioVolume={exportVolume}
                onAudioVolume={setExportVolume}
                onFormat={setFormatId}
                onBackground={setBackground}
                onCustomBackground={setCustomBackground}
                onExport={exportVideo}
                onCancel={cancelExport}
              />
            )}
          </div>
        </aside>
      </div>

      <TimelineDock
        layers={layers}
        activeId={activeLayer.id}
        duration={duration}
        currentFrame={currentFrame}
        selectedIds={selectedIds}
        onSplit={() => project.splitLayer(currentFrame)}
        waveform={guide?.waveform}
        guideDuration={guide?.durationInFrames}
        canAdd={layers.length < MAX_LAYERS}
        onSeek={(frame) => { seekTargetFrame.current = frame; playerRef.current?.pause(); playerRef.current?.seekTo(frame); setCurrentFrame(frame); }}
        onSelect={selectLayer}
        onChange={(id, patch) => updateLayer(id, (layer) => ({ ...layer, ...patch }))}
        onBeginInteraction={recordHistory}
        onAdd={project.addLayer}
        onDuplicate={project.duplicateLayer}
        onDelete={project.deleteLayer}
        onToggleVisible={(id) => updateLayer(id, (layer) => ({ ...layer, visible: !layer.visible }))}
        onToggleLock={(id) => updateLayer(id, (layer) => ({ ...layer, locked: !layer.locked }))}
      />

      <Suspense fallback={null}>
        {libraryOpen && <LibraryPanel project={project.projectState} layer={activeLayer} onClose={() => setLibraryOpen(false)}
          onOpen={(p) => { const parsed = parseProjectFile(JSON.stringify(p)); if (!parsed) { flashHint('El proyecto guardado no es válido.'); return; } project.openParsed(parsed); }}
          onKit={(kit) => updateActive((l) => ({ ...l, typography: structuredClone(kit.typography), animation: cloneAnimation(kit.animation), preset: kit.animation.in?.preset ?? l.preset, overrides: kit.animation.in?.overrides ?? l.overrides }))} />}
        {saveKind && (
          <SavePresetModal
            suggestedName={saveKind === 'style' ? 'Mi estilo' : `GB ${activeLayer.preset.name}`}
            lockedKind={saveKind === 'style' ? 'style' : undefined}
            onCancel={() => setSaveKind(null)}
            onSave={savePreset}
          />
        )}
      </Suspense>
      <div className="toast" role="status" aria-live="polite">{hint && <span>{hint}</span>}</div>
    </div>
  );
}
