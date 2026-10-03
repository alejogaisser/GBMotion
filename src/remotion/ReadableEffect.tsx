import React, { useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import type { MotionPreset } from '../types/motion';
import { tokenizeWords } from '../utils/textSegmentation';
import { circleOrigins, readableWordMotion, type WordBox } from '../engine/readableEffects';

/** Measure untransformed word anchors after fonts load; preview and render use identical geometry. */
export function ReadableEffect({ text, preset, frameForUnit, opacityForUnit, width, height, measurementKey, wordStyle, wrap }: {
  text: string; preset: MotionPreset; frameForUnit: (index: number) => number; opacityForUnit: (index: number) => number;
  width: number; height: number; measurementKey: string; wordStyle: (index: number) => React.CSSProperties;
  wrap: (node: React.ReactNode, index: number, key: string) => React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<WordBox[]>([]);
  useLayoutEffect(() => {
    const handle = delayRender('Medir palabras del efecto');
    let disposed = false;
    void document.fonts.ready.then(() => {
      if (!disposed && root.current) {
        const container = root.current;
        setBoxes(Array.from(container.querySelectorAll<HTMLElement>('[data-word-anchor]')).map((el) => ({ x: el.offsetLeft + el.offsetWidth / 2 - container.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 - container.offsetHeight / 2, width: el.offsetWidth, height: el.offsetHeight })));
      }
    }).finally(() => continueRender(handle));
    return () => { disposed = true; continueRender(handle); };
  }, [text, width, height, measurementKey]);
  const origins = circleOrigins(boxes, width, height);
  return <div ref={root} data-readable-effect={preset.variation} style={{ position: 'relative', overflowWrap: 'normal' }}>
    {tokenizeWords(text).map((unit, i) => {
      if (!unit.animate) return <React.Fragment key={`space-${i}`}>{unit.content}</React.Fragment>;
      const index = unit.animationIndex;
      const values = readableWordMotion(preset, index, frameForUnit(index), boxes[index] ?? { x: 0, y: 0, width: 100, height: 100 }, origins[index] ?? { x: 0, y: 0, scale: 0.8 });
      return <span key={`word-${i}`} data-word-anchor={index} style={{ display: 'inline-block', whiteSpace: 'nowrap', overflowWrap: 'normal' }}>
        {wrap(<span data-readable-transform={index} style={{ display: 'inline-block', opacity: values.opacity * opacityForUnit(index), transform: `translate(${values.x}px, ${values.y}px) scale(${values.scale})`, transformOrigin: 'center' }}><span style={wordStyle(index)}>{unit.content}</span></span>, index, `loop-${index}`)}
      </span>;
    })}
  </div>;
}
