import { useMemo } from 'react';
import { Player } from '@remotion/player';
import type { MotionPreset, TextLayer } from '../types/motion';
import { TextComposition } from '../remotion/TextComposition';
import { overridesFor } from '../remotion/defaults';
import { getLayerDuration } from '../utils/duration';
import { cloneLayer } from '../utils/editor';

export function MotionPreview({ preset, layer, track }: { preset: MotionPreset; layer: TextLayer; track: 'in' | 'out' }) {
  const preview = useMemo(() => {
    const copy = cloneLayer(layer);
    copy.startFrame = 0; copy.durationFrames = undefined; copy.positionX = 0; copy.positionY = 0; copy.rotation = 0;
    copy.visible = true; copy.text = layer.text.trim() || 'Tu próxima idea';
    copy.typography.fontSize = 110;
    const segment = { preset, overrides: overridesFor(preset) };
    copy.preset = preset; copy.overrides = segment.overrides;
    copy.animation = { in: track === 'in' ? segment : null, holdFrames: 20, out: track === 'out' ? segment : null };
    return copy;
  }, [preset, layer, track]);
  return <span className="real-motion-preview" aria-hidden="true"><Player component={TextComposition}
    inputProps={{ layers: [preview], background: 'transparent', customBackground: '#000000' }}
    durationInFrames={getLayerDuration(preview)} compositionWidth={960} compositionHeight={540} fps={30}
    autoPlay loop initiallyMuted controls={false} clickToPlay={false} doubleClickToFullscreen={false}
    acknowledgeRemotionLicense style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
  /></span>;
}
