import { overridesFor } from '../remotion/defaults';
import type { AnimationSegment, ComboPreset } from '../types/motion';
import { builtInPresets } from './builtins';
import { builtInStylePresets } from './styles';

const motion = (id: string): AnimationSegment => {
  const preset = builtInPresets.find((item) => item.id === id) ?? builtInPresets[0];
  return { preset, overrides: overridesFor(preset) };
};

const typography = (id: string) => {
  const found = builtInStylePresets.find((item) => item.id === id);
  if (!found) throw new Error(`La combinación apunta a un estilo que no existe: ${id}`);
  return { ...found.typography };
};

export const builtInComboPresets: ComboPreset[] = [
  {
    id: 'combo-editorial-cinema',
    name: 'Editorial cinematográfico',
    description: 'Elegante, profundo y con una salida de cámara.',
    typography: typography('edi-playfair'),
    animation: { in: motion('perspective-zoom'), holdFrames: 48, out: motion('camera-slam') },
  },
  {
    id: 'combo-tech-impact',
    name: 'Tecnología con impacto',
    description: 'Verde GB, caída potente y salida frontal.',
    typography: typography('imp-lima'),
    animation: { in: motion('meteor-drop'), holdFrames: 36, out: motion('camera-slam') },
  },
  {
    id: 'combo-clean-social',
    name: 'Social claro',
    description: 'Palabras legibles con entrada y salida lateral.',
    typography: typography('sub-blanco'),
    animation: { in: motion('word-cascade'), holdFrames: 54, out: motion('side-swipe') },
  },
];
