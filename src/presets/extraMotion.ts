import type { MotionPreset } from '../types/motion';

export const extraMotionPresets: MotionPreset[] = [
  { id: 'mask-left', name: 'Cortina lateral', category: 'REVEAL', description: 'Una máscara descubre la frase de izquierda a derecha.', duration: 24, mode: 'text', staggerDelay: 0, easing: 'linear', mask: 'left', keyframes: [{ frame: 0, opacity: 1 }, { frame: 24, opacity: 1 }] },
  { id: 'mask-center', name: 'Apertura central', category: 'REVEAL', description: 'El texto se abre desde el centro hacia ambos lados.', duration: 24, mode: 'text', staggerDelay: 0, easing: 'linear', mask: 'center', keyframes: [{ frame: 0, opacity: 1 }, { frame: 24, opacity: 1 }] },
  { id: 'mask-lines', name: 'Persiana por líneas', category: 'REVEAL', description: 'Cada renglón se descubre desde abajo con un pequeño desfase.', duration: 18, mode: 'lines', staggerDelay: 5, easing: 'linear', mask: 'bottom', keyframes: [{ frame: 0, opacity: 1 }, { frame: 18, opacity: 1 }] },
  { id: 'tracking-focus', name: 'Enfoque editorial', category: 'LETTERS', description: 'Las letras se acercan y se enfocan hasta formar el titular.', duration: 26, mode: 'text', staggerDelay: 0, easing: 'cubicOut', keyframes: [{ frame: 0, opacity: 0, letterSpacing: 24, blur: 8, scale: 0.96 }, { frame: 26, opacity: 1, letterSpacing: 0, blur: 0, scale: 1 }] },
  { id: 'hinge-word', name: 'Palabras con bisagra', category: '3D', description: 'Las palabras se despliegan como pequeñas tarjetas.', duration: 20, mode: 'words', staggerDelay: 4, easing: 'cubicOut', keyframes: [{ frame: 0, opacity: 0, rotateY: -85, transformOriginX: 0, perspective: 1000 }, { frame: 20, opacity: 1, rotateY: 0, transformOriginX: 0, perspective: 1000 }] },
  { id: 'mask-close', name: 'Cierre de cortina', category: 'REVEAL', description: 'La frase se oculta de derecha a izquierda.', duration: 20, mode: 'text', staggerDelay: 0, easing: 'linear', intent: 'out', mask: 'left', keyframes: [{ frame: 0, opacity: 1 }, { frame: 20, opacity: 1 }] },
];
