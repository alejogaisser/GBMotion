import type { CompositionProps, VideoFormat } from '../src/types/motion.ts';
import { videoFormats } from '../src/types/motion.ts';
import { validateMotionPreset } from '../src/engine/validation.ts';
import { isTypography, isLayerAnimation } from '../src/utils/storage.ts';
import { HttpError } from './http.ts';

export type ExportKind = 'mp4' | 'green' | 'alpha' | 'alpha-webm' | 'burn';
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nonnegative = (v: unknown) => finite(v) && v >= 0;
const finiteTree = (v: unknown): boolean => typeof v === 'number' ? Number.isFinite(v)
  : Array.isArray(v) ? v.every(finiteTree) : record(v) ? Object.values(v).every(finiteTree) : true;
export const isSupportedFormat = (value: unknown): value is VideoFormat => record(value)
  && videoFormats.some((f) => f.id === value.id && f.width === value.width && f.height === value.height);

const fill = (v: unknown): boolean => record(v) && (v.type === 'solid' ? typeof v.color === 'string'
  : v.type === 'gradient' && finite(v.angle) && Array.isArray(v.stops) && v.stops.length >= 2 && v.stops.every((s) => record(s) && typeof s.color === 'string' && finite(s.at)));
const strokes = (v: unknown): boolean => Array.isArray(v) && v.every((s) => record(s) && typeof s.color === 'string' && nonnegative(s.width));
const typography = (v: unknown): boolean => {
  if (!isTypography(v) || v.fontSize <= 0 || v.lineHeight <= 0) return false;
  if (v.fill !== undefined && !fill(v.fill) || v.strokes !== undefined && !strokes(v.strokes)) return false;
  if (v.glow != null && (!record(v.glow) || typeof v.glow.color !== 'string' || !nonnegative(v.glow.radius) || !nonnegative(v.glow.intensity))) return false;
  if (v.box != null && (!record(v.box) || typeof v.box.color !== 'string' || !['paddingX', 'paddingY', 'radius'].every((k) => nonnegative((v.box as unknown as Record<string, unknown>)[k])))) return false;
  if (v.secondary != null && (!record(v.secondary) || typeof v.secondary.fontFamily !== 'string' || !finite(v.secondary.fontSizeScale) || v.secondary.fontSizeScale <= 0 || !finite(v.secondary.fontWeight)
    || typeof v.secondary.italic !== 'boolean' || typeof v.secondary.uppercase !== 'boolean' || !finite(v.secondary.letterSpacing) || !fill(v.secondary.fill) || !strokes(v.secondary.strokes))) return false;
  return true;
};
const overrides = (v: unknown): boolean => record(v)
  && ['duration', 'delay', 'initialScale', 'scaleX', 'scaleY', 'x', 'y', 'translateZ', 'rotation', 'opacity', 'blur', 'skewX', 'skewY', 'animatedLetterSpacing', 'overshoot', 'perspective', 'rotateX', 'rotateY', 'transformOriginX', 'transformOriginY', 'spring', 'bounce', 'staggerDelay'].every((k) => finite(v[k]))
  && nonnegative(v.duration) && nonnegative(v.delay) && nonnegative(v.staggerDelay)
  && ['text', 'words', 'letters', 'lines'].includes(String(v.mode))
  && ['linear', 'easeIn', 'easeOut', 'easeInOut', 'quadOut', 'cubicOut', 'expoOut', 'backOut'].includes(String(v.easing))
  && ['CENTER', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'CUSTOM'].includes(String(v.anchor));
const segment = (v: unknown) => v === null || (record(v) && validateMotionPreset(v.preset).valid && overrides(v.overrides));
const layer = (v: unknown): boolean => {
  if (!record(v) || !finiteTree(v)) return false;
  if (!['id', 'name', 'text'].every((k) => typeof v[k] === 'string') || !v.id) return false;
  if (!validateMotionPreset(v.preset).valid || !typography(v.typography) || !overrides(v.overrides) || !record(v.keywords)) return false;
  if (!Object.values(v.keywords).every((k) => record(k) && typeof k.word === 'string' && typeof k.color === 'string' && finite(k.fontSizeScale) && k.fontSizeScale > 0 && finite(k.fontWeight))) return false;
  if (!['positionX', 'positionY', 'rotation', 'maxWidth', 'maxHeight', 'safeZone'].every((k) => finite(v[k])) || !nonnegative(v.startFrame)) return false;
  if (!['visible', 'locked', 'autoFit', 'autoLineBreak'].every((k) => typeof v[k] === 'boolean')) return false;
  if (v.durationFrames !== undefined && (!finite(v.durationFrames) || v.durationFrames <= 0)) return false;
  if (v.animation !== undefined && (!isLayerAnimation(v.animation) || !segment(v.animation.in) || !segment(v.animation.out))) return false;
  if (record(v.animation) && v.animation.loop != null) {
    const loop = v.animation.loop;
    if (!record(loop) || !['none', 'breathe', 'heartbeat', 'float', 'wave', 'swing', 'shake', 'pulse', 'blink', 'spin', 'drift', 'glitch'].includes(String(loop.kind)) || !nonnegative(loop.speed) || !nonnegative(loop.intensity) || typeof loop.perUnit !== 'boolean') return false;
  }
  if (v.transformKeys !== undefined && (!Array.isArray(v.transformKeys) || !v.transformKeys.every((k) => record(k) && nonnegative(k.frame) && ['x', 'y', 'scale', 'rotation', 'opacity'].every((key) => finite(k[key])) && ['linear', 'smooth'].includes(String(k.easing))))) return false;
  if (v.wordTiming !== undefined) {
    if (!record(v.wordTiming) || !['color', 'box', 'karaoke', 'reveal', 'scale'].includes(String(v.wordTiming.mode))
      || typeof v.wordTiming.color !== 'string' || !Array.isArray(v.wordTiming.words)) return false;
    if (!v.wordTiming.words.every((w) => record(w) && typeof w.word === 'string' && nonnegative(w.start) && finite(w.end) && w.end >= Number(w.start))) return false;
  }
  return true;
};

/** Ninguna reserva de render se hace antes de esta validación pura. */
export const validateRenderInput = (body: unknown): { props: CompositionProps; format: VideoFormat; kind: ExportKind; media?: Record<string, unknown> } => {
  if (!record(body) || !record(body.props) || !Array.isArray(body.props.layers) || body.props.layers.length < 1 || body.props.layers.length > 400
    || !body.props.layers.every(layer)) throw new HttpError(400, 'El proyecto tiene frases o tiempos inválidos. Revisá los datos del video.');
  if (!['black', 'white', 'green', 'checker', 'custom', 'transparent'].includes(String(body.props.background)) || typeof body.props.customBackground !== 'string') throw new HttpError(400, 'El fondo del video no es válido.');
  if (!isSupportedFormat(body.format)) throw new HttpError(400, 'Ese tamaño de video no está disponible.');
  if (!['mp4', 'green', 'alpha', 'alpha-webm', 'burn'].includes(String(body.kind))) throw new HttpError(400, 'Ese tipo de exportación no está disponible.');
  return { props: { ...body.props } as CompositionProps, format: body.format, kind: body.kind as ExportKind, media: record(body.media) ? body.media : undefined };
};
