export type ServerCapabilities = { upload: boolean; render: boolean; transcribe: boolean };
export type TranscriptionMode = 'mock' | 'provider' | 'unconfigured';
export type ServerHealth = {
  version: 1;
  mode: 'local';
  transcriptionMode: TranscriptionMode;
  capabilities: { upload: true; render: true; transcribe: boolean };
};

type Options = { isBusy?: () => boolean };
type Model = {
  status: 'checking' | 'ready' | 'unavailable';
  capabilities: ServerCapabilities;
  transcriptionMode: TranscriptionMode;
  retry: () => void;
};

const unavailable = { capabilities: { upload: false, render: false, transcribe: false }, transcriptionMode: 'unconfigured' as const };
const isHealth = (v: unknown): v is ServerHealth => {
  if (!v || typeof v !== 'object') return false;
  const h = v as Partial<ServerHealth>;
  return h.version === 1 && h.mode === 'local' && ['mock', 'provider', 'unconfigured'].includes(String(h.transcriptionMode))
    && h.capabilities?.upload === true && h.capabilities.render === true && typeof h.capabilities.transcribe === 'boolean'
    && h.capabilities.transcribe === (h.transcriptionMode !== 'unconfigured');
};

/** Consulta explícita, sin polling: no interrumpe el primer bundling de un export. */
export const useServerCapabilities = (options?: Options): Model => {
  const [state, setState] = useState<Omit<Model, 'retry'>>({ status: 'checking', ...unavailable });
  const busy = useRef(options?.isBusy);
  busy.current = options?.isBusy;
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const retry = useCallback(() => {
    if (busy.current?.()) return;
    const token = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState((current) => current.status === 'ready' ? current : { ...current, status: 'checking' });
    const timeout = setTimeout(() => abort.abort(), 3000);
    void (async () => {
      try {
        const response = await fetch('/api/health', { signal: abort.signal });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('health');
        const health: unknown = await response.json();
        if (!isHealth(health)) throw new Error('schema');
        if (generation.current === token && !abort.signal.aborted) setState({ status: 'ready', capabilities: health.capabilities, transcriptionMode: health.transcriptionMode });
      } catch {
        if (generation.current === token && !busy.current?.()) setState({ status: 'unavailable', ...unavailable });
      } finally { clearTimeout(timeout); }
    })();
  }, []);
  useEffect(() => { retry(); return () => { generation.current++; controller.current?.abort(); }; }, [retry]);
  return { ...state, retry };
};
import { useCallback, useEffect, useRef, useState } from 'react';
