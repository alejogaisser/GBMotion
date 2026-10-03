import type { BackgroundMode, LayerAnimation, MotionPreset, TextLayer } from '../types/motion';
import { createTextLayer, formats, overridesFor } from '../remotion/defaults';
import { builtInPresets, defaultPreset } from '../presets/builtins';
import { isMotionPreset } from '../engine/validation';
import { isLayerAnimation, isTypography } from './storage';
import { MAX_LAYERS } from './editor';

export type ProjectState = {
  version: number;
  name?: string;
  guideName?: string;
  layers: TextLayer[];
  background: BackgroundMode;
  customBackground: string;
  formatId: string;
  activeLayerId: string;
};

const PROJECT_KEY = 'gb-motion:project';
const PROJECT_VERSION = 1;
const BACKGROUND_MODES: BackgroundMode[] = ['black', 'white', 'green', 'checker', 'custom', 'transparent'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const str = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);

/** Rebuild the closest safe preset for a stored value. */
const safePreset = (value: unknown): MotionPreset => {
  if (isMotionPreset(value)) return value as MotionPreset;
  if (record(value) && typeof value.id === 'string') {
    const known = builtInPresets.find((preset) => preset.id === value.id);
    if (known) return known;
  }
  return defaultPreset;
};

const safeAnimation = (value: unknown, preset: MotionPreset): LayerAnimation => {
  if (isLayerAnimation(value)) return value as LayerAnimation;
  return { in: { preset, overrides: overridesFor(preset) }, holdFrames: 30, out: null };
};

/** Merge a stored layer over a fresh template so missing or broken fields self-heal. */
const sanitizeLayer = (raw: unknown, index: number): TextLayer => {
  const source = record(raw) ? raw : {};
  const preset = safePreset(source.preset);
  const template = createTextLayer(str(source.text, 'TEXTO'), str(source.id, `text-${Date.now()}-${index}`), preset);
  const keywords = record(source.keywords) ? source.keywords as TextLayer['keywords'] : {};
  return {
    ...template,
    transformKeys: Array.isArray(source.transformKeys) ? source.transformKeys.filter((k): k is NonNullable<TextLayer['transformKeys']>[number] => record(k) && ['frame','x','y','scale','rotation','opacity'].every((key) => typeof k[key] === 'number' && Number.isFinite(k[key])) && Number(k.frame) >= 0 && Number(k.scale) > 0 && ['linear','smooth'].includes(String(k.easing))).slice(0, 300) : undefined,
    wordTiming: record(source.wordTiming) && ['color','box'].includes(String(source.wordTiming.mode)) && HEX.test(String(source.wordTiming.color)) && Array.isArray(source.wordTiming.words)
      ? { mode: source.wordTiming.mode as 'color' | 'box', color: String(source.wordTiming.color), words: source.wordTiming.words.filter((w): w is { word: string; start: number; end: number } => record(w) && typeof w.word === 'string' && typeof w.start === 'number' && Number.isFinite(w.start) && w.start >= 0 && typeof w.end === 'number' && Number.isFinite(w.end) && w.end > w.start).slice(0, 180) } : undefined,
    id: str(source.id, template.id),
    name: str(source.name, template.name),
    text: str(source.text, template.text),
    preset,
    typography: isTypography(source.typography) ? source.typography : template.typography,
    keywords,
    overrides: record(source.overrides) ? { ...template.overrides, ...source.overrides } as TextLayer['overrides'] : template.overrides,
    animation: safeAnimation(source.animation, preset),
    positionX: num(source.positionX, 0),
    positionY: num(source.positionY, 0),
    rotation: num(source.rotation, 0),
    startFrame: Math.max(0, num(source.startFrame, 0)),
    durationFrames: typeof source.durationFrames === 'number' && Number.isFinite(source.durationFrames)
      ? Math.max(1, source.durationFrames)
      : undefined,
    visible: bool(source.visible, true),
    locked: bool(source.locked, false),
    maxWidth: num(source.maxWidth, 0.84),
    maxHeight: num(source.maxHeight, 0.84),
    autoFit: bool(source.autoFit, true),
    autoLineBreak: bool(source.autoLineBreak, true),
    safeZone: num(source.safeZone, 0.08),
  };
};

export const sanitizeProject = (value: unknown): ProjectState | null => {
  if (!record(value)) return null;
  const rawLayers = Array.isArray(value.layers) ? value.layers : [];
  if (rawLayers.length === 0 || rawLayers.length > MAX_LAYERS) return null;
  const layers = rawLayers.slice(0, MAX_LAYERS).map(sanitizeLayer);
  const background = BACKGROUND_MODES.includes(value.background as BackgroundMode) ? value.background as BackgroundMode : 'black';
  const formatId = formats.some((format) => format.id === value.formatId) ? String(value.formatId) : 'portrait';
  const activeLayerId = layers.some((layer) => layer.id === value.activeLayerId) ? String(value.activeLayerId) : layers[0].id;
  return {
    version: PROJECT_VERSION,
    name: str(value.name, 'Mi proyecto').slice(0, 80),
    guideName: str(value.guideName, '').slice(0, 255),
    layers,
    background,
    customBackground: HEX.test(String(value.customBackground)) ? String(value.customBackground) : '#131722',
    formatId,
    activeLayerId,
  };
};

export const loadProject = (): ProjectState | null => {
  try {
    const stored = localStorage.getItem(PROJECT_KEY);
    return stored ? sanitizeProject(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
};

export const saveProject = (state: Omit<ProjectState, 'version'>) => {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify({ version: PROJECT_VERSION, ...state }));
    return true;
  } catch {
    return false;
  }
};

export const clearProject = () => {
  try { localStorage.removeItem(PROJECT_KEY); } catch { /* ignore */ }
};

/** JSON text for "Guardar proyecto" (download) and "Abrir proyecto" (upload). */
export const serializeProject = (state: Omit<ProjectState, 'version'>) => JSON.stringify({ version: PROJECT_VERSION, ...state }, null, 2);

export const parseProjectFile = (text: string): ProjectState | null => {
  try {
    return sanitizeProject(JSON.parse(text));
  } catch {
    return null;
  }
};
