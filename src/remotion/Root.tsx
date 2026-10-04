import React from 'react';
import { Composition } from 'remotion';
import { TextComposition } from './TextComposition';
import { defaultCompositionProps } from './defaults';
import type { CompositionProps } from '../types/motion';
import { getCompositionDuration } from '../utils/duration';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="GBMotion"
    component={TextComposition}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={60}
    defaultProps={defaultCompositionProps}
    calculateMetadata={({ props }) => {
      const typed = props as CompositionProps;
      // Con un video detrás la composición dura al menos lo que dura el video.
      return { durationInFrames: Math.max(getCompositionDuration(typed.layers), typed.guide?.durationInFrames ?? 0) };
    }}
  />
);
