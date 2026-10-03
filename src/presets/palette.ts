import type { TextFill } from '../types/motion';

/**
 * Paleta de subtítulos.
 *
 * No es una rueda de color completa a propósito: sobre video lo que importa es
 * el contraste, y una lista corta de colores que ya se sabe que funcionan evita
 * el gris sucio al que se llega tocando un selector al azar. El selector libre
 * sigue estando al final de la fila para cuando hace falta un color de marca.
 */

export type Swatch = { color: string; name: string };

export const captionColors: Swatch[] = [
  { color: '#FFFFFF', name: 'Blanco' },
  { color: '#F2F4F8', name: 'Hueso' },
  { color: '#FFE94A', name: 'Amarillo' },
  { color: '#FFC53D', name: 'Ámbar' },
  { color: '#FF9F1C', name: 'Naranja' },
  { color: '#FF6B35', name: 'Naranja fuerte' },
  { color: '#FF3B30', name: 'Rojo' },
  { color: '#C2113B', name: 'Rojo oscuro' },
  { color: '#FF7BE5', name: 'Rosa' },
  { color: '#FF2DBE', name: 'Magenta' },
  { color: '#B36BFF', name: 'Violeta' },
  { color: '#7C5CFF', name: 'Púrpura' },
  { color: '#3FD8FF', name: 'Celeste' },
  { color: '#2B6BFF', name: 'Azul' },
  { color: '#9BF6FF', name: 'Agua' },
  { color: '#4BFF8F', name: 'Verde' },
  { color: '#22D97E', name: 'Verde bosque' },
  { color: '#D6FF4B', name: 'Lima' },
  { color: '#F6EFE2', name: 'Crema' },
  { color: '#C9A227', name: 'Oro' },
  { color: '#B9C6D6', name: 'Plata' },
  { color: '#6B7484', name: 'Gris' },
  { color: '#1A1E26', name: 'Carbón' },
  { color: '#000000', name: 'Negro' },
];

/** Colores para contorno y sombra: casi siempre oscuros o muy claros. */
export const outlineColors: Swatch[] = [
  { color: '#000000', name: 'Negro' },
  { color: '#0B0D10', name: 'Casi negro' },
  { color: '#2B1400', name: 'Marrón oscuro' },
  { color: '#04122B', name: 'Azul noche' },
  { color: '#2A0621', name: 'Violeta oscuro' },
  { color: '#FFFFFF', name: 'Blanco' },
  { color: '#FFE94A', name: 'Amarillo' },
  { color: '#FF2D1F', name: 'Rojo' },
  { color: '#D6FF4B', name: 'Lima' },
  { color: '#3FD8FF', name: 'Celeste' },
];

export type GradientPreset = { id: string; name: string; fill: Extract<TextFill, { type: 'gradient' }> };

const gradient = (id: string, name: string, angle: number, ...colors: string[]): GradientPreset => ({
  id,
  name,
  fill: {
    type: 'gradient',
    angle,
    stops: colors.map((color, index) => ({ color, at: index / (colors.length - 1) })),
  },
});

export const gradientPresets: GradientPreset[] = [
  gradient('grad-oro', 'Dorado', 180, '#FFF6C2', '#FFC53D', '#C9700A'),
  gradient('grad-cromo', 'Cromado', 180, '#FFFFFF', '#B9C6D6', '#6E7E93', '#DCE6F2'),
  gradient('grad-atardecer', 'Atardecer', 160, '#FFD36E', '#FF7A45', '#FF3D8B'),
  gradient('grad-hielo', 'Hielo', 180, '#FFFFFF', '#9BF6FF', '#2B6BFF'),
  gradient('grad-arcoiris', 'Arcoíris', 120, '#FF4D4D', '#FFB020', '#4BFF8F', '#3FD8FF', '#B36BFF'),
  gradient('grad-oldtv', 'Old TV', 180, '#7DF9FF', '#B36BFF', '#FF3DCE'),
  gradient('grad-fuego', 'Fuego', 180, '#FFF06B', '#FF8A00', '#E01E1E'),
  gradient('grad-menta', 'Menta', 180, '#E9FFF3', '#4BFF8F', '#0FA968'),
  gradient('grad-uva', 'Uva', 165, '#F3C6FF', '#B36BFF', '#5B21B6'),
  gradient('grad-acero', 'Acero', 180, '#DCE6F2', '#8494A8', '#2A3140'),
];
