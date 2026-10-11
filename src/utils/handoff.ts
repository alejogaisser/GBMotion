import type {
  AnimationSegment, GradientStop, LayerAnimation, SecondaryLineStyle, StrokeLayer, TextBox, TextFill, TextGlow, TextLayer, TypographySettings, WordHighlightMode,
} from '../types/motion';
import { fontRegistry, fontStack } from '../typography/fontRegistry';
import { builtInPresets } from '../presets/builtins';
import { captionTemplates, evenWordTiming, findTemplate, resolveStyleTypography } from '../presets/templates';
import { overridesFor } from '../remotion/defaults';
import { animationForLayer } from '../engine/layerAnimation';
import { getLayerDuration } from './duration';

/**
 * Enlaces de estilo y traspaso landing -> editor.
 *
 * El fragmento (`#demo=` desde la landing, `#estilo=` al compartir) es base64url
 * de un JSON UTF-8. Nunca viaja por query ni por storage: el fragmento no sale
 * del navegador. Todo lo que entra se valida con una lista blanca y se
 * reconstruye campo por campo; no se acepta ningún objeto arbitrario.
 */

export const HANDOFF_VERSION = 1;
export const MAX_HANDOFF_LENGTH = 4096;
export const MAX_PHRASE_LENGTH = 80;
export const MAX_NAME_LENGTH = 40;

export type HandoffMotion = { in: string; out: string | null; holdFrames: number };
export type HandoffHighlight = { mode: WordHighlightMode; color: string };
export type StylePayloadV1 = {
  v: 1;
  /** 1-40 caracteres. */
  name: string;
  templateId?: string;
  typography: TypographySettings;
  /** Ausente en «Compartir sólo el look»: al aplicar se conservan los efectos de la frase. */
  motion?: HandoffMotion;
  highlight: HandoffHighlight;
};
export type HandoffV1 = { style: StylePayloadV1; /** 0-80, sólo en `#demo=`. */ phrase?: string };
export type HandoffFailure = 'empty' | 'too-large' | 'bad-encoding' | 'bad-json' | 'bad-version' | 'bad-fields';
export type DecodeResult = { ok: true; value: HandoffV1 } | { ok: false; reason: HandoffFailure };

const WORD_MODES: readonly WordHighlightMode[] = ['color', 'box', 'karaoke', 'reveal', 'scale'];
const HEX6 = /^#[0-9a-fA-F]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const inRange = (value: unknown, min: number, max: number): value is number => isNum(value) && value >= min && value <= max;
const isHex = (value: unknown): value is string => typeof value === 'string' && HEX6.test(value);
const isHexOrTransparent = (value: unknown): value is string => isHex(value) || value === 'transparent';

/* ------------------------------ tipografía ------------------------------ */

const sanitizeFill = (raw: unknown): TextFill | null => {
  if (!isRecord(raw)) return null;
  if (raw.type === 'solid') return isHexOrTransparent(raw.color) ? { type: 'solid', color: raw.color } : null;
  if (raw.type === 'gradient') {
    if (!inRange(raw.angle, 0, 360) || !Array.isArray(raw.stops) || raw.stops.length < 2 || raw.stops.length > 8) return null;
    const stops: GradientStop[] = [];
    for (const stop of raw.stops) {
      if (!isRecord(stop) || !isHex(stop.color) || !inRange(stop.at, 0, 1)) return null;
      stops.push({ color: stop.color, at: stop.at });
    }
    return { type: 'gradient', angle: raw.angle, stops };
  }
  return null;
};

const sanitizeStrokes = (raw: unknown): StrokeLayer[] | null => {
  if (!Array.isArray(raw) || raw.length > 4) return null;
  const strokes: StrokeLayer[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !isHex(item.color) || !inRange(item.width, 0, 50)) return null;
    strokes.push({ color: item.color, width: item.width });
  }
  return strokes;
};

const weightFor = (family: string, weight: unknown): boolean => {
  const primary = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const definition = fontRegistry.find((item) => item.family === primary);
  return Boolean(definition) && typeof weight === 'number' && definition!.availableWeights.includes(weight);
};

/** Devuelve la pila canónica de la familia o null si no está en el registro. */
const canonicalFamily = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw.length > 300) return null;
  const primary = raw.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const definition = fontRegistry.find((item) => item.family === primary);
  return definition ? fontStack(definition) : null;
};

const sanitizeSecondary = (raw: unknown): SecondaryLineStyle | null => {
  if (!isRecord(raw)) return null;
  const family = canonicalFamily(raw.fontFamily);
  const fill = sanitizeFill(raw.fill);
  const strokes = sanitizeStrokes(raw.strokes);
  if (!family || !fill || !strokes) return null;
  if (!weightFor(family, raw.fontWeight) || !inRange(raw.fontSizeScale, 0.1, 3) || !inRange(raw.letterSpacing, -100, 100)) return null;
  if (typeof raw.italic !== 'boolean' || typeof raw.uppercase !== 'boolean') return null;
  return {
    fontFamily: family, fontSizeScale: raw.fontSizeScale, fontWeight: raw.fontWeight as number, italic: raw.italic,
    uppercase: raw.uppercase, letterSpacing: raw.letterSpacing, fill, strokes,
  };
};

export const sanitizeTypography = (raw: unknown): TypographySettings | null => {
  if (!isRecord(raw)) return null;
  const family = canonicalFamily(raw.fontFamily);
  if (!family) return null;
  if (!inRange(raw.fontSize, 1, 1000) || !weightFor(family, raw.fontWeight)) return null;
  if (typeof raw.italic !== 'boolean' || typeof raw.uppercase !== 'boolean') return null;
  if (!isHexOrTransparent(raw.color) || !isHex(raw.strokeColor) || !isHex(raw.shadowColor)) return null;
  if (!inRange(raw.letterSpacing, -100, 100) || !inRange(raw.wordSpacing, -100, 300) || !inRange(raw.lineHeight, 0.3, 4)) return null;
  if (!inRange(raw.strokeWidth, 0, 50) || !inRange(raw.shadowBlur, 0, 200) || !inRange(raw.shadowOpacity, 0, 1)) return null;
  if (raw.textAlign !== 'left' && raw.textAlign !== 'center' && raw.textAlign !== 'right') return null;

  const result: TypographySettings = {
    fontFamily: family, fontSize: raw.fontSize, fontWeight: raw.fontWeight as number, italic: raw.italic, uppercase: raw.uppercase,
    color: raw.color, letterSpacing: raw.letterSpacing, wordSpacing: raw.wordSpacing, lineHeight: raw.lineHeight, textAlign: raw.textAlign,
    strokeColor: raw.strokeColor, strokeWidth: raw.strokeWidth, shadowColor: raw.shadowColor, shadowBlur: raw.shadowBlur, shadowOpacity: raw.shadowOpacity,
  };
  for (const key of ['shadowX', 'shadowY'] as const) {
    if (raw[key] === undefined) continue;
    if (!inRange(raw[key], -200, 200)) return null;
    result[key] = raw[key] as number;
  }
  if (raw.fill !== undefined) { const fill = sanitizeFill(raw.fill); if (!fill) return null; result.fill = fill; }
  if (raw.strokes !== undefined) { const strokes = sanitizeStrokes(raw.strokes); if (!strokes) return null; result.strokes = strokes; }
  if (raw.glow !== undefined && raw.glow !== null) {
    const glow = raw.glow;
    if (!isRecord(glow) || !isHex(glow.color) || !inRange(glow.radius, 0, 100) || !inRange(glow.intensity, 1, 10)) return null;
    result.glow = { color: glow.color, radius: glow.radius, intensity: glow.intensity } satisfies TextGlow;
  } else if (raw.glow === null) result.glow = null;
  if (raw.box !== undefined && raw.box !== null) {
    const box = raw.box;
    if (!isRecord(box) || !isHex(box.color) || !inRange(box.paddingX, 0, 300) || !inRange(box.paddingY, 0, 300) || !inRange(box.radius, 0, 300)) return null;
    result.box = { color: box.color, paddingX: box.paddingX, paddingY: box.paddingY, radius: box.radius } satisfies TextBox;
  } else if (raw.box === null) result.box = null;
  if (raw.secondary !== undefined && raw.secondary !== null) {
    const secondary = sanitizeSecondary(raw.secondary);
    if (!secondary) return null;
    result.secondary = secondary;
  } else if (raw.secondary === null) result.secondary = null;
  return result;
};

/* ------------------------------ validación ------------------------------ */

const sanitizeMotion = (raw: unknown): HandoffMotion | null => {
  if (!isRecord(raw)) return null;
  const known = (id: unknown) => typeof id === 'string' && builtInPresets.some((preset) => preset.id === id);
  if (!known(raw.in)) return null;
  if (raw.out !== null && !known(raw.out)) return null;
  const hold = raw.holdFrames;
  if (!isNum(hold) || !Number.isInteger(hold) || hold < 0 || hold > 36000) return null;
  return { in: raw.in as string, out: raw.out as string | null, holdFrames: hold };
};

/** Valida un valor ya parseado (útil para pruebas). Reconstruye el payload sin campos ajenos. */
export const validateHandoff = (raw: unknown): DecodeResult => {
  if (!isRecord(raw)) return { ok: false, reason: 'bad-json' };
  if (raw.v !== undefined && raw.v !== HANDOFF_VERSION) return { ok: false, reason: 'bad-version' };
  const style = raw.style;
  if (!isRecord(style)) return { ok: false, reason: 'bad-fields' };
  if (style.v !== HANDOFF_VERSION) return { ok: false, reason: 'bad-version' };

  const name = style.name;
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) return { ok: false, reason: 'bad-fields' };
  if (style.templateId !== undefined && (typeof style.templateId !== 'string' || !findTemplate(style.templateId))) return { ok: false, reason: 'bad-fields' };
  const typography = sanitizeTypography(style.typography);
  if (!typography) return { ok: false, reason: 'bad-fields' };
  const highlight = style.highlight;
  if (!isRecord(highlight) || !WORD_MODES.includes(highlight.mode as WordHighlightMode) || !isHex(highlight.color)) return { ok: false, reason: 'bad-fields' };
  const payload: StylePayloadV1 = {
    v: 1, name, typography, highlight: { mode: highlight.mode as WordHighlightMode, color: highlight.color },
  };
  if (style.templateId !== undefined) payload.templateId = style.templateId as string;
  if (style.motion !== undefined) {
    const motion = sanitizeMotion(style.motion);
    if (!motion) return { ok: false, reason: 'bad-fields' };
    payload.motion = motion;
  }

  const value: HandoffV1 = { style: payload };
  if (raw.phrase !== undefined) {
    if (typeof raw.phrase !== 'string' || raw.phrase.length > MAX_PHRASE_LENGTH) return { ok: false, reason: 'bad-fields' };
    value.phrase = raw.phrase;
  }
  return { ok: true, value };
};

/* ------------------------------ codificación ----------------------------- */

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** base64url del JSON UTF-8. No agrega el prefijo `demo=` / `estilo=`. */
export const encodeHandoff = (value: HandoffV1): string => toBase64Url(JSON.stringify({ v: HANDOFF_VERSION, style: value.style, ...(value.phrase !== undefined ? { phrase: value.phrase } : {}) }));

const PREFIX = /^(demo|estilo)=/;

/** Acepta el hash con o sin `#` y con o sin prefijo `demo=`/`estilo=`. Nunca lanza. */
export const decodeHandoff = (hash: string): DecodeResult => {
  if (typeof hash !== 'string') return { ok: false, reason: 'empty' };
  const raw = hash.replace(/^#/, '');
  if (raw.length > MAX_HANDOFF_LENGTH) return { ok: false, reason: 'too-large' };
  const payload = raw.replace(PREFIX, '');
  if (!payload) return { ok: false, reason: 'empty' };
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return { ok: false, reason: 'bad-encoding' };

  let text: string;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: 'bad-encoding' };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, reason: 'bad-json' }; }
  return validateHandoff(parsed);
};

export type HandoffFragment = { kind: 'demo' | 'estilo'; result: DecodeResult };

/** null si el hash no es de este tipo. `#estilo=` descarta cualquier frase. */
export const parseHandoffFragment = (hash: string): HandoffFragment | null => {
  const match = /^#?(demo|estilo)=/.exec(hash ?? '');
  if (!match) return null;
  const kind = match[1] as 'demo' | 'estilo';
  const result = decodeHandoff(hash);
  if (result.ok && kind === 'estilo' && result.value.phrase !== undefined) {
    const { phrase: _ignored, ...rest } = result.value;
    return { kind, result: { ok: true, value: rest } };
  }
  return { kind, result };
};

/* -------------------------------- aplicar -------------------------------- */

const segmentFor = (id: string): AnimationSegment => {
  const preset = structuredClone(builtInPresets.find((item) => item.id === id)!);
  return { preset, overrides: overridesFor(preset) };
};

export const cleanPhrase = (phrase: string) => phrase.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

export type ApplyHandoffOptions = {
  /** Reemplaza el texto de la frase (y sus tiempos por palabra). */
  phrase?: string;
  /** Conserva el tamaño de la frase (default true). */
  keepFontSize?: boolean;
  /** `layer` conserva la pausa de la frase; `payload` usa la del enlace. */
  hold?: 'layer' | 'payload';
  /** Crea tiempos por palabra parejos si la frase no tiene. */
  createWordTiming?: boolean;
};

/** Aplica el estilo a una frase sin mutarla. No toca posición, inicio ni duración manual. */
export const applyHandoffToLayer = (layer: TextLayer, style: StylePayloadV1, options: ApplyHandoffOptions = {}): TextLayer => {
  const keepFontSize = options.keepFontSize ?? true;
  const phrase = options.phrase !== undefined ? cleanPhrase(options.phrase) : '';
  let next: TextLayer = {
    ...layer,
    typography: { ...structuredClone(style.typography), fontSize: keepFontSize ? layer.typography.fontSize : style.typography.fontSize },
  };
  if (phrase) {
    next = {
      ...next, text: phrase, name: phrase.split(/\s+/).filter(Boolean).slice(0, 4).join(' ') || 'Frase vacía',
      keywords: {}, wordTiming: undefined,
    };
  }
  if (style.motion) {
    const entry = segmentFor(style.motion.in);
    const hold = options.hold === 'payload' ? style.motion.holdFrames : animationForLayer(layer).holdFrames;
    const animation: LayerAnimation = { in: entry, holdFrames: hold, out: style.motion.out ? segmentFor(style.motion.out) : null, loop: null };
    next = { ...next, preset: structuredClone(entry.preset), overrides: { ...entry.overrides }, animation };
  }
  if (next.wordTiming && !phrase) next = { ...next, wordTiming: { ...next.wordTiming, mode: style.highlight.mode, color: style.highlight.color } };
  else if (options.createWordTiming || phrase) {
    if (next.wordTiming || options.createWordTiming) next = { ...next, wordTiming: evenWordTiming(next.text, getLayerDuration(next), style.highlight) };
  }
  return next;
};

/** Nombre a mostrar: el de la plantilla si el enlace la nombra. */
export const handoffTitle = (style: StylePayloadV1) => (style.templateId ? findTemplate(style.templateId)?.name : undefined) ?? style.name;

/* -------------------------------- compartir ------------------------------- */

export type StyleShareCheck =
  | { mode: 'full'; payload: StylePayloadV1 }
  | { mode: 'look-only'; payload: StylePayloadV1; reason: string }
  | { mode: 'none'; reason: string };

const sameOverrides = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
};

const builtInSegmentId = (segment: AnimationSegment | null): string | null | undefined => {
  if (!segment) return null;
  const known = builtInPresets.find((preset) => preset.id === segment.preset.id);
  if (!known) return undefined;
  return sameOverrides(segment.overrides as unknown as Record<string, unknown>, overridesFor(known) as unknown as Record<string, unknown>) ? known.id : undefined;
};

const hexSix = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;
  if (HEX6.test(value)) return value;
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(value);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : fallback;
};

/** Qué se puede compartir de esta frase: look + efectos de fábrica + resaltado. Nunca texto ni tiempos. */
export const checkStyleShare = (layer: TextLayer, name = 'Mi look'): StyleShareCheck => {
  const typography = sanitizeTypography(layer.typography);
  if (!typography) return { mode: 'none', reason: 'El look de esta frase usa valores que el enlace no puede llevar (tipografía fuera del registro, colores o rangos no admitidos).' };
  const highlight: HandoffHighlight = {
    mode: WORD_MODES.includes(layer.wordTiming?.mode as WordHighlightMode) ? layer.wordTiming!.mode : 'color',
    color: hexSix(layer.wordTiming?.color, '#FFE94A'),
  };
  const look: StylePayloadV1 = { v: 1, name, typography, highlight };

  const animation = animationForLayer(layer);
  const inId = animation.in ? builtInSegmentId(animation.in) : undefined;
  const outId = builtInSegmentId(animation.out);
  const hold = animation.holdFrames;
  const hasLoop = Boolean(animation.loop && animation.loop.kind !== 'none');
  if (hasLoop || !animation.in || inId === undefined || outId === undefined || !Number.isInteger(hold) || hold < 0 || hold > 36000) {
    return {
      mode: 'look-only', payload: look,
      reason: hasLoop
        ? 'Esta frase tiene un bucle. El enlace sólo lleva efectos de entrada y salida de fábrica.'
        : 'Esta frase usa un efecto guardado por vos o con ajustes propios. El enlace sólo lleva efectos de fábrica.',
    };
  }
  return { mode: 'full', payload: { ...look, motion: { in: inId as string, out: outId, holdFrames: hold } } };
};

/**
 * Arma el enlace `…/editor/#estilo=…`. Verifica que `decodeHandoff` lo acepte y que
 * entre en 4096 caracteres; si no, devuelve el motivo en vez de un enlace roto.
 */
export const buildStyleLink = (payload: StylePayloadV1, origin: string): { ok: true; url: string } | { ok: false; reason: string } => {
  if (!/^https?:\/\/[^/]+$/.test(origin)) return { ok: false, reason: 'No se pudo armar el enlace desde esta dirección.' };
  const encoded = encodeHandoff({ style: payload });
  const url = `${origin}/editor/#estilo=${encoded}`;
  if (url.length > MAX_HANDOFF_LENGTH) return { ok: false, reason: 'El look es demasiado grande para un enlace.' };
  const check = decodeHandoff(`#estilo=${encoded}`);
  if (!check.ok) return { ok: false, reason: 'El enlace no pasó la validación; no se copió.' };
  return { ok: true, url };
};

/** Para pruebas: los ids de plantilla que `templateId` acepta. */
export const knownTemplateIds = (): string[] => captionTemplates.map((item) => item.id);

/** Payload de una plantilla con nombre (lo usa la landing y las pruebas). */
export const payloadFromTemplateId = (templateId: string): StylePayloadV1 => {
  const template = findTemplate(templateId);
  if (!template) throw new Error(`La plantilla no existe: ${templateId}`);
  return {
    v: 1, name: template.name, templateId: template.id, typography: resolveStyleTypography(template.styleId),
    motion: { ...template.motion }, highlight: { ...template.highlight },
  };
};
