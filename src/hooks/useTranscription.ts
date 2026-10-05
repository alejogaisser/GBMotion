import { useEffect, useRef, useState } from 'react';
import { groupWords } from '../captions/group';
import { pagesToLayers } from '../captions/toLayers';
import type { TranscribeLanguage, TranscribeProviderId } from '../captions/types';
import { createTextLayer } from '../remotion/defaults';
import type { TextLayer, WordHighlightMode } from '../types/motion';
import {
  cancelTranscription, fetchProviders, pollTranscription, startTranscription, TranscribeError,
  type ProviderInfo, type TranscribeStage,
} from '../utils/mediaClient';

type Options = {
  /** Id del video guardado en el servidor; vacío si todavía no hay uno. */
  mediaId: string;
  /** La frase seleccionada: su look y su movimiento se pueden usar como plantilla. */
  templateLayer: TextLayer;
  createId: () => string;
  /** Aplica los subtítulos como un solo paso de historial. Devuelve un mensaje si no entran. */
  onApply: (layers: TextLayer[], mode: 'replace' | 'append') => string | null;
};

/** Opciones de los subtítulos automáticos y el ciclo de generarlos (extraer, enviar, transcribir, agrupar). */
export const useTranscription = ({ mediaId, templateLayer, createId, onApply }: Options) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [language, setLanguage] = useState<TranscribeLanguage>('es');
  const [provider, setProvider] = useState<'' | TranscribeProviderId>('');
  const [maxWords, setMaxWords] = useState(3);
  const [maxChars, setMaxChars] = useState(20);
  const [onSilence, setOnSilence] = useState(true);
  const [removeFillers, setRemoveFillers] = useState(true);
  const [highlight, setHighlight] = useState<WordHighlightMode>('color');
  const [color, setColor] = useState('#ffe94a');
  const [useLook, setUseLook] = useState(true);
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [stage, setStage] = useState<TranscribeStage | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const jobId = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => { void fetchProviders().then(setProviders); }, []);
  useEffect(() => () => controller.current?.abort(), []);

  const running = stage !== null;

  const generate = async () => {
    if (running || !mediaId) return;
    setError(''); setDone(''); setStage('extracting');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const id = await startTranscription({ mediaId, language, provider: provider || undefined });
      jobId.current = id;
      const words = await pollTranscription(id, setStage, abort.signal);
      const pages = groupWords(words, { maxWords, maxChars, breakOnSilenceMs: onSilence ? 500 : Number.POSITIVE_INFINITY, removeFillers });
      const base = useLook ? templateLayer : createTextLayer('TEXTO', 'plantilla');
      const template: TextLayer = { ...structuredClone(base), wordTiming: { mode: highlight, color, words: [] } };
      const layers = pagesToLayers(pages, template, createId);
      const problem = layers.length === 0 ? 'No se detectó voz en el video.' : onApply(layers, applyMode);
      if (problem) setError(problem);
      else setDone(`${layers.length} subtítulos creados. Podés deshacerlo con Ctrl+Z.`);
    } catch (failure) {
      if (!(failure instanceof TranscribeError && failure.code === 'cancelled')) setError(failure instanceof Error ? failure.message : 'No pude generar los subtítulos.');
    } finally {
      setStage(null);
      jobId.current = null;
      controller.current = null;
    }
  };

  const cancel = () => {
    controller.current?.abort();
    if (jobId.current) void cancelTranscription(jobId.current);
  };

  return {
    providers, language, setLanguage, provider, setProvider, maxWords, setMaxWords, maxChars, setMaxChars,
    onSilence, setOnSilence, removeFillers, setRemoveFillers, highlight, setHighlight, color, setColor,
    useLook, setUseLook, applyMode, setApplyMode, stage, running, error, done, generate, cancel,
  };
};
