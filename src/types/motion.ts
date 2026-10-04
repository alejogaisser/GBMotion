export type TransformKey = { frame: number; x: number; y: number; scale: number; rotation: number; opacity: number; easing: 'linear' | 'smooth' };
export type WordHighlightMode = 'color' | 'box' | 'karaoke' | 'reveal' | 'scale';
export type WordTiming = { mode: WordHighlightMode; color: string; words: { word: string; start: number; end: number }[] };
export type AnimationMode = 'text' | 'words' | 'letters' | 'lines';
export type PresetCategory = 'REVEAL' | 'ZOOM' | 'IMPACT' | 'SLIDE' | 'BLUR' | '3D' | 'WORDS' | 'LETTERS' | 'EPIC';
export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'quadOut' | 'cubicOut' | 'expoOut' | 'backOut';
export type MotionVariation = 'none' | 'rain' | 'sphere' | 'random' | 'orbit' | 'glitch' | 'cursor';
export type MotionDynamics = 'none' | 'spring';
export type AnchorPreset = 'CENTER' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'CUSTOM';

export type MotionValues = {
  x: number;
  y: number;
  translateZ: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  blur: number;
  skewX: number;
  skewY: number;
  letterSpacing: number;
  perspective: number;
  rotateX: number;
  rotateY: number;
  transformOriginX: number;
  transformOriginY: number;
};

export type MotionKeyframe = Partial<MotionValues> & {
  frame: number;
  easingToNext?: EasingName;
  dynamicsToNext?: MotionDynamics;
  /** @deprecated Read for V1 compatibility. New presets must use easingToNext. */
  easing?: EasingName;
};

export type MotionPreset = {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  duration: number;
  mode: AnimationMode;
  staggerDelay: number;
  delay?: number;
  easing: EasingName;
  overshoot?: number;
  spring?: number;
  bounce?: number;
  variation?: MotionVariation;
  intent?: 'in' | 'out' | 'both';
  keyframes: MotionKeyframe[];
  custom?: boolean;
  mask?: 'left' | 'center' | 'bottom';
};

/* ============================================================================
 * Bucle: el movimiento que corre mientras el texto está en pantalla, aparte de
 * la entrada y la salida. Es la tercera pista, igual que en CapCut.
 * ========================================================================== */

export type LoopKind =
  | 'none' | 'breathe' | 'heartbeat' | 'float' | 'wave' | 'swing'
  | 'shake' | 'pulse' | 'blink' | 'spin' | 'drift' | 'glitch';

export type LoopAnimation = {
  kind: LoopKind;
  /** Ciclos por segundo. */
  speed: number;
  /** Cuánto se nota: 0 lo apaga, 1 es el valor de fábrica, 2 exagera. */
  intensity: number;
  /** Desfasa palabras o letras. Lo que convierte "flotar" en "ola". */
  perUnit: boolean;
};

export type AnimationSegment = {
  preset: MotionPreset;
  overrides: MotionOverrides;
};

export type LayerAnimation = {
  in: AnimationSegment | null;
  holdFrames: number;
  out: AnimationSegment | null;
  /** Ausente en proyectos guardados antes de que existiera la pista de bucle. */
  loop?: LoopAnimation | null;
};

/* ============================================================================
 * Pintura del texto (look). Todo lo de acá es opcional: un proyecto guardado
 * antes de esta versión sigue abriendo y se completa con `normalizeTypography`.
 * ========================================================================== */

export type GradientStop = { color: string; at: number };

/** Relleno de la letra: color plano o degradado recortado sobre el texto. */
export type TextFill =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; angle: number; stops: GradientStop[] };

/** Contorno. El primero se pinta con -webkit-text-stroke; el resto con filtros. */
export type StrokeLayer = { color: string; width: number };

/** Resplandor tipo neón, separado de la sombra. */
export type TextGlow = { color: string; radius: number; intensity: number };

/** Caja de color detrás del texto, línea por línea. */
export type TextBox = { color: string; paddingX: number; paddingY: number; radius: number };

/** Estilo de las líneas 2 en adelante, para frases con dos tipografías. */
export type SecondaryLineStyle = {
  fontFamily: string;
  fontSizeScale: number;
  fontWeight: number;
  italic: boolean;
  uppercase: boolean;
  letterSpacing: number;
  fill: TextFill;
  strokes: StrokeLayer[];
};

export type StyleCategory = 'basicos' | 'impacto' | 'neon' | 'editorial' | 'retro' | 'manuscritas' | 'tech' | 'mios';

export type TextStylePreset = {
  id: string;
  name: string;
  description: string;
  category: StyleCategory;
  typography: TypographySettings;
  /** Texto corto con el que se dibuja la miniatura cuando la capa está vacía. */
  sample?: string;
  custom?: boolean;
};

export type ComboPreset = {
  id: string;
  name: string;
  description: string;
  typography: TypographySettings;
  animation: LayerAnimation;
  custom?: boolean;
};

export type FormatId = 'portrait' | 'landscape' | 'square';
export type BackgroundMode = 'black' | 'white' | 'green' | 'checker' | 'custom' | 'transparent';

export type TypographySettings = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  uppercase: boolean;
  color: string;
  letterSpacing: number;
  wordSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity: number;

  /* --- Pintura (opcional; ver normalizeTypography en engine/textPaint.ts) --- */
  /** Relleno. Si falta, se deriva de `color`. */
  fill?: TextFill;
  /** Contornos apilados, del más interno al más externo. Si falta, se deriva de strokeColor/strokeWidth. */
  strokes?: StrokeLayer[];
  /** Desplazamiento de la sombra. Con blur 0 da el efecto 3D duro. */
  shadowX?: number;
  shadowY?: number;
  glow?: TextGlow | null;
  box?: TextBox | null;
  secondary?: SecondaryLineStyle | null;
};

export type KeywordStyle = {
  word: string;
  color: string;
  fontSizeScale: number;
  fontWeight: number;
};

export type MotionOverrides = {
  duration: number;
  delay: number;
  initialScale: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
  translateZ: number;
  rotation: number;
  opacity: number;
  blur: number;
  skewX: number;
  skewY: number;
  animatedLetterSpacing: number;
  overshoot: number;
  perspective: number;
  rotateX: number;
  rotateY: number;
  transformOriginX: number;
  transformOriginY: number;
  anchor: AnchorPreset;
  spring: number;
  bounce: number;
  staggerDelay: number;
  mode: AnimationMode;
  easing: EasingName;
};

/**
 * Video de referencia para encajar los subtítulos con la imagen y el audio.
 *
 * `src` es un blob de la pestaña, o `/media/<id>` cuando el video ya se subió al
 * servidor local (`mediaId`). Los blobs nunca llegan al render: para exportar con
 * el video adentro el servidor arma la URL a partir de `mediaId`.
 */
export type VideoGuide = {
  waveform?: number[];
  /** Id del video subido al servidor local (`POST /api/media`). */
  mediaId?: string;
  src: string;
  name: string;
  durationInFrames: number;
  /** 0 a 1. El audio es lo que más sirve para calzar el texto con lo hablado. */
  volume: number;
};

export type CompositionProps = {
  layers: TextLayer[];
  background: BackgroundMode;
  customBackground: string;
  /** Ausente al exportar: el MP4 nunca lleva el video de guía. */
  guide?: VideoGuide | null;
};

export type TextLayer = {
  transformKeys?: TransformKey[];
  wordTiming?: WordTiming;
  id: string;
  name: string;
  text: string;
  preset: MotionPreset;
  typography: TypographySettings;
  keywords: Record<number, KeywordStyle>;
  overrides: MotionOverrides;
  /** V2 animation sequence. Missing only on legacy project payloads. */
  animation?: LayerAnimation;
  positionX: number;
  positionY: number;
  rotation: number;
  startFrame: number;
  /**
   * Manual clip length in frames. When absent the clip lasts exactly as long as
   * its animation (entrada + pausa + salida), so the "Tiempo visible" control and
   * combo out-animations are honored. Set only when the person drags the timeline
   * clip edge or types a number.
   */
  durationFrames?: number;
  visible: boolean;
  locked: boolean;
  /** Normalized canvas ratios. 0.84 means 84% of the selected video format. */
  maxWidth: number;
  maxHeight: number;
  autoFit: boolean;
  autoLineBreak: boolean;
  /** Margin reserved on every canvas edge. 0.08 means an 8% safe zone. */
  safeZone: number;
};

export type VideoFormat = { id: FormatId; label: string; width: number; height: number };

/** Los únicos tamaños que se pueden exportar. Los comparten la app y el servidor de render. */
export const videoFormats: VideoFormat[] = [
  { id: 'portrait', label: '1080 × 1920 · 9:16', width: 1080, height: 1920 },
  { id: 'landscape', label: '1920 × 1080 · 16:9', width: 1920, height: 1080 },
  { id: 'square', label: '1080 × 1080 · 1:1', width: 1080, height: 1080 },
];
