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

/** Contrato F1-C1; la consulta de health y su ciclo de vida llegan en F1-C3. */
export const useServerCapabilities = (_options?: Options): Model => ({
  status: 'unavailable',
  capabilities: { upload: false, render: false, transcribe: false },
  transcriptionMode: 'unconfigured',
  retry: () => {},
});
