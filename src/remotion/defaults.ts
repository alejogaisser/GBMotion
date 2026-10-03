import { defaultPreset } from '../presets/builtins';
import type { CompositionProps, MotionOverrides, MotionPreset, TextLayer, TypographySettings, VideoFormat } from '../types/motion';
import { fontById, fontStack } from '../typography/fontRegistry';

export const formats: VideoFormat[] = [
  { id: 'portrait', label: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
  { id: 'landscape', label: '1920 × 1080 · 16:9', width: 1920, height: 1080 },
  { id: 'square', label: '1080 × 1080 · 1:1', width: 1080, height: 1080 }
];

/**
 * El look con el que arranca la app: el subtítulo blanco con contorno negro.
 * Es el estilo `sub-blanco` de la biblioteca; se copia acá en vez de
 * importarse para no crear un ciclo entre `presets/` y `remotion/`.
 */
export const defaultTypography: TypographySettings = {
  fontFamily: fontStack(fontById('inter')), fontSize: 132, fontWeight: 900, italic: false,
  uppercase: true, color: '#ffffff', letterSpacing: -3, wordSpacing: 0, lineHeight: 1.02, textAlign: 'center',
  strokeColor: '#000000', strokeWidth: 7, shadowColor: '#000000', shadowBlur: 16, shadowOpacity: 0.4,
  shadowX: 0, shadowY: 6,
  fill: { type: 'solid', color: '#ffffff' },
  strokes: [{ color: '#000000', width: 7 }],
  glow: null, box: null, secondary: null,
};

export const overridesFor = (preset = defaultPreset): MotionOverrides => {
  const first = preset.keyframes[0] ?? { frame: 0 };
  const last = preset.keyframes[preset.keyframes.length - 1] ?? { frame: preset.duration };
  return {
    duration: Math.max(1, last.frame - first.frame || preset.duration),
    delay: preset.delay ?? Math.max(0, first.frame),
    initialScale: first.scale ?? 1,
    scaleX: first.scaleX ?? 1,
    scaleY: first.scaleY ?? 1,
    x: first.x ?? 0,
    y: first.y ?? 0,
    translateZ: first.translateZ ?? 0,
    rotation: first.rotation ?? 0,
    opacity: first.opacity ?? 1,
    blur: first.blur ?? 0,
    skewX: first.skewX ?? 0,
    skewY: first.skewY ?? 0,
    animatedLetterSpacing: first.letterSpacing ?? 0,
    overshoot: preset.overshoot ?? Math.max(1, ...preset.keyframes.slice(1, -1).map((item) => item.scale ?? 1)),
    perspective: first.perspective ?? 1200,
    rotateX: first.rotateX ?? 0,
    rotateY: first.rotateY ?? 0,
    transformOriginX: first.transformOriginX ?? 50,
    transformOriginY: first.transformOriginY ?? 50,
    anchor: (first.transformOriginX ?? 50) === 50 && (first.transformOriginY ?? 50) === 50 ? 'CENTER' : 'CUSTOM',
    spring: preset.spring ?? 0,
    bounce: preset.bounce ?? 0,
    staggerDelay: preset.staggerDelay,
    mode: preset.mode,
    easing: preset.easing
  };
};

export const createTextLayer = (text = 'ESCRIBÍ TU FRASE ACÁ', id = 'text-1', preset: MotionPreset = defaultPreset): TextLayer => {
  const overrides = overridesFor(preset);
  return {
    id,
    name: text.split(/\s+/).filter(Boolean).slice(0, 3).join(' ') || 'Texto nuevo',
    text,
    preset,
    typography: { ...defaultTypography },
    keywords: {},
    overrides,
    animation: { in: { preset, overrides: { ...overrides } }, holdFrames: 30, out: null, loop: null },
    positionX: 0,
    positionY: 0,
    rotation: 0,
    startFrame: 0,
    // durationFrames omitted on purpose: the clip auto-sizes to its animation
    // until the person overrides it from the timeline.
    visible: true,
    locked: false,
    maxWidth: 0.84,
    maxHeight: 0.84,
    autoFit: true,
    autoLineBreak: true,
    safeZone: 0.08,
  };
};

export const defaultCompositionProps: CompositionProps = {
  layers: [createTextLayer()], background: 'black', customBackground: '#121212'
};
