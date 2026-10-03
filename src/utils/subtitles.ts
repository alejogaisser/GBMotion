import type { TextLayer } from '../types/motion';
import { getLayerDuration } from './duration.ts';

export type CaptionCue = { text: string; startFrame: number; durationFrames: number };
const timestamp = (value: string) => {
  const parts = value.replace(',', '.').split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) throw new Error('Tiempo de subtítulo inválido.');
  return parts.reduce((sum, n) => sum * 60 + n, 0);
};

export const parseSubtitles = (source: string): CaptionCue[] => {
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block)) continue;
    const lines = block.split('\n');
    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex < 0) throw new Error('No se encontró el tiempo de una frase. Usá un archivo SRT o VTT.');
    const match = lines[timingIndex].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/);
    if (!match) throw new Error('No se pudo leer un tiempo del subtítulo.');
    const start = timestamp(match[1]); const end = timestamp(match[2]);
    if (end <= start) throw new Error('Una frase termina antes de comenzar.');
    const text = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (text.length > 180) throw new Error('Una frase supera los 180 caracteres. Dividila antes de importar.');
    if (text) cues.push({ text, startFrame: Math.round(start * 30), durationFrames: Math.max(1, Math.round(end * 30) - Math.round(start * 30)) });
  }
  if (!cues.length) throw new Error('El archivo no contiene frases.');
  return cues;
};

export const scriptToCues = (source: string, startFrame: number, seconds: number): CaptionCue[] => {
  const lines = source.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Escribí al menos una frase.');
  if (lines.some((l) => l.length > 180)) throw new Error('Cada frase puede tener hasta 180 caracteres.');
  const durationFrames = Math.max(15, Math.round(seconds * 30));
  return lines.map((text, i) => ({ text, startFrame: startFrame + i * durationFrames, durationFrames }));
};

const cueClock = (frame: number, vtt: boolean) => {
  const ms = Math.round(frame * 1000 / 30);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${vtt ? '.' : ','}${String(ms % 1000).padStart(3, '0')}`;
};
export const exportSubtitles = (layers: TextLayer[], kind: 'srt' | 'vtt') => {
  const vtt = kind === 'vtt';
  return (vtt ? 'WEBVTT\n\n' : '') + layers.filter((l) => l.visible && l.text.trim()).sort((a, b) => a.startFrame - b.startFrame).map((l, i) =>
    `${vtt ? '' : `${i + 1}\n`}${cueClock(l.startFrame, vtt)} --> ${cueClock(l.startFrame + getLayerDuration(l), vtt)}\n${l.text.trim()}\n`
  ).join('\n');
};
