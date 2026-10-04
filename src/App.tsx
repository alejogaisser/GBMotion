import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  Pause, Volume2, VolumeX, Undo2, Redo2, Check, Clapperboard, Film, FolderOpen, HardDriveDownload, Image, Palette, Play, RotateCcw, Save, Sliders, Type, Zap,
} from 'lucide-react';
import { LibraryPanel } from './components/LibraryPanel';
import { WordTimingPanel } from './components/WordTimingPanel';
import { KeyframePanel } from './components/KeyframePanel';
import { alignLayers, distributeLayers } from './engine/editorMotion';
import { CaptionTools } from './components/CaptionTools';
import { exportSubtitles, type CaptionCue } from './utils/subtitles';
import { readWaveform } from './utils/audio';
import { builtInComboPresets } from './presets/combos';
import { StyleGallery } from './components/StyleGallery';
import { StyleTuner } from './components/StyleTuner';
import { MotionPanel } from './components/MotionPanel';
import { TextPanel } from './components/TextPanel';
import { OutputPanel, type ExportKind, type ExportState, type PastExport } from './components/OutputPanel';
import { GuidePanel, type GuideUpload } from './components/GuidePanel';
import { mediaExists, mediaUrl, uploadMedia } from './utils/mediaClient';
import { CanvasOverlay } from './components/CanvasOverlay';
import { TimelineDock } from './components/TimelineDock';
import { SavePresetModal, type SavePresetKind } from './components/SavePresetModal';
import { TextComposition } from './remotion/TextComposition';
import { createTextLayer, defaultCompositionProps, formats, overridesFor } from './remotion/defaults';
import { builtInPresets, defaultPreset } from './presets/builtins';
import { builtInStylePresets } from './presets/styles';
import { resolvePreset } from './engine/resolvePreset';
import { animationForLayer } from './engine/layerAnimation';
import { cloneAnimation, cloneLayer, EditorHistory, MAX_LAYERS, remapKeywords, remapWordTiming, splitWordTiming } from './utils/editor';
import { getLayerDuration, getCompositionDuration } from './utils/duration';
import { loadCustomComboPresets, loadCustomPresets, loadCustomStylePresets, loadFavorites, saveCustomComboPresets, saveCustomPresets, saveCustomStylePresets, saveFavorites } from './utils/storage';
import { clearProject, loadProject, parseProjectFile, saveProject, serializeProject } from './utils/project';
import type {
  AnimationMode, BackgroundMode, ComboPreset, CompositionProps, KeywordStyle, MotionPreset, TextLayer, VideoGuide,
} from './types/motion';

type Tool = 'estilo' | 'movimiento' | 'texto' | 'video' | 'salida';

const tools: { id: Tool; label: string; Icon: typeof Palette; title: string }[] = [
  { id: 'estilo', label: 'Estilo', Icon: Palette, title: 'Cómo se ve la letra' },
  { id: 'movimiento', label: 'Efectos', Icon: Zap, title: 'Cómo entra y sale' },
  { id: 'texto', label: 'Texto', Icon: Type, title: 'Qué dice y dónde va' },
  { id: 'video', label: 'Video', Icon: Clapperboard, title: 'Subir un video para calzar los subtítulos' },
  { id: 'salida', label: 'Salida', Icon: Image, title: 'Tamaño, fondo y descarga' },
];

const panelTitles: Record<Tool, { title: string; hint: string }> = {
  estilo: { title: 'Estilo del subtítulo', hint: 'Elegí un look. Se aplica a la frase seleccionada.' },
  movimiento: { title: 'Efectos', hint: 'Cómo aparece, cuánto se queda y cómo se va.' },
  texto: { title: 'Texto', hint: 'Qué dice, con qué letra y dónde se ubica.' },
  video: { title: 'Video', hint: 'Subilo una vez: queda guardado para calzar y exportar tus subtítulos.' },
  salida: { title: 'Salida', hint: 'Formato, fondo y descarga del video.' },
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const initialLayers = () => defaultCompositionProps.layers.map(cloneLayer);
const createLayerId = () => `text-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const nameFor = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 4).join(' ') || 'Frase vacía';

export default function App() {
  const [restored] = useState(loadProject);
  const [layers, setLayers] = useState<TextLayer[]>(() => restored?.layers ?? initialLayers());
  const [activeLayerId, setActiveLayerId] = useState(() => restored?.activeLayerId ?? defaultCompositionProps.layers[0].id);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [guideName, setGuideName] = useState(() => restored?.guideName ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customPresets, setCustomPresets] = useState<MotionPreset[]>(loadCustomPresets);
  const [customStylePresets, setCustomStylePresets] = useState(loadCustomStylePresets);
  const [customCombos, setCustomCombos] = useState<ComboPreset[]>(loadCustomComboPresets);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [tool, setTool] = useState<Tool>('texto');
  const [guide, setGuide] = useState<VideoGuide | null>(null);
  const [guideMediaId, setGuideMediaId] = useState(() => restored?.guideMediaId ?? '');
  const [guideUpload, setGuideUpload] = useState<GuideUpload>({ status: 'idle', progress: 0 });
  const uploadToken = useRef(0);
  const [exportVolume, setExportVolume] = useState(1);

  const layerClipboard = useRef<TextLayer | null>(null);

  const playerRef = useRef<PlayerRef>(null);
  const seekTargetFrame = useRef<number | null>(null);
  const projectSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const projectFileInput = useRef<HTMLInputElement>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  const [projectSaved, setProjectSaved] = useState<boolean | null>(false);
  const [projectName, setProjectName] = useState(() => restored?.name ?? 'Mi proyecto');
  const [background, setBackground] = useState<BackgroundMode>(() => restored?.background ?? 'black');
  const [customBackground, setCustomBackground] = useState(() => restored?.customBackground ?? '#131722');
  const [formatId, setFormatId] = useState(() => restored?.formatId ?? 'portrait');
  const historyGroup = useRef(0);
  const snapshot = { layers, background, customBackground, formatId, name: projectName };
  const [history] = useState(() => ({ current: new EditorHistory(snapshot) }));
  const [historyStatus, setHistoryStatus] = useState({ undo: false, redo: false });
  useLayoutEffect(() => {
    history.current.observe(snapshot, historyGroup.current);
    setHistoryStatus({ undo: history.current.canUndo, redo: history.current.canRedo });
  }, [layers, background, customBackground, formatId, projectName]);
  const [saveKind, setSaveKind] = useState<SavePresetKind | null>(null);
  const [advanced, setAdvanced] = useState(() => {
    try { return localStorage.getItem('gb-motion:interface-mode') === 'advanced'; } catch { return false; }
  });
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [pastExports, setPastExports] = useState<PastExport[]>([]);
  const exportJobId = useRef<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [panelWidth, setPanelWidth] = useState(360);
  const [timelineHeight, setTimelineHeight] = useState(220);
  const stageViewport = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 640, height: 480 });
  useEffect(() => {
    const element = stageViewport.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const [appearanceClipboard, setAppearanceClipboard] = useState<TextLayer | null>(null);
  const [hint, setHint] = useState('');
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashHint = (message: string) => {
    setHint(message);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 3600);
  };

  /** Lee la duración real del archivo antes de mostrarlo, para dimensionar la línea de tiempo. */
  const readDuration = async (src: string) => {
    const probe = document.createElement('video');
    try {
      return await new Promise<number>((resolve, reject) => {
        probe.preload = 'metadata';
        probe.onloadedmetadata = () => resolve(probe.duration);
        probe.onerror = () => reject(new Error('formato no soportado'));
        probe.src = src;
      });
    } finally {
      // Sin esto el elemento de prueba sigue sosteniendo el archivo.
      probe.removeAttribute('src');
      probe.load();
    }
  };
  const revokeBlob = (src: string) => { if (src.startsWith('blob:')) URL.revokeObjectURL(src); };

  const pickGuide = async (file: File) => {
    const src = URL.createObjectURL(file);
    try {
      const seconds = await readDuration(src);
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('duración desconocida');
      setGuideName(file.name);
      setGuide((current) => {
        if (current) revokeBlob(current.src);
        return { src, name: file.name, durationInFrames: Math.round(seconds * 30), volume: 1 };
      });
      // El video se guarda en el servidor local para que sobreviva a una recarga y
      // para poder exportarlo con los subtítulos adentro.
      const token = ++uploadToken.current;
      setGuideMediaId('');
      setGuideUpload({ status: 'uploading', progress: 0 });
      uploadMedia(file, (progress) => { if (uploadToken.current === token) setGuideUpload({ status: 'uploading', progress }); })
        .then((info) => {
          if (uploadToken.current !== token) return;
          setGuide((current) => current?.src === src ? { ...current, mediaId: info.mediaId } : current);
          setGuideMediaId(info.mediaId);
          setGuideUpload({ status: 'idle', progress: 1 });
          flashHint('Video guardado.');
        })
        .catch((error: unknown) => {
          if (uploadToken.current !== token) return;
          setGuideUpload({ status: 'error', progress: 0 });
          flashHint(error instanceof Error ? error.message : 'No pude guardar el video.');
        });
      flashHint('Video cargado. Preparando la forma de onda…');
      if (file.size <= 150_000_000) void readWaveform(file).then((waveform) => setGuide((current) => current?.src === src ? { ...current, waveform } : current)).catch(() => flashHint('Video listo. No se pudo leer la forma de onda; podés sincronizar escuchando el audio.'));
      else flashHint('Video listo. La forma de onda se omite en archivos mayores de 150 MB.');
    } catch {
      URL.revokeObjectURL(src);
      flashHint('No pude leer ese video. Probá con un MP4.');
    }
  };

  const removeGuide = () => {
    uploadToken.current++;
    setGuideName(''); setGuideMediaId(''); setGuideUpload({ status: 'idle', progress: 0 });
    setGuide((current) => {
      if (current) revokeBlob(current.src);
      return null;
    });
  };

  /** Vuelve a conectar un video ya subido (después de recargar o de abrir un proyecto). */
  const relinkGuide = async (mediaId: string, name: string) => {
    setGuideMediaId(mediaId);
    if (!(await mediaExists(mediaId))) { setGuideMediaId((current) => current === mediaId ? '' : current); return; }
    const src = mediaUrl(mediaId);
    try {
      const seconds = await readDuration(src);
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('duración desconocida');
      setGuide((current) => current ?? { src, name: name || 'video', durationInFrames: Math.round(seconds * 30), volume: 1, mediaId });
    } catch {
      setGuideMediaId((current) => current === mediaId ? '' : current);
    }
  };
  useEffect(() => { if (restored?.guideMediaId) void relinkGuide(restored.guideMediaId, restored.guideName ?? ''); }, []);

  // El blob se libera sólo al desmontar. Con `guide` como dependencia, cualquier
  // cambio de volumen dispararía la limpieza y revocaría la URL que el video
  // sigue usando.
  const guideRef = useRef<VideoGuide | null>(null);
  guideRef.current = guide;
  useEffect(() => () => { if (guideRef.current) revokeBlob(guideRef.current.src); }, []);

  const presets = useMemo(() => [...builtInPresets, ...customPresets], [customPresets]);
  const stylePresets = useMemo(() => [...builtInStylePresets, ...customStylePresets], [customStylePresets]);
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0];
  const activeAnimation = animationForLayer(activeLayer);
  const format = formats.find((item) => item.id === formatId) ?? formats[0];
  const inputProps: CompositionProps = { layers, background, customBackground, guide };
  // Con un video cargado la línea de tiempo tiene que cubrirlo entero, aunque
  // los subtítulos todavía no lleguen hasta el final.
  const duration = Math.max(getCompositionDuration(layers), guide?.durationInFrames ?? 0);

  // Cada herramienta arranca desde arriba: sin esto, entrar a «Salida» después
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
    clearTimeout(projectSaveTimer.current);
    setProjectSaved(false);
    projectSaveTimer.current = setTimeout(() => {
      setProjectSaved(saveProject({ layers, background, customBackground, formatId, activeLayerId, name: projectName, guideName, guideMediaId: guideMediaId || undefined }) ? true : null);
    }, 600);
    return () => clearTimeout(projectSaveTimer.current);
  }, [layers, background, customBackground, formatId, activeLayerId, projectName, guideName, guideMediaId]);
  const latestProject = useRef({ ...snapshot, activeLayerId, guideName, guideMediaId: guideMediaId || undefined });
  latestProject.current = { ...snapshot, activeLayerId, guideName, guideMediaId: guideMediaId || undefined };
  useEffect(() => {
    const flush = () => saveProject(latestProject.current);
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, []);
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

  const seek = (frame: number) => { const target = Math.max(0, Math.min(duration - 1, frame)); seekTargetFrame.current = target; playerRef.current?.pause(); playerRef.current?.seekTo(target); setCurrentFrame(target); };
  const selectLayer = (id: string, multiple = false) => { setActiveLayerId(id); setSelectedIds((ids) => multiple ? ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id] : [id]); };
  const selected = layers.filter((l) => selectedIds.includes(l.id));
  const updateLayer = (id: string, updater: (layer: TextLayer) => TextLayer) => {
    setLayers((current) => current.map((layer) => layer.id === id ? updater(layer) : layer));
    setExportState((current) => current.status === 'rendering' ? current : { status: 'idle' });
  };
  const updateActive = (updater: (layer: TextLayer) => TextLayer) => { if (!activeLayer.locked) updateLayer(activeLayer.id, updater); else flashHint('Desbloqueá la frase para editarla.'); };
  const recordHistory = () => { historyGroup.current++; };
  const restoreHistory = (next: typeof snapshot | undefined) => {
    if (!next) return;
    setLayers(next.layers); setBackground(next.background); setCustomBackground(next.customBackground);
    setFormatId(next.formatId); setProjectName(next.name);
    if (!next.layers.some((layer) => layer.id === activeLayerId)) setActiveLayerId(next.layers[0].id);
    setHistoryStatus({ undo: history.current.canUndo, redo: history.current.canRedo });
  };
  const undo = () => restoreHistory(history.current.undo());
  const redo = () => restoreHistory(history.current.redo());

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

  const applyProjectState = (nextLayers: TextLayer[], nextActiveId: string, nextBackground: BackgroundMode, nextCustomBackground: string, nextFormatId: string, name = 'Mi proyecto') => {
    history.current.reset({ layers: nextLayers, background: nextBackground, customBackground: nextCustomBackground, formatId: nextFormatId, name });
    setHistoryStatus({ undo: false, redo: false }); setSelectedIds([]); setProjectName(name); layerClipboard.current = null;
    seekTargetFrame.current = null; removeGuide();
    playerRef.current?.seekTo(0); setCurrentFrame(0);
    setLayers(nextLayers); setActiveLayerId(nextActiveId);
    setBackground(nextBackground); setCustomBackground(nextCustomBackground); setFormatId(nextFormatId);
    setExportState((current) => current.status === 'rendering' ? current : { status: 'idle' });
  };

  const reset = () => {
    if (!window.confirm('Esto empieza un proyecto nuevo y borra el actual. ¿Seguir?')) return;
    const next = initialLayers();
    clearProject();
    applyProjectState(next, next[0].id, 'black', '#131722', 'portrait');
  };

  const downloadProject = () => {
    const blob = new Blob([serializeProject({ layers, background, customBackground, formatId, activeLayerId, name: projectName, guideName, guideMediaId: guideMediaId || undefined })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gb-motion-proyecto-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openProjectFile = async (file: File) => {
    const parsed = parseProjectFile(await file.text());
    if (!parsed) { flashHint('Ese archivo no es un proyecto de GB Motion.'); return; }
    applyProjectState(parsed.layers, parsed.activeLayerId, parsed.background, parsed.customBackground, parsed.formatId, parsed.name);
    setGuideName(parsed.guideName ?? '');
    if (parsed.guideMediaId) void relinkGuide(parsed.guideMediaId, parsed.guideName ?? '');
    flashHint('Proyecto abierto.');
  };

  /** Una frase nueva hereda el look y el movimiento de la que estabas editando. */
  const addLayer = () => {
    if (layers.length >= MAX_LAYERS) return;
    recordHistory();
    const source = activeLayer;
    const next = createTextLayer('NUEVA FRASE', createLayerId(), source.preset);
      next.typography = structuredClone(source.typography);
    next.overrides = { ...source.overrides };
    next.animation = cloneAnimation(animationForLayer(source));
    next.positionX = source.positionX;
    next.positionY = source.positionY;
      // Continúa después de la frase elegida.
    next.startFrame = Math.max(0, (source.startFrame ?? 0) + getLayerDuration(source));
    setLayers((current) => [...current, next]);
    setActiveLayerId(next.id);
    setTool('texto');
  };

  const importCaptions = (cues: CaptionCue[]) => {
    if (layers.length + cues.length > MAX_LAYERS) throw new Error(`Podés tener hasta ${MAX_LAYERS} frases. No se importó ninguna para evitar recortes.`);
    recordHistory();
    const additions = cues.map((cue) => ({ ...cloneLayer(activeLayer), ...cue, id: createLayerId(), name: nameFor(cue.text), keywords: {}, wordTiming: undefined, transformKeys: undefined, locked: false, visible: true }));
    setLayers((current) => [...current, ...additions]); setActiveLayerId(additions[0].id);
    flashHint(`${additions.length} frases agregadas. Podés deshacer la importación.`);
  };
  const downloadCaptions = (kind: 'srt' | 'vtt') => {
    const url = URL.createObjectURL(new Blob([exportSubtitles(layers, kind)], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${projectName || 'subtitulos'}.${kind}`; a.click(); URL.revokeObjectURL(url);
  };
  const splitLayer = () => {
    const source = activeLayer; const end = source.startFrame + getLayerDuration(source);
    if (source.locked || layers.length >= MAX_LAYERS || currentFrame <= source.startFrame || currentFrame >= end - 1) return;
    recordHistory();
    const words = source.text.match(/\S+/g) ?? [];
    const localCut = currentFrame - source.startFrame;
    const timed = source.wordTiming && source.wordTiming.words.length === words.length ? splitWordTiming(source.wordTiming, localCut) : null;
    const cut = timed && words.length > 1 && timed[0]
      ? timed[0].words.length
      : Math.max(1, Math.min(words.length - 1, Math.round(words.length * localCut / (end - source.startFrame))));
    const firstText = words.length > 1 ? words.slice(0, cut).join(' ') : source.text;
    const secondText = words.length > 1 ? words.slice(cut).join(' ') : source.text;
    const second = { ...cloneLayer(source), wordTiming: timed?.[1], transformKeys: undefined, id: createLayerId(), text: secondText, name: nameFor(secondText), startFrame: currentFrame, durationFrames: end - currentFrame,
      keywords: Object.fromEntries(Object.entries(source.keywords).filter(([i]) => Number(i) >= cut).map(([i, style]) => [Number(i) - cut, style])) };
    setLayers((current) => current.flatMap((l) => l.id === source.id ? [{ ...l, wordTiming: timed?.[0], text: firstText, name: nameFor(firstText), durationFrames: currentFrame - l.startFrame,
      keywords: Object.fromEntries(Object.entries(l.keywords).filter(([i]) => Number(i) < cut)) }, second] : [l]));
    setActiveLayerId(second.id);
    flashHint('Frase dividida. Revisá las palabras de cada parte.');
  };

  const duplicateLayer = (id: string) => {
    const source = layers.find((layer) => layer.id === id);
    if (!source || layers.length >= MAX_LAYERS) return;
    recordHistory();
    const next = cloneLayer(source);
    next.id = createLayerId();
    next.name = `${source.name} copia`;
    next.startFrame = (source.startFrame ?? 0) + 15;
    setLayers((current) => [...current, next]);
    setActiveLayerId(next.id);
  };

  const deleteLayer = (id: string) => {
    if (layers.length === 1 || layers.find((layer) => layer.id === id)?.locked) return;
    recordHistory();
    const remaining = layers.filter((layer) => layer.id !== id);
    setLayers(remaining);
    if (activeLayerId === id) setActiveLayerId(remaining[0].id);
  };

  useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (document.querySelector('[role="dialog"]')) return;
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'c') { event.preventDefault(); layerClipboard.current = cloneLayer(activeLayer); }
      if (modifier && event.key.toLowerCase() === 'v' && layerClipboard.current && layers.length < MAX_LAYERS) {
        event.preventDefault();
        recordHistory();
        const next = cloneLayer(layerClipboard.current);
        next.id = createLayerId(); next.name = `${next.name} copia`; next.startFrame = (next.startFrame ?? 0) + 15;
        setLayers((current) => [...current, next]); setActiveLayerId(next.id);
      }
      if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateLayer(activeLayer.id); }
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (event.key === 'Delete' && layers.length > 1 && !activeLayer.locked) { event.preventDefault(); deleteLayer(activeLayer.id); }
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

  const refreshExports = async () => {
    try {
      const result = await (await fetch('/api/exports')).json() as { files?: PastExport[] };
      setPastExports(result.files ?? []);
    } catch { /* que falle el listado no es fatal */ }
  };
  useEffect(() => { void refreshExports(); }, []);

  const exportVideo = async (kind: ExportKind) => {
    if (exportJobId.current) return;
    if (kind === 'burn' && !guideMediaId) { setExportState({ status: 'error', message: 'Subí un video en «Video» para exportarlo con subtítulos.' }); return; }
      const requestId = `starting-${Date.now()}`;
      let ownedJobId = requestId;
    exportJobId.current = requestId;
    setExportState({ status: 'rendering', message: 'Preparando tu video…', progress: 0 });
    try {
      const exportBackground = kind === 'green' ? 'green' : kind === 'alpha' ? 'transparent' : background === 'checker' ? 'black' : background;
      // El video de guía se saca siempre: su `src` es un blob de esta pestaña,
      // que el proceso de render no puede abrir, y el MP4 tiene que salir
      // limpio para componerlo en CapCut.
      const { guide: _guide, ...exportProps } = inputProps;
      // Para «Video con tus subtítulos» el servidor arma la URL del video a partir del id.
      const media = kind === 'burn' ? { mediaId: guideMediaId, name: guide?.name, volume: exportVolume } : undefined;
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ props: { ...exportProps, background: exportBackground }, format, kind, media }),
      });
      const started = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !started.jobId) throw new Error(started.error ?? 'No se pudo iniciar el video');
      if (exportJobId.current !== requestId) { await fetch(`/api/render/${started.jobId}`, { method: 'DELETE' }); return; }
        exportJobId.current = started.jobId;
        ownedJobId = started.jobId;
      for (;;) {
        await sleep(700);
        if (exportJobId.current !== started.jobId) return;
          const job = await (await fetch(`/api/render/${started.jobId}`)).json() as { status: string; progress?: number; url?: string; error?: string };
          if (exportJobId.current !== ownedJobId) return;
        if (job.status === 'rendering') { setExportState({ status: 'rendering', message: 'Creando tu video…', progress: job.progress ?? 0 }); continue; }
          if (job.status === 'cancelled') { exportJobId.current = null; setExportState({ status: 'idle' }); return; }
        if (job.status === 'done' && job.url) {
          exportJobId.current = null;
          setExportState({ status: 'done', message: '¡Tu video está listo!', url: job.url });
          const anchor = document.createElement('a');
          anchor.href = job.url;
          anchor.download = '';
          anchor.click();
          void refreshExports();
          return;
        }
        throw new Error(job.error ?? 'No se pudo crear el video');
      }
      } catch (error) {
        if (exportJobId.current !== ownedJobId) return;
        exportJobId.current = null;
      setExportState({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo crear el video' });
    }
  };

  const cancelExport = async () => {
    const jobId = exportJobId.current;
    exportJobId.current = null;
    setExportState({ status: 'idle' });
    if (jobId) { try { await fetch(`/api/render/${jobId}`, { method: 'DELETE' }); } catch { /* ignorar */ } }
  };

  const applyStyleToAll = () => {
    recordHistory();
    setLayers((current) => current.map((l) => l.locked ? l : { ...l, typography: { ...structuredClone(activeLayer.typography), fontSize: l.typography.fontSize } }));
    flashHint('Estilo aplicado a las frases desbloqueadas. Se conservaron tiempos, tamaños y posiciones.');
  };
  const sampleWord = activeLayer.text.trim().split(/\s+/)[0]?.slice(0, 9) || 'Aa';

  return (
    <div className="app" style={{ '--panel-width': `${panelWidth}px`, '--timeline-height': `${timelineHeight}px` } as React.CSSProperties} onPointerDownCapture={recordHistory} onFocusCapture={recordHistory}
      onKeyDownCapture={(event) => { if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) recordHistory(); }}>
      <header className="topbar">
        <span className="brand"><span className="brand-mark"><Film size={15} /></span>GB <b>MOTION</b></span>
        <div className="topbar-group">
          <button type="button" className="icon-button" title="Abrir un proyecto guardado" aria-label="Abrir proyecto" onClick={() => projectFileInput.current?.click()}><FolderOpen size={15} /></button>
          <button type="button" className="icon-button" title="Descargar este proyecto" aria-label="Descargar proyecto" onClick={downloadProject}><HardDriveDownload size={15} /></button>
          <button type="button" className="icon-button" title="Empezar de nuevo" aria-label="Empezar de nuevo" onClick={reset}><RotateCcw size={15} /></button>
          <button type="button" className="icon-button" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!historyStatus.undo} onClick={undo}><Undo2 size={16} /></button>
          <button type="button" className="icon-button" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={!historyStatus.redo} onClick={redo}><Redo2 size={16} /></button>
          <input className="project-name" aria-label="Nombre del proyecto" value={projectName} maxLength={80} onChange={(event) => setProjectName(event.target.value)} />
          <span title={projectSaved === null ? 'No se pudo guardar. Descargá el proyecto como respaldo.' : 'Guardado en este navegador'} className={`saved ${projectSaved ? 'on' : ''}`}>{projectSaved ? <><Check size={12} /> Guardado</> : projectSaved === null ? 'Sin guardar' : 'Guardando…'}</span>
        </div>
        <div className="topbar-right">
          <button className="ghost-button" onClick={() => setLibraryOpen(true)}>Biblioteca</button>
          <button type="button" className={`icon-button ${advanced ? 'on' : ''}`} aria-pressed={advanced}
            title={advanced ? 'Ajustes finos activados' : 'Mostrar ajustes finos'} onClick={() => setAdvanced((value) => !value)}>
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
        if (file) void openProjectFile(file);
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
            <span className="stage-format">{format.width} × {format.height}</span>
          </div>
          <div className="stage-viewport" ref={stageViewport}>
          <div className={`stage-frame ratio-${format.id}`} style={{ width: Math.max(1, Math.min(stageSize.width - 32, (stageSize.height - 32) * format.width / format.height)) * canvasZoom, height: Math.max(1, Math.min(stageSize.height - 32, (stageSize.width - 32) * format.height / format.width)) * canvasZoom }}>
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
            <CanvasOverlay
              layers={layers}
              activeId={activeLayer.id}
              format={format}
              currentFrame={currentFrame}
              onEdit={(id) => { setActiveLayerId(id); setTool('texto'); setTimeout(() => panelBody.current?.querySelector('textarea.caption-input')?.scrollIntoView({ block: 'center' }), 0); setTimeout(() => (panelBody.current?.querySelector('textarea.caption-input') as HTMLTextAreaElement | null)?.focus(), 0); }}
              onSelect={selectLayer}
              onBeginInteraction={recordHistory}
              onChange={(id, patch) => updateLayer(id, (layer) => ({ ...layer, ...patch }))}
            />
          </div>
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
            {tool === 'estilo' && (
              <>
                <details className="tuner template-picker"><summary>Combinaciones listas para usar</summary><div className="tuner-block template-list">
                  {[...builtInComboPresets, ...customCombos].map((combo) => <span className="combo-item" key={combo.id}>
                    <button className="ghost-button" title={combo.description} onClick={() => updateActive((l) => ({ ...l, typography: structuredClone(combo.typography), animation: cloneAnimation(combo.animation), preset: combo.animation.in?.preset ?? l.preset, overrides: combo.animation.in?.overrides ?? l.overrides }))}>{combo.name}</button>
                    {combo.custom && <button className="ghost-button tiny" aria-label={`Borrar la combinación ${combo.name}`} title="Borrar esta combinación" onClick={() => setCustomCombos((current) => current.filter((item) => item.id !== combo.id))}>×</button>}
                  </span>)}
                </div></details>
                <div className="control-row"><button className="ghost-button" onClick={applyStyleToAll}>Aplicar look a todas</button></div>
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
              {advanced && <KeyframePanel layer={activeLayer} frame={currentFrame} onSeek={seek} onChange={(transformKeys) => updateActive((l) => ({ ...l, transformKeys }))} />}
              </>
            )}
            {tool === 'texto' && (
              <>
              <WordTimingPanel layer={activeLayer} frame={currentFrame} onSeek={seek} onChange={(wordTiming) => updateActive((l) => ({ ...l, wordTiming }))} />
              <CaptionTools onImport={importCaptions} currentFrame={currentFrame} onExport={downloadCaptions} />
              <TextPanel
                key={activeLayer.id}
                text={activeLayer.text}
                typography={activeLayer.typography}
                keywords={activeLayer.keywords}
                positionX={activeLayer.positionX}
                positionY={activeLayer.positionY}
                onText={(text) => updateActive((layer) => ({ ...layer, text, name: nameFor(text), wordTiming: text === layer.text || !layer.wordTiming ? layer.wordTiming : remapWordTiming(layer.text, text, layer.wordTiming, getLayerDuration(layer)), keywords: remapKeywords(layer.text, text, layer.keywords) }))}
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
            {tool === 'video' && (
              <GuidePanel
                guide={guide}
                upload={guideUpload}
                expectedName={guideName}
                formatLabel={format.label}
                onPick={(file) => void pickGuide(file)}
                onVolume={(volume) => setGuide((current) => current ? { ...current, volume } : current)}
                onRemove={removeGuide}
              />
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
        onSplit={splitLayer}
        waveform={guide?.waveform}
        guideDuration={guide?.durationInFrames}
        canAdd={layers.length < MAX_LAYERS}
        onSeek={(frame) => { seekTargetFrame.current = frame; playerRef.current?.pause(); playerRef.current?.seekTo(frame); setCurrentFrame(frame); }}
        onSelect={selectLayer}
        onChange={(id, patch) => updateLayer(id, (layer) => ({ ...layer, ...patch }))}
        onBeginInteraction={recordHistory}
        onAdd={addLayer}
        onDuplicate={duplicateLayer}
        onDelete={deleteLayer}
        onToggleVisible={(id) => updateLayer(id, (layer) => ({ ...layer, visible: !layer.visible }))}
        onToggleLock={(id) => updateLayer(id, (layer) => ({ ...layer, locked: !layer.locked }))}
      />

      {libraryOpen && <LibraryPanel project={{ ...snapshot, activeLayerId, guideName, guideMediaId: guideMediaId || undefined }} layer={activeLayer} onClose={() => setLibraryOpen(false)}
        onOpen={(p) => { const parsed = parseProjectFile(JSON.stringify(p)); if (!parsed) { flashHint('El proyecto guardado no es válido.'); return; } applyProjectState(parsed.layers, parsed.activeLayerId, parsed.background, parsed.customBackground, parsed.formatId, parsed.name); setGuideName(parsed.guideName ?? ''); if (parsed.guideMediaId) void relinkGuide(parsed.guideMediaId, parsed.guideName ?? ''); }}
        onKit={(kit) => updateActive((l) => ({ ...l, typography: structuredClone(kit.typography), animation: cloneAnimation(kit.animation), preset: kit.animation.in?.preset ?? l.preset, overrides: kit.animation.in?.overrides ?? l.overrides }))} />}
      {saveKind && (
        <SavePresetModal
          suggestedName={saveKind === 'style' ? 'Mi estilo' : `GB ${activeLayer.preset.name}`}
          lockedKind={saveKind === 'style' ? 'style' : undefined}
          onCancel={() => setSaveKind(null)}
          onSave={savePreset}
        />
      )}
      <div className="toast" role="status" aria-live="polite">{hint && <span>{hint}</span>}</div>
    </div>
  );
}
