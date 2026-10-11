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
  /** Cambia cuando se reemplaza el proyecto, aunque conserve el mismo video. */
  sessionKey?: string;
  /** Id del video guardado en el servidor; vacío si todavía no hay uno. */
  mediaId: string;
  /** La frase seleccionada: su look y su movimiento se pueden usar como plantilla. */
  templateLayer: TextLayer;
  createId: () => string;
  /** Aplica los subtítulos como un solo paso de historial. Devuelve un mensaje si no entran. */
  onApply: (layers: TextLayer[], mode: 'replace' | 'append') => string | null;
};

export type TranscriptionModel = ReturnType<typeof useTranscription>;

/** Opciones de los subtítulos automáticos y el ciclo de generarlos (extraer, enviar, transcribir, agrupar). */
export const useTranscription = ({ mediaId, templateLayer, createId, onApply, sessionKey }: Options) => {
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
  const generation = useRef(0);
  const locked = useRef(false);
  const mounted = useRef(false);

  const cancelRemote = async (id: string) => {
    if (!await cancelTranscription(id) && mounted.current) setError('No pude confirmar la cancelación en el servidor. Revisá que GB Motion siga abierto.');
  };
  const invalidate = () => {
    generation.current++;
    locked.current = false;
    controller.current?.abort();
    controller.current = null;
    if (jobId.current) void cancelRemote(jobId.current);
    jobId.current = null;
  };

  useEffect(() => { mounted.current = true; void fetchProviders().then((p) => { if (mounted.current) setProviders(p); }); return () => { mounted.current = false; invalidate(); }; }, []);
  useEffect(() => { invalidate(); setStage(null); setDone(''); setError(''); }, [mediaId, sessionKey]);

  const running = stage !== null;

  const generate = async () => {
    if (locked.current || !mediaId) return;
    locked.current = true;
    const token = ++generation.current;
    const valid = () => mounted.current && token === generation.current;
    setError(''); setDone(''); setStage('extracting');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const id = await startTranscription({ mediaId, language, provider: provider || undefined }, abort.signal);
      if (!valid() || abort.signal.aborted) { await cancelRemote(id); return; }
      jobId.current = id;
      const words = await pollTranscription(id, (s) => { if (valid()) setStage(s); }, abort.signal);
      if (!valid() || abort.signal.aborted) return;
      const pages = groupWords(words, { maxWords, maxChars, breakOnSilenceMs: onSilence ? 500 : Number.POSITIVE_INFINITY, removeFillers });
      const base = useLook ? templateLayer : createTextLayer('TEXTO', 'plantilla');
      const template: TextLayer = { ...structuredClone(base), wordTiming: { mode: highlight, color, words: [] } };
      const layers = pagesToLayers(pages, template, createId);
      const problem = layers.length === 0 ? 'No se detectó voz en el video.' : onApply(layers, applyMode);
      if (problem) setError(problem);
      else setDone(`${layers.length} subtítulos creados. Podés deshacerlo con Ctrl+Z.`);
    } catch (failure) {
      if (valid() && !(failure instanceof TranscribeError && failure.code === 'cancelled')) setError(failure instanceof Error ? failure.message : 'No pude generar los subtítulos.');
      else if (!valid() && !(failure instanceof TranscribeError && failure.code === 'cancelled')) console.warn('Se perdió la respuesta de la transcripción; no se pudo confirmar la cancelación en el servidor.');
    } finally {
      if (valid()) { setStage(null); jobId.current = null; controller.current = null; locked.current = false; }
    }
  };

  const cancel = () => {
    invalidate();
    setStage(null);
  };

  return {
    providers, language, setLanguage, provider, setProvider, maxWords, setMaxWords, maxChars, setMaxChars,
    onSilence, setOnSilence, removeFillers, setRemoveFillers, highlight, setHighlight, color, setColor,
    useLook, setUseLook, applyMode, setApplyMode, stage, running, error, done, generate, cancel,
  };
};
