import type { ComboPreset, LayerAnimation, MotionPreset, TextStylePreset, TypographySettings } from '../types/motion';
import { isMotionPreset } from '../engine/validation';

const CUSTOM_KEY = 'gb-motion:custom-presets';
const FAVORITES_KEY = 'gb-motion:favorites';
const STYLE_PRESETS_KEY = 'gb-motion:style-presets';
const COMBO_PRESETS_KEY = 'gb-motion:combo-presets';

const parse = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota must not break the editor session.
  }
};

export const loadCustomPresets = () => {
  const value = parse<unknown>(CUSTOM_KEY, []);
  return Array.isArray(value) ? value.filter(isMotionPreset) : [];
};
export const saveCustomPresets = (presets: MotionPreset[]) => write(CUSTOM_KEY, presets);
export const loadFavorites = () => {
  const value = parse<unknown>(FAVORITES_KEY, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};
export const saveFavorites = (ids: string[]) => write(FAVORITES_KEY, ids);

export const isTypography = (value: unknown): value is TypographySettings => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const numericKeys = ['fontSize', 'fontWeight', 'letterSpacing', 'wordSpacing', 'lineHeight', 'strokeWidth', 'shadowBlur', 'shadowOpacity'];
  return typeof item.fontFamily === 'string'
    && typeof item.italic === 'boolean'
    && typeof item.uppercase === 'boolean'
    && typeof item.color === 'string'
    && typeof item.strokeColor === 'string'
    && typeof item.shadowColor === 'string'
    && ['left', 'center', 'right'].includes(String(item.textAlign))
    && numericKeys.every((key) => typeof item[key] === 'number' && Number.isFinite(item[key]));
};

export const isLayerAnimation = (value: unknown): value is LayerAnimation => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const validSegment = (segment: unknown) => segment === null || Boolean(segment && typeof segment === 'object' && isMotionPreset((segment as Record<string, unknown>).preset) && (segment as Record<string, unknown>).overrides && typeof (segment as Record<string, unknown>).overrides === 'object');
  return validSegment(item.in) && validSegment(item.out) && typeof item.holdFrames === 'number' && Number.isFinite(item.holdFrames) && item.holdFrames >= 0;
};

const isStylePreset = (value: unknown): value is TextStylePreset => Boolean(value && typeof value === 'object'
  && typeof (value as TextStylePreset).id === 'string'
  && typeof (value as TextStylePreset).name === 'string'
  && isTypography((value as TextStylePreset).typography));

const isComboPreset = (value: unknown): value is ComboPreset => Boolean(value && typeof value === 'object'
  && typeof (value as ComboPreset).id === 'string'
  && typeof (value as ComboPreset).name === 'string'
  && isTypography((value as ComboPreset).typography)
  && isLayerAnimation((value as ComboPreset).animation));

export const loadCustomStylePresets = () => {
  const value = parse<unknown>(STYLE_PRESETS_KEY, []);
  return Array.isArray(value) ? value.filter(isStylePreset) : [];
};
export const saveCustomStylePresets = (presets: TextStylePreset[]) => write(STYLE_PRESETS_KEY, presets);

export const loadCustomComboPresets = () => {
  const value = parse<unknown>(COMBO_PRESETS_KEY, []);
  return Array.isArray(value) ? value.filter(isComboPreset) : [];
};
export const saveCustomComboPresets = (presets: ComboPreset[]) => write(COMBO_PRESETS_KEY, presets);
