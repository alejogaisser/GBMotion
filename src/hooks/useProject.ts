import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createTextLayer, defaultCompositionProps, formats } from '../remotion/defaults';
import { animationForLayer } from '../engine/layerAnimation';
import { cloneAnimation, cloneLayer, EditorHistory, MAX_LAYERS, remapKeywords, remapWordTiming, splitWordTiming } from '../utils/editor';
import { getLayerDuration } from '../utils/duration';
import { exportSubtitles, type CaptionCue } from '../utils/subtitles';
import { clearProject, parseProjectFile, saveProject, serializeProject, type ProjectState } from '../utils/project';
import type { BackgroundMode, TextLayer, WordTiming } from '../types/motion';

const initialLayers = () => defaultCompositionProps.layers.map(cloneLayer);
export const createLayerId = () => `text-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const nameFor = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 4).join(' ') || 'Frase vacía';

/** Cambia el texto de una frase y conserva los tiempos y las palabras clave de lo que no se tocó. */
export const withText = (layer: TextLayer, text: string): TextLayer => ({
  ...layer,
  text,
  name: nameFor(text),
  wordTiming: text === layer.text || !layer.wordTiming ? layer.wordTiming : remapWordTiming(layer.text, text, layer.wordTiming, getLayerDuration(layer)),
  keywords: remapKeywords(layer.text, text, layer.keywords),
});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Une dos frases consecutivas: el texto, los tiempos por palabra y las palabras clave. */
const mergeTwo = (a: TextLayer, b: TextLayer): TextLayer => {
  const aWords = a.text.match(/\S+/g)?.length ?? 0;
  const offset = Math.max(1, b.startFrame - a.startFrame);
  const duration = Math.max(offset + 1, b.startFrame + getLayerDuration(b) - a.startFrame);
  let wordTiming: WordTiming | undefined;
  if (a.wordTiming && b.wordTiming && a.wordTiming.words.length === aWords) {
    wordTiming = {
      ...a.wordTiming,
      words: [
        ...a.wordTiming.words.map((w, i, all) => i === all.length - 1 ? { ...w, end: Math.max(w.start + 1, offset) } : w),
        ...b.wordTiming.words.map((w) => ({ ...w, start: w.start + offset, end: w.end + offset })),
      ],
    };
  }
  const text = `${a.text.trim()} ${b.text.trim()}`.trim();
  return {
    ...a,
    text,
    name: nameFor(text),
    durationFrames: duration,
    wordTiming,
    keywords: { ...a.keywords, ...Object.fromEntries(Object.entries(b.keywords).map(([i, style]) => [Number(i) + aWords, style])) },
  };
};

type Options = {
  restored: ProjectState | null;
  guideName: string;
  guideMediaId: string;
  flashHint: (message: string) => void;
  /** Cualquier edición vuelve el cartel de exportación a cero. */
  onEdited: () => void;
  /** Abrir o empezar un proyecto saca el video de guía y mueve el cabezal al inicio. */
  onProjectReplaced: () => void;
  onRelink: (mediaId: string, name: string) => void;
  onGuideName: (name: string) => void;
  onLayerAdded: () => void;
};

/**
 * El proyecto: frases, fondo, formato, nombre, historial de deshacer, guardado
 * automático y las operaciones sobre las frases.
 */
export const useProject = ({ restored, guideName, guideMediaId, flashHint, onEdited, onProjectReplaced, onRelink, onGuideName, onLayerAdded }: Options) => {
  const [layers, setLayers] = useState<TextLayer[]>(() => restored?.layers ?? initialLayers());
  const [activeLayerId, setActiveLayerId] = useState(() => restored?.activeLayerId ?? defaultCompositionProps.layers[0].id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projectName, setProjectName] = useState(() => restored?.name ?? 'Mi proyecto');
  const [background, setBackground] = useState<BackgroundMode>(() => restored?.background ?? 'black');
  const [customBackground, setCustomBackground] = useState(() => restored?.customBackground ?? '#131722');
  const [formatId, setFormatId] = useState(() => restored?.formatId ?? 'portrait');
  const [projectSaved, setProjectSaved] = useState<boolean | null>(false);
  const layerClipboard = useRef<TextLayer | null>(null);
  const projectSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const historyGroup = useRef(0);

  const snapshot = { layers, background, customBackground, formatId, name: projectName };
  const [history] = useState(() => ({ current: new EditorHistory(snapshot) }));
  const [historyStatus, setHistoryStatus] = useState({ undo: false, redo: false });
  useLayoutEffect(() => {
    history.current.observe(snapshot, historyGroup.current);
    setHistoryStatus({ undo: history.current.canUndo, redo: history.current.canRedo });
  }, [layers, background, customBackground, formatId, projectName]);

  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0];
  const format = formats.find((item) => item.id === formatId) ?? formats[0];
  const selected = layers.filter((layer) => selectedIds.includes(layer.id));
  const projectState = { ...snapshot, activeLayerId, guideName, guideMediaId: guideMediaId || undefined };

  useEffect(() => {
    clearTimeout(projectSaveTimer.current);
    setProjectSaved(false);
    projectSaveTimer.current = setTimeout(() => {
      setProjectSaved(saveProject({ layers, background, customBackground, formatId, activeLayerId, name: projectName, guideName, guideMediaId: guideMediaId || undefined }) ? true : null);
    }, 600);
    return () => clearTimeout(projectSaveTimer.current);
  }, [layers, background, customBackground, formatId, activeLayerId, projectName, guideName, guideMediaId]);
  const latestProject = useRef(projectState);
  latestProject.current = projectState;
  useEffect(() => {
    const flush = () => saveProject(latestProject.current);
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  // Las operaciones asincrónicas (subtítulos automáticos) leen las frases de ahora, no las del clic.
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const recordHistory = () => { historyGroup.current++; };
  const selectLayer = (id: string, multiple = false) => { setActiveLayerId(id); setSelectedIds((ids) => multiple ? ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id] : [id]); };
  const updateLayer = (id: string, updater: (layer: TextLayer) => TextLayer) => {
    setLayers((current) => current.map((layer) => layer.id === id ? updater(layer) : layer));
    onEdited();
  };
  const updateActive = (updater: (layer: TextLayer) => TextLayer) => { if (!activeLayer.locked) updateLayer(activeLayer.id, updater); else flashHint('Desbloqueá la frase para editarla.'); };

  const restoreHistory = (next: typeof snapshot | undefined) => {
    if (!next) return;
    setLayers(next.layers); setBackground(next.background); setCustomBackground(next.customBackground);
    setFormatId(next.formatId); setProjectName(next.name);
    if (!next.layers.some((layer) => layer.id === activeLayerId)) setActiveLayerId(next.layers[0].id);
    setHistoryStatus({ undo: history.current.canUndo, redo: history.current.canRedo });
  };
  const undo = () => restoreHistory(history.current.undo());
  const redo = () => restoreHistory(history.current.redo());

  const applyProjectState = (nextLayers: TextLayer[], nextActiveId: string, nextBackground: BackgroundMode, nextCustomBackground: string, nextFormatId: string, name = 'Mi proyecto') => {
    history.current.reset({ layers: nextLayers, background: nextBackground, customBackground: nextCustomBackground, formatId: nextFormatId, name });
    setHistoryStatus({ undo: false, redo: false }); setSelectedIds([]); setProjectName(name); layerClipboard.current = null;
    onProjectReplaced();
    setLayers(nextLayers); setActiveLayerId(nextActiveId);
    setBackground(nextBackground); setCustomBackground(nextCustomBackground); setFormatId(nextFormatId);
    onEdited();
  };

  /** Devuelve true si se empezó un proyecto nuevo (la persona confirmó). */
  const reset = () => {
    if (!window.confirm('Esto empieza un proyecto nuevo y borra el actual. ¿Seguir?')) return false;
    const next = initialLayers();
    clearProject();
    applyProjectState(next, next[0].id, 'black', '#131722', 'portrait');
    return true;
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

  /** Aplica un proyecto leído (de un archivo o de la biblioteca) y re-vincula su video. */
  const openParsed = (parsed: ProjectState) => {
    applyProjectState(parsed.layers, parsed.activeLayerId, parsed.background, parsed.customBackground, parsed.formatId, parsed.name);
    onGuideName(parsed.guideName ?? '');
    if (parsed.guideMediaId) onRelink(parsed.guideMediaId, parsed.guideName ?? '');
  };

  const openProjectFile = async (file: File) => {
    const parsed = parseProjectFile(await file.text());
    if (!parsed) { flashHint('Ese archivo no es un proyecto de GB Motion.'); return; }
    openParsed(parsed);
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
    onLayerAdded();
  };

  const applyAutoCaptions = (created: TextLayer[], mode: 'replace' | 'append') => {
    const kept = mode === 'replace' ? layersRef.current.filter((layer) => layer.locked) : layersRef.current;
    if (created.length === 0) return 'No se detectó voz en el video.';
    if (kept.length + created.length > MAX_LAYERS) return `Son demasiados subtítulos (${created.length}). Subí «palabras por subtítulo» o acortá el video.`;
    recordHistory();
    setLayers([...kept, ...created]);
    setActiveLayerId(created[0].id);
    setSelectedIds([]);
    flashHint(`${created.length} subtítulos creados. Podés deshacerlo con Ctrl+Z.`);
    return null;
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

  const splitLayer = (currentFrame: number) => {
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

  /** Une una frase con la que le sigue en el tiempo («Unir con la siguiente»). */
  const mergeWithNext = (id: string) => {
    const ordered = [...layers].sort((x, y) => x.startFrame - y.startFrame);
    const index = ordered.findIndex((layer) => layer.id === id);
    const a = ordered[index]; const b = ordered[index + 1];
    if (!a || !b || a.locked || b.locked) return;
    recordHistory();
    const merged = mergeTwo(a, b);
    setLayers((current) => current.filter((layer) => layer.id !== b.id).map((layer) => layer.id === a.id ? merged : layer));
    setActiveLayerId(a.id);
  };

  /** Cuántas frases desbloqueadas contienen el texto buscado (sin distinguir mayúsculas). */
  const countMatches = (find: string) => {
    if (!find) return 0;
    const pattern = new RegExp(escapeRegExp(find), 'giu');
    return layers.filter((layer) => !layer.locked && layer.text.search(pattern) >= 0).length;
  };

  /** Buscar y reemplazar en todas las frases desbloqueadas, como un solo paso de deshacer. */
  const replaceInAll = (find: string, replacement: string) => {
    if (!find) return 0;
    const pattern = new RegExp(escapeRegExp(find), 'giu');
    let changed = 0;
    const next = layers.map((layer) => {
      if (layer.locked) return layer;
      const text = layer.text.replace(pattern, () => replacement);
      if (text === layer.text || !text.trim()) return layer;
      changed++;
      return withText(layer, text);
    });
    if (changed === 0) return 0;
    recordHistory();
    setLayers(next);
    onEdited();
    return changed;
  };

  /** Copia el look, los efectos y el resaltado de la frase activa a todas las desbloqueadas. */
  const applyTemplateToAll = () => {
    const source = activeLayer;
    const animation = animationForLayer(source);
    recordHistory();
    setLayers((current) => current.map((layer) => {
      if (layer.locked || layer.id === source.id) return layer;
      const own = animationForLayer(layer);
      const copy = cloneAnimation({ ...animation, holdFrames: own.holdFrames });
      return {
        ...layer,
        typography: { ...structuredClone(source.typography), fontSize: layer.typography.fontSize },
        preset: structuredClone(source.preset),
        overrides: { ...source.overrides },
        animation: { ...own, in: copy.in, out: copy.out, loop: copy.loop },
        wordTiming: layer.wordTiming && source.wordTiming ? { ...layer.wordTiming, mode: source.wordTiming.mode, color: source.wordTiming.color } : layer.wordTiming,
      };
    }));
    onEdited();
    flashHint('Plantilla aplicada a las frases desbloqueadas. Se conservaron textos, tiempos, posiciones y tamaños.');
  };

  const applyStyleToAll = () => {
    recordHistory();
    setLayers((current) => current.map((l) => l.locked ? l : { ...l, typography: { ...structuredClone(activeLayer.typography), fontSize: l.typography.fontSize } }));
    flashHint('Estilo aplicado a las frases desbloqueadas. Se conservaron tiempos, tamaños y posiciones.');
  };

  return {
    layers, setLayers, activeLayerId, setActiveLayerId, activeLayer, selectedIds, selected, selectLayer,
    projectName, setProjectName, background, setBackground, customBackground, setCustomBackground, formatId, setFormatId, format,
    projectSaved, snapshot, projectState, historyStatus, layerClipboard,
    recordHistory, updateLayer, updateActive, undo, redo,
    applyProjectState, reset, downloadProject, openParsed, openProjectFile,
    addLayer, applyAutoCaptions, importCaptions, downloadCaptions, splitLayer, duplicateLayer, deleteLayer,
    mergeWithNext, countMatches, replaceInAll, applyTemplateToAll, applyStyleToAll,
  };
};
