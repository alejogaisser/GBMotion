import React from 'react';
import { AbsoluteFill, OffthreadVideo, Video, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from 'remotion';
import type { CompositionProps, KeywordStyle, MotionPreset, TextLayer, TypographySettings } from '../types/motion';
import { interpolatePreset } from '../engine/interpolatePreset';
import { resolvePreset } from '../engine/resolvePreset';
import { buildMotionTransform, buildTransformOrigin } from '../engine/motionModel';
import { animationForLayer, getAnimationPhase } from '../engine/layerAnimation';
import { closestFontWeight, fontFromFamily, fontStack, supportsItalic, type FontDefinition } from '../typography/fontRegistry';
import { tokensForMode } from '../utils/textSegmentation';
import { calculateTextLayout } from '../engine/textLayout';
import { getLayerDuration } from '../utils/duration';
import { normalizeTypography, paintBoxCss, paintCss, scalePaint, secondaryCss } from '../engine/textPaint';
import { activeWord, sampleTransform } from '../engine/editorMotion';
import { revealClip } from '../engine/reveal';
import { ReadableEffect } from './ReadableEffect';
import { isReadableEffect } from '../engine/readableEffects';
import { loopCss } from '../engine/loopMotion';

const backgroundFor = (mode: CompositionProps['background'], custom: string) => {
  if (mode === 'green') return '#00ff00';
  if (mode === 'white') return '#ffffff';
  if (mode === 'custom') return custom;
  if (mode === 'transparent' || mode === 'checker') return 'transparent';
  return '#050505';
};

const keywordCss = (style: KeywordStyle | undefined, font: FontDefinition): React.CSSProperties => style ? {
  color: style.color,
  // Con relleno de degradado el bloque hereda -webkit-text-fill-color:
  // transparent. Sin esto la palabra destacada quedaría invisible.
  WebkitTextFillColor: style.color,
  fontSize: `${style.fontSizeScale}em`,
  fontWeight: closestFontWeight(font, style.fontWeight)
} : {};

const richText = (text: string, keywords: Record<number, KeywordStyle>, font: FontDefinition, activeIndex = -1, activeCss: React.CSSProperties = {}) => {
  let index = -1;
  return text.split(/(\s+)/).map((part, partIndex) => {
    if (!/^\s+$/.test(part)) index += 1;
    return <span key={`${partIndex}-${part}`} style={{ ...keywordCss(keywords[index], font), ...(index === activeIndex && !/^\s+$/.test(part) ? activeCss : {}) }}>{part}</span>;
  });
};

const random = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * Desplaza el primer keyframe de cada unidad para que no entren todas iguales.
 *
 * Los recorridos son cortos a propósito: sobre 1080x1920 una palabra que arranca
 * a 1500px de su lugar no se lee como movimiento, se lee como un salto.
 */
const presetForUnit = (preset: MotionPreset, index: number): MotionPreset => {
  if (!preset.variation || preset.variation === 'none' || preset.variation === 'sphere') return preset;
  const first = { ...(preset.keyframes[0] ?? { frame: 0 }) };
  const r1 = random(index + 1);
  const r2 = random(index + 17);
  const r3 = random(index + 41);

  if (preset.variation === 'rain') {
    first.x = (r1 - 0.5) * 320;
    first.y = -520 - r2 * 380;
    first.rotation = (r3 - 0.5) * 22;
    first.blur = 7 + r1 * 8;
  }
  if (preset.variation === 'random') {
    first.x = (r1 - 0.5) * 660;
    first.y = (r2 - 0.5) * 760;
    first.rotation = (r3 - 0.5) * 46;
    first.scale = 0.5 + r2 * 1.1;
    first.blur = 5 + r3 * 12;
    first.skewX = (r1 - 0.5) * 16;
    first.easingToNext = (['expoOut', 'backOut', 'cubicOut'] as const)[index % 3];
  }
  if (preset.variation === 'orbit') {
    const angle = r1 * Math.PI * 2;
    first.x = Math.cos(angle) * (300 + r2 * 260);
    first.y = Math.sin(angle) * (300 + r2 * 260);
    first.rotateY = (r3 - 0.5) * 70;
    first.rotation = angle * 12;
  }
  if (preset.variation === 'glitch') {
    first.x = (r1 - 0.5) * 130;
    first.y = (r2 - 0.5) * 52;
    first.skewX = (r3 - 0.5) * 26;
    first.scaleX = 0.68 + r1 * 0.75;
    first.blur = 2 + r2 * 5;
  }
  return { ...preset, keyframes: [first, ...preset.keyframes.slice(1)] };
};

const motionCss = (preset: MotionPreset, frame: number, baseLetterSpacing: number, opacityMultiplier = 1): React.CSSProperties => {
  const v = interpolatePreset(preset, frame);
  return {
    clipPath: revealClip(preset, frame),
    opacity: v.opacity * opacityMultiplier,
    filter: `blur(${v.blur}px)`,
    letterSpacing: `${baseLetterSpacing + v.letterSpacing}px`,
    transform: buildMotionTransform(v),
    transformOrigin: buildTransformOrigin(v),
    transformStyle: 'preserve-3d'
  };
};

/**
 * Sólo métricas de la letra.
 *
 * La pintura NO va acá: un relleno con degradado se recorta con
 * `background-clip: text`, y ese recorte no atraviesa a un descendiente que
 * cree su propia capa de composición. Las capas animadas llevan `transform` y
 * `filter`, así que el degradado puesto en el contenedor desaparecía y el texto
 * quedaba invisible. Por eso `paintCss` se aplica en el span que contiene el
 * texto, ni un nivel más arriba.
 */
const typographyCss = (t: TypographySettings, font: FontDefinition, fontSize: number): React.CSSProperties => ({
  fontFamily: fontStack(font),
  fontSize,
  fontWeight: closestFontWeight(font, t.fontWeight),
  fontStyle: t.italic && supportsItalic(font) ? 'italic' : 'normal',
  textTransform: t.uppercase ? 'uppercase' : 'none',
  letterSpacing: t.letterSpacing,
  wordSpacing: t.wordSpacing,
  lineHeight: t.lineHeight,
  textAlign: t.textAlign,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere'
});

const AnimatedTextLayer = ({ layer }: { layer: TextLayer }) => {
  const globalFrame = useCurrentFrame();
  const frame = globalFrame - (layer.startFrame ?? 0);
  const { width, height, fps } = useVideoConfig();
  const phase = getAnimationPhase(layer, frame);
  const transform = sampleTransform(layer.transformKeys, frame);
  const activeIndex = activeWord(layer.wordTiming, frame);
  const activeCss: React.CSSProperties = !layer.wordTiming ? {} : layer.wordTiming.mode === 'box'
    ? { backgroundColor: layer.wordTiming.color, color: '#111111', WebkitTextFillColor: '#111111', borderRadius: '0.12em' }
    : { color: layer.wordTiming.color, WebkitTextFillColor: layer.wordTiming.color };
  // resolvePreset is pure over (preset, overrides); those refs only change when the
  // layer's animation is edited, so don't rebuild it on every rendered frame.
  const segmentPreset = phase.segment?.preset ?? null;
  const segmentOverrides = phase.segment?.overrides ?? null;
  const preset = React.useMemo(
    () => (segmentPreset && segmentOverrides ? resolvePreset(segmentPreset, segmentOverrides) : null),
    [segmentPreset, segmentOverrides],
  );
  const selectedFont = fontFromFamily(layer.typography.fontFamily);
  const layout = calculateTextLayout(layer, { id: 'portrait', label: 'Render', width, height });
  // Los looks se escriben pensando en `typography.fontSize`. Si el ajuste
  // automático achica la letra, el contorno y la sombra tienen que achicarse en
  // la misma proporción o un texto largo termina con un borde desmedido.
  const paintScale = layout.fontSize / Math.max(1, layer.typography.fontSize);
  const paint = React.useMemo(
    () => scalePaint(normalizeTypography(layer.typography), paintScale),
    [layer.typography, paintScale],
  );
  // Un estilo de dos tipografías se define por línea, así que la animación
  // pasa a ir línea por línea aunque el efecto pida palabras o letras.
  const mode = paint.secondary ? 'lines' : preset?.mode ?? 'text';
  const rawUnits = React.useMemo(() => tokensForMode(layer.text, mode), [layer.text, mode]);
  const readable = isReadableEffect(preset) && !paint.secondary && mode !== 'text';
  const units = rawUnits;
  const boxCss = paintBoxCss(paint);
  const loop = animationForLayer(layer).loop ?? null;

  /**
   * El bucle corre en su propio envoltorio. Si compartiera elemento con la
   * entrada, los dos escribirían `transform` y uno pisaría al otro.
   */
  const withLoop = (node: React.ReactNode, unitIndex: number, key: string) => {
    const style = loopCss(loop, frame, fps, unitIndex);
    return style ? <span key={key} style={style}>{node}</span> : node;
  };

  /**
   * Cursor de máquina de escribir. Va detrás de la última unidad revelada, que
   * se deduce del mismo stagger que usa la animación.
   */
  const cursorIndex = preset?.variation === 'cursor'
    ? Math.max(0, Math.min(units.length - 1, Math.floor((phase.timelineFrame - (preset.delay ?? 0)) / Math.max(1, preset.staggerDelay))))
    : -1;
  const cursorVisible = Math.floor(frame / 8) % 2 === 0;
  const frameForUnit = (index: number) => {
    if (!preset) return 0;
    const forwardFrame = phase.timelineFrame - (preset.delay ?? 0) - index * preset.staggerDelay;
    return phase.reverse ? preset.duration - forwardFrame : forwardFrame;
  };
  const opacityForUnit = (index: number) => {
    if (!preset || !phase.fadeOut) return 1;
    const forwardFrame = phase.timelineFrame - (preset.delay ?? 0) - index * preset.staggerDelay;
    return 1 - Math.max(0, Math.min(1, forwardFrame / Math.max(1, preset.duration)));
  };

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        ...typographyCss(layer.typography, selectedFont, layout.fontSize), width: layout.maxWidth, maxHeight: layout.maxHeight, display: mode === 'lines' ? 'flex' : 'block',
        flexDirection: 'column', alignItems: layer.typography.textAlign === 'left' ? 'flex-start' : layer.typography.textAlign === 'right' ? 'flex-end' : 'center',
        whiteSpace: layer.autoLineBreak === false ? 'pre' : 'pre-wrap', overflowWrap: layer.autoLineBreak === false ? 'normal' : 'anywhere',
        opacity: transform.opacity,
        transform: `translate3d(${layer.positionX + transform.x}px, ${layer.positionY + transform.y}px, 0) rotate(${(layer.rotation ?? 0) + transform.rotation}deg) scale(${transform.scale})`, transformStyle: 'preserve-3d'
      }}>
        {readable && preset ? <ReadableEffect text={layer.text} preset={preset} frameForUnit={frameForUnit} opacityForUnit={opacityForUnit}
          width={layout.maxWidth} height={layout.maxHeight} measurementKey={JSON.stringify([layer.typography, layer.keywords, layout.fontSize])}
          wrap={withLoop} wordStyle={(index) => ({ ...paintCss(paint), ...boxCss, ...keywordCss(layer.keywords[index], selectedFont), ...(index === activeIndex ? activeCss : {}) })}
        /> : !preset || mode === 'text' ? (
          withLoop(
          <div style={preset ? motionCss(preset, frameForUnit(0), layer.typography.letterSpacing, opacityForUnit(0)) : undefined}>
            {/* En línea a propósito: con box-decoration-break: clone la caja se
                repite por renglón en vez de envolver el bloque entero. */}
            <span style={{ ...paintCss(paint), ...boxCss }}>{richText(layer.text, layer.keywords, selectedFont, activeIndex, activeCss)}</span>
          </div>, 0, 'loop-text')
        ) : units.map((unit) => {
          if (!unit.animate) return <span key={`space-${unit.animationIndex}-${unit.content}`} style={{ ...paintCss(paint), whiteSpace: 'pre-wrap' }}>{unit.content}</span>;
          const unitPreset = presetForUnit(preset, unit.animationIndex);
          const animated = (
            <span style={{
              ...motionCss(unitPreset, frameForUnit(unit.animationIndex), layer.typography.letterSpacing, opacityForUnit(unit.animationIndex)),
              display: 'inline-block',
              whiteSpace: mode === 'words' ? 'nowrap' : 'pre-wrap',
              overflowWrap: mode === 'words' ? 'normal' : undefined,
            }}>
              <span style={{
                ...paintCss(paint),
                ...(paint.secondary && unit.animationIndex > 0 ? secondaryCss(paint.secondary, paintScale) : {}),
                ...keywordCss(unit.wordIndex === undefined ? undefined : layer.keywords[unit.wordIndex], selectedFont),
                ...boxCss,
                ...(unit.wordIndex === activeIndex ? activeCss : {}),
                display: 'inline-block',
                whiteSpace: mode === 'words' ? 'nowrap' : 'pre-wrap',
                overflowWrap: mode === 'words' ? 'normal' : undefined,
              }}>{mode === 'lines' && layer.wordTiming ? richText(unit.content, {}, selectedFont, activeIndex - units.filter((u) => u.animationIndex < unit.animationIndex).reduce((n, u) => n + (u.content.match(/\S+/g)?.length ?? 0), 0), activeCss) : unit.content}</span>
            </span>
          );
          const cursor = unit.animationIndex === cursorIndex ? (
            <span aria-hidden="true" style={{
              ...paintCss(paint),
              display: 'inline-block',
              opacity: cursorVisible ? 1 : 0,
              marginLeft: '0.04em',
            }}>▌</span>
          ) : null;
          const body = <>{withLoop(animated, unit.animationIndex, `loop-${unit.animationIndex}`)}{cursor}</>;
          return <span key={`${unit.animationIndex}-${unit.content}`} style={{ display: mode === 'lines' ? 'block' : 'inline' }}>{body}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

export const TextComposition: React.FC<CompositionProps> = (props) => {
  const isChecker = props.background === 'checker';
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  const guideStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  return (
    <AbsoluteFill style={{
      backgroundColor: backgroundFor(props.background, props.customBackground),
      backgroundImage: isChecker ? 'linear-gradient(45deg,#25282d 25%,transparent 25%),linear-gradient(-45deg,#25282d 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#25282d 75%),linear-gradient(-45deg,transparent 75%,#25282d 75%)' : undefined,
      backgroundSize: isChecker ? '64px 64px' : undefined,
      backgroundPosition: isChecker ? '0 0,0 32px,32px -32px,-32px 0' : undefined,
      overflow: 'hidden'
    }}>
      {/* El video va detrás de todo. En la vista previa es un <Video> normal; al
          renderizar («Video con tus subtítulos») es <OffthreadVideo>, que saca los
          cuadros exactos y mezcla el audio. Para el verde/MP4/alfa el servidor borra
          `guide`, así que esos exports salen sin video. */}
      {props.guide && (
        <AbsoluteFill>
          {isRendering
            ? <OffthreadVideo src={props.guide.src} volume={props.guide.volume} style={guideStyle} />
            : <Video src={props.guide.src} volume={props.guide.volume} style={guideStyle} />}
        </AbsoluteFill>
      )}
      {props.layers.filter((layer) => {
        const start = Math.max(0, layer.startFrame ?? 0);
        return layer.visible && frame >= start && frame < start + getLayerDuration(layer);
      }).map((layer) => <AnimatedTextLayer key={layer.id} layer={layer} />)}
    </AbsoluteFill>
  );
};
