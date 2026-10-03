import { extraMotionPresets } from './extraMotion.ts';
import type { MotionPreset } from '../types/motion';

export const builtInPresets: MotionPreset[] = [
  {
    id: 'depth-punch', name: 'Depth Punch', category: 'ZOOM', duration: 18, mode: 'text', staggerDelay: 0,
    description: 'Desde cámara hacia su posición con profundidad y overshoot.', easing: 'expoOut', overshoot: 1.06,
    keyframes: [
      { frame: 0, scale: 2.6, blur: 12, rotation: -1.5, opacity: 1, easingToNext: 'expoOut' },
      { frame: 11, scale: 0.98, blur: 1, rotation: 0.2, easingToNext: 'easeOut' },
      { frame: 15, scale: 1.035, blur: 0, rotation: 0, easingToNext: 'easeInOut' },
      { frame: 18, scale: 1 }
    ]
  },
  {
    id: 'camera-slam', name: 'Camera Slam', category: 'IMPACT', duration: 18, mode: 'text', staggerDelay: 0, intent: 'out',
    description: 'Golpe frontal que atraviesa virtualmente la cámara.', easing: 'expoOut',
    keyframes: [{ frame: 0, scale: 1, blur: 0, easingToNext: 'easeOut' }, { frame: 8, scale: 1.05, blur: 0, easingToNext: 'easeIn' }, { frame: 18, scale: 2.9, blur: 16, opacity: 0 }]
  },
  {
    id: 'elastic-pop', name: 'Elastic Pop', category: 'IMPACT', duration: 22, mode: 'text', staggerDelay: 0,
    description: 'Entrada elástica rápida con rebotes controlados.', easing: 'backOut', spring: 0.45, bounce: 0.1,
    keyframes: [{ frame: 0, scale: 0.3, opacity: 0, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 9, scale: 1.09, opacity: 1, easingToNext: 'easeInOut' }, { frame: 15, scale: 0.985, easingToNext: 'easeOut' }, { frame: 22, scale: 1 }]
  },
  {
    id: 'hard-zoom', name: 'Hard Zoom', category: 'ZOOM', duration: 11, mode: 'text', staggerDelay: 0,
    description: 'Zoom seco, rápido y sin rebote para keywords.', easing: 'expoOut',
    keyframes: [{ frame: 0, scale: 2.1, blur: 7, easingToNext: 'expoOut' }, { frame: 11, scale: 1, blur: 0 }]
  },
  {
    id: 'diagonal-hit', name: 'Diagonal Hit', category: 'SLIDE', duration: 17, mode: 'text', staggerDelay: 0,
    description: 'Entrada diagonal violenta con rotación.', easing: 'expoOut', overshoot: 1.03,
    keyframes: [{ frame: 0, x: 400, y: 340, rotation: 7, blur: 10, opacity: 0, easingToNext: 'expoOut' }, { frame: 11, x: -12, y: -9, rotation: -0.6, blur: 0, opacity: 1, easingToNext: 'easeOut' }, { frame: 17, x: 0, y: 0, rotation: 0, blur: 0 }]
  },
  {
    id: 'blur-reveal', name: 'Blur Reveal', category: 'BLUR', duration: 22, mode: 'text', staggerDelay: 0,
    description: 'Aparece desde una niebla suave y limpia.', easing: 'cubicOut',
    keyframes: [{ frame: 0, blur: 20, opacity: 0, scale: 1.07, easingToNext: 'cubicOut' }, { frame: 22, blur: 0, opacity: 1, scale: 1 }]
  },
  {
    id: 'perspective-zoom', name: 'Perspective Zoom', category: '3D', duration: 21, mode: 'text', staggerDelay: 0,
    description: 'Profundidad tridimensional que se aplana al llegar.', easing: 'expoOut',
    keyframes: [{ frame: 0, scale: 1.85, translateZ: 260, rotateX: 30, rotateY: -16, rotation: -2.5, blur: 9, perspective: 900, easingToNext: 'expoOut' }, { frame: 14, scale: 0.985, translateZ: -12, rotateX: -1.5, rotateY: 1, blur: 0, perspective: 1150, easingToNext: 'easeOut' }, { frame: 21, scale: 1, translateZ: 0, rotateX: 0, rotateY: 0, rotation: 0, perspective: 1200 }]
  },
  {
    id: 'bottom-punch', name: 'Bottom Punch', category: 'SLIDE', duration: 18, mode: 'text', staggerDelay: 0,
    description: 'Sube desde abajo y aterriza con un golpe corto.', easing: 'expoOut',
    keyframes: [{ frame: 0, y: 340, scale: 0.9, blur: 7, opacity: 0, easingToNext: 'expoOut' }, { frame: 12, y: -9, scale: 1.03, blur: 0, opacity: 1, easingToNext: 'easeOut' }, { frame: 18, y: 0, scale: 1 }]
  },
  {
    id: 'word-cascade', name: 'Word Cascade', category: 'WORDS', duration: 18, mode: 'words', staggerDelay: 3,
    description: 'Las palabras caen en secuencia con ritmo rápido.', easing: 'cubicOut',
    keyframes: [{ frame: 0, opacity: 0, y: 62, scale: 0.9, blur: 4, easingToNext: 'cubicOut' }, { frame: 18, opacity: 1, y: 0, scale: 1, blur: 0 }]
  },
  {
    id: 'letter-impact', name: 'Letter Impact', category: 'LETTERS', duration: 13, mode: 'letters', staggerDelay: 1,
    description: 'Cada letra golpea con un micro rebote.', easing: 'backOut', spring: 0.55, bounce: 0.12,
    keyframes: [{ frame: 0, opacity: 0, scale: 0.45, blur: 2, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 8, opacity: 1, scale: 1.08, blur: 0, easingToNext: 'easeOut' }, { frame: 13, scale: 1 }]
  },
  {
    id: 'side-swipe', name: 'Side Swipe', category: 'SLIDE', duration: 17, mode: 'text', staggerDelay: 0,
    description: 'Cruza horizontalmente y frena de golpe.', easing: 'expoOut',
    keyframes: [{ frame: 0, x: -640, skewX: -7, blur: 12, opacity: 0, easingToNext: 'expoOut' }, { frame: 11, x: 20, skewX: 1, blur: 0, opacity: 1, easingToNext: 'easeOut' }, { frame: 17, x: 0, skewX: 0, blur: 0 }]
  },
  {
    id: 'hero-word', name: 'Hero Word', category: 'IMPACT', duration: 20, mode: 'text', staggerDelay: 0,
    description: 'Una keyword enorme entra con presencia de título.', easing: 'expoOut', overshoot: 1.08,
    keyframes: [{ frame: 0, scale: 3.2, y: 90, rotation: -1, blur: 15, easingToNext: 'expoOut' }, { frame: 12, scale: 0.96, y: -10, rotation: 0, blur: 0, easingToNext: 'easeOut' }, { frame: 16, scale: 1.04, y: 2, blur: 0, easingToNext: 'easeInOut' }, { frame: 20, scale: 1, y: 0 }]
  },
  {
    id: 'word-rain', name: 'Word Rain', category: 'EPIC', duration: 24, mode: 'words', staggerDelay: 3,
    description: 'Cada palabra cae desde el cielo y aterriza con peso.', easing: 'expoOut', spring: 0.65, bounce: 0.18, variation: 'rain',
    keyframes: [{ frame: 0, opacity: 0, y: -560, scale: 0.86, blur: 12, easingToNext: 'expoOut', dynamicsToNext: 'spring' }, { frame: 16, opacity: 1, y: 22, scale: 1.04, blur: 0, easingToNext: 'easeOut' }, { frame: 24, y: 0, scale: 1, blur: 0 }]
  },
  {
    id: 'word-sphere', name: 'Word Sphere', category: '3D', duration: 28, mode: 'words', staggerDelay: 2,
    description: 'Las palabras forman una esfera 3D que gira en profundidad.', easing: 'backOut', spring: 0.45, bounce: 0.12, variation: 'sphere',
    keyframes: [{ frame: 0, opacity: 0, scale: 0.35, blur: 8, rotateY: -40, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 20, opacity: 1, scale: 1.04, blur: 0, rotateY: 2, easingToNext: 'easeOut' }, { frame: 28, scale: 1, rotateY: 0 }]
  },
  {
    id: 'random-riot', name: 'Random Riot', category: 'EPIC', duration: 24, mode: 'words', staggerDelay: 2,
    description: 'Cada palabra llega desde un lugar distinto con un movimiento propio.', easing: 'backOut', spring: 0.5, bounce: 0.14, variation: 'random',
    keyframes: [{ frame: 0, opacity: 0, scale: 0.5, blur: 11, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 17, opacity: 1, scale: 1.05, blur: 0, easingToNext: 'easeOut' }, { frame: 24, scale: 1 }]
  },
  {
    id: 'orbit-slam', name: 'Orbit Slam', category: '3D', duration: 25, mode: 'words', staggerDelay: 2,
    description: 'Las palabras orbitan desde fuera de cámara y chocan en el centro.', easing: 'expoOut', spring: 0.7, bounce: 0.16, variation: 'orbit',
    keyframes: [{ frame: 0, opacity: 0, scale: 0.58, blur: 10, rotateY: 44, easingToNext: 'expoOut', dynamicsToNext: 'spring' }, { frame: 18, opacity: 1, scale: 1.04, blur: 0, rotateY: -2, easingToNext: 'easeOut' }, { frame: 25, scale: 1, rotateY: 0 }]
  },
  {
    id: 'glitch-crush', name: 'Glitch Crush', category: 'EPIC', duration: 18, mode: 'letters', staggerDelay: 1,
    description: 'Las letras se deforman como una falla digital y se reconstruyen.', easing: 'expoOut', spring: 0.55, bounce: 0.12, variation: 'glitch',
    keyframes: [{ frame: 0, opacity: 0, scaleX: 0.6, skewX: -17, blur: 7, easingToNext: 'expoOut', dynamicsToNext: 'spring' }, { frame: 11, opacity: 1, scaleX: 1.08, skewX: 2, blur: 0, easingToNext: 'easeOut' }, { frame: 18, scaleX: 1, skewX: 0, blur: 0 }]
  },
  {
    id: 'meteor-drop', name: 'Meteor Drop', category: 'EPIC', duration: 20, mode: 'text', staggerDelay: 0,
    description: 'El texto cae como un meteorito y rebota al impactar.', easing: 'expoOut', spring: 0.7, bounce: 0.2,
    keyframes: [{ frame: 0, opacity: 0, y: -700, x: 130, rotation: 6, scale: 1.3, blur: 16, easingToNext: 'easeIn' }, { frame: 13, opacity: 1, y: 28, x: -6, rotation: -1, scale: 0.96, blur: 0, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 17, y: -7, x: 0, rotation: 0.3, scale: 1.04, blur: 0, easingToNext: 'easeOut' }, { frame: 20, y: 0, rotation: 0, scale: 1 }]
  },
  {
    id: 'letter-storm', name: 'Letter Storm', category: 'LETTERS', duration: 22, mode: 'letters', staggerDelay: 1,
    description: 'Una tormenta de letras entra desde todas las direcciones.', easing: 'backOut', spring: 0.5, bounce: 0.12, variation: 'random',
    keyframes: [{ frame: 0, opacity: 0, scale: 0.42, blur: 9, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 15, opacity: 1, scale: 1.06, blur: 0, easingToNext: 'easeOut' }, { frame: 22, scale: 1 }]
  },
  {
    id: 'epic-rise', name: 'Epic Rise', category: 'EPIC', duration: 26, mode: 'lines', staggerDelay: 5,
    description: 'Las líneas emergen desde abajo como títulos de una película.', easing: 'expoOut', spring: 0.5, bounce: 0.1,
    keyframes: [{ frame: 0, opacity: 0, y: 400, translateZ: -220, scale: 1.2, rotateX: -38, blur: 11, perspective: 900, easingToNext: 'expoOut', dynamicsToNext: 'spring' }, { frame: 19, opacity: 1, y: -13, translateZ: 10, scale: 0.985, rotateX: 1.5, blur: 0, perspective: 1200, easingToNext: 'easeOut' }, { frame: 26, y: 0, translateZ: 0, scale: 1, rotateX: 0 }]
  },

  /* ========================================================================
   * REVELADO — el texto aparece sin desplazarse.
   *
   * La máquina de escribir sale del motor que ya existía: modo `letters`, un
   * `staggerDelay` que marca el ritmo de tecleo, y una animación de un solo
   * cuadro para que cada letra aparezca de golpe en vez de deslizarse. Las
   * unidades que todavía no llegaron a su turno reciben un cuadro negativo,
   * que `interpolatePreset` recorta a cero: se quedan en el primer keyframe,
   * con opacidad 0.
   * ===================================================================== */
  {
    id: 'typewriter', name: 'Typewriter', category: 'REVEAL', duration: 2, mode: 'letters', staggerDelay: 2, variation: 'cursor',
    description: 'Se escribe letra por letra, con el cursor titilando.', easing: 'linear',
    keyframes: [{ frame: 0, opacity: 0, easingToNext: 'linear' }, { frame: 1, opacity: 1 }]
  },
  {
    id: 'typewriter-clean', name: 'Typewriter Clean', category: 'REVEAL', duration: 2, mode: 'letters', staggerDelay: 2,
    description: 'La misma máquina de escribir, sin cursor.', easing: 'linear',
    keyframes: [{ frame: 0, opacity: 0, easingToNext: 'linear' }, { frame: 1, opacity: 1 }]
  },
  {
    id: 'typewriter-soft', name: 'Soft Type', category: 'REVEAL', duration: 6, mode: 'letters', staggerDelay: 2,
    description: 'Tecleo suave: cada letra sube un poco al aparecer.', easing: 'cubicOut',
    keyframes: [{ frame: 0, opacity: 0, y: 14, blur: 3, easingToNext: 'cubicOut' }, { frame: 6, opacity: 1, y: 0, blur: 0 }]
  },
  {
    id: 'word-type', name: 'Word Type', category: 'REVEAL', duration: 2, mode: 'words', staggerDelay: 5,
    description: 'Aparece una palabra por vez. El subtítulo hablado clásico.', easing: 'linear',
    keyframes: [{ frame: 0, opacity: 0, easingToNext: 'linear' }, { frame: 1, opacity: 1 }]
  },
  {
    id: 'line-reveal', name: 'Line Reveal', category: 'REVEAL', duration: 9, mode: 'lines', staggerDelay: 8,
    description: 'Una línea por vez, con un desplazamiento corto.', easing: 'cubicOut',
    keyframes: [{ frame: 0, opacity: 0, y: 40, easingToNext: 'cubicOut' }, { frame: 9, opacity: 1, y: 0 }]
  },
  {
    id: 'fade-in', name: 'Fade In', category: 'REVEAL', duration: 14, mode: 'text', staggerDelay: 0,
    description: 'Simplemente aparece. El más neutro de todos.', easing: 'easeOut',
    keyframes: [{ frame: 0, opacity: 0, easingToNext: 'easeOut' }, { frame: 14, opacity: 1 }]
  },
  {
    id: 'soft-rise', name: 'Soft Rise', category: 'REVEAL', duration: 16, mode: 'text', staggerDelay: 0,
    description: 'Sube unos pocos píxeles mientras aparece. Discreto y prolijo.', easing: 'cubicOut',
    keyframes: [{ frame: 0, opacity: 0, y: 52, easingToNext: 'cubicOut' }, { frame: 16, opacity: 1, y: 0 }]
  },
  {
    id: 'letter-fade', name: 'Letter Fade', category: 'REVEAL', duration: 7, mode: 'letters', staggerDelay: 1,
    description: 'Las letras se encienden en cadena, sin moverse.', easing: 'easeOut',
    keyframes: [{ frame: 0, opacity: 0, easingToNext: 'easeOut' }, { frame: 7, opacity: 1 }]
  },

  /* ============================ MÁS ENTRADAS ============================ */
  {
    id: 'pop-in', name: 'Pop', category: 'IMPACT', duration: 10, mode: 'text', staggerDelay: 0,
    description: 'Un salto de tamaño corto y seco.', easing: 'backOut',
    keyframes: [{ frame: 0, opacity: 0, scale: 0.62, easingToNext: 'backOut' }, { frame: 7, opacity: 1, scale: 1.05, easingToNext: 'easeOut' }, { frame: 10, scale: 1 }]
  },
  {
    id: 'bounce-in', name: 'Bounce', category: 'IMPACT', duration: 24, mode: 'text', staggerDelay: 0,
    description: 'Cae y rebota dos veces antes de quedarse quieto.', easing: 'easeOut', spring: 0.4, bounce: 0.12,
    keyframes: [{ frame: 0, opacity: 0, y: -300, scale: 0.94, easingToNext: 'easeIn' }, { frame: 10, opacity: 1, y: 0, scale: 1.06, easingToNext: 'easeOut' }, { frame: 15, y: -36, scale: 0.99, easingToNext: 'easeIn' }, { frame: 20, y: 0, scale: 1.02, easingToNext: 'easeOut' }, { frame: 24, y: 0, scale: 1 }]
  },
  {
    id: 'stretch-in', name: 'Stretch', category: 'IMPACT', duration: 15, mode: 'text', staggerDelay: 0,
    description: 'Se estira de lado a lado hasta tomar su forma.', easing: 'expoOut',
    keyframes: [{ frame: 0, opacity: 0, scaleX: 0.22, scaleY: 1.24, easingToNext: 'expoOut' }, { frame: 10, opacity: 1, scaleX: 1.05, scaleY: 0.98, easingToNext: 'easeOut' }, { frame: 15, scaleX: 1, scaleY: 1 }]
  },
  {
    id: 'flip-in', name: 'Flip', category: '3D', duration: 18, mode: 'text', staggerDelay: 0,
    description: 'Gira sobre su eje horizontal como una tarjeta.', easing: 'expoOut',
    keyframes: [{ frame: 0, opacity: 0, rotateX: 72, perspective: 1000, easingToNext: 'expoOut' }, { frame: 13, opacity: 1, rotateX: -4.5, easingToNext: 'easeOut' }, { frame: 18, rotateX: 0 }]
  },
  {
    id: 'roll-in', name: 'Roll', category: 'SLIDE', duration: 20, mode: 'text', staggerDelay: 0,
    description: 'Rueda desde la izquierda girando sobre sí mismo.', easing: 'expoOut',
    keyframes: [{ frame: 0, opacity: 0, x: -480, rotation: -120, scale: 0.78, easingToNext: 'expoOut' }, { frame: 14, opacity: 1, x: 12, rotation: 3, scale: 1.02, easingToNext: 'easeOut' }, { frame: 20, x: 0, rotation: 0, scale: 1 }]
  },
  {
    id: 'shake-in', name: 'Shake In', category: 'IMPACT', duration: 16, mode: 'text', staggerDelay: 0,
    description: 'Entra temblando, como un golpe sobre la mesa.', easing: 'easeOut',
    keyframes: [{ frame: 0, opacity: 0, scale: 1.14, x: 0, easingToNext: 'easeOut' }, { frame: 5, opacity: 1, scale: 1, x: 15, easingToNext: 'easeInOut' }, { frame: 8, x: -9, easingToNext: 'easeInOut' }, { frame: 11, x: 5, easingToNext: 'easeInOut' }, { frame: 13, x: -2, easingToNext: 'easeOut' }, { frame: 16, x: 0 }]
  },
  {
    id: 'wave-in', name: 'Wave In', category: 'WORDS', duration: 14, mode: 'words', staggerDelay: 4,
    description: 'Las palabras entran en ola, una detrás de la otra.', easing: 'backOut', spring: 0.5, bounce: 0.15,
    keyframes: [{ frame: 0, opacity: 0, y: 48, scale: 0.92, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 10, opacity: 1, y: -7, scale: 1.03, easingToNext: 'easeOut' }, { frame: 14, y: 0, scale: 1 }]
  },
  {
    id: 'spring-drop', name: 'Spring Drop', category: 'IMPACT', duration: 20, mode: 'words', staggerDelay: 3,
    description: 'Cada palabra cae con un resorte propio.', easing: 'backOut', spring: 0.45, bounce: 0.13,
    keyframes: [{ frame: 0, opacity: 0, y: -180, scale: 0.9, easingToNext: 'backOut', dynamicsToNext: 'spring' }, { frame: 14, opacity: 1, y: 8, scale: 1.03, easingToNext: 'easeOut' }, { frame: 20, y: 0, scale: 1 }]
  },

  /* ============================== SALIDAS =============================== */
  {
    id: 'fade-out', name: 'Fade Out', category: 'REVEAL', duration: 14, mode: 'text', staggerDelay: 0, intent: 'out',
    description: 'Se apaga sin moverse.', easing: 'easeIn',
    keyframes: [{ frame: 0, opacity: 1, easingToNext: 'easeIn' }, { frame: 14, opacity: 0 }]
  },
  {
    id: 'zoom-out', name: 'Zoom Out', category: 'ZOOM', duration: 14, mode: 'text', staggerDelay: 0, intent: 'out',
    description: 'Se achica hasta desaparecer.', easing: 'easeIn',
    keyframes: [{ frame: 0, opacity: 1, scale: 1, easingToNext: 'easeIn' }, { frame: 14, opacity: 0, scale: 0.55, blur: 4 }]
  },
  {
    id: 'slide-out-down', name: 'Slide Out', category: 'SLIDE', duration: 15, mode: 'text', staggerDelay: 0, intent: 'out',
    description: 'Baja y se va por abajo de la pantalla.', easing: 'easeIn',
    keyframes: [{ frame: 0, opacity: 1, y: 0, easingToNext: 'easeIn' }, { frame: 15, opacity: 0, y: 280, blur: 6 }]
  },
  {
    id: 'word-erase', name: 'Word Erase', category: 'REVEAL', duration: 2, mode: 'words', staggerDelay: 4, intent: 'out',
    description: 'Se borra palabra por palabra, como al deshacer.', easing: 'linear',
    keyframes: [{ frame: 0, opacity: 1, easingToNext: 'linear' }, { frame: 1, opacity: 0 }]
  },
  {
    id: 'glitch-out', name: 'Glitch Out', category: 'EPIC', duration: 16, mode: 'letters', staggerDelay: 1, intent: 'out', variation: 'glitch',
    description: 'Se desarma como una señal que se corta.', easing: 'easeIn',
    keyframes: [{ frame: 0, opacity: 1, scaleX: 1, skewX: 0, easingToNext: 'easeIn' }, { frame: 9, opacity: 0.7, scaleX: 1.15, skewX: 10, blur: 2, easingToNext: 'easeIn' }, { frame: 16, opacity: 0, scaleX: 0.5, skewX: -16, blur: 8 }]
  }
  ,...extraMotionPresets
];

export const defaultPreset = builtInPresets[0];
