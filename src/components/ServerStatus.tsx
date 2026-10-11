import { RefreshCw } from 'lucide-react';
import type { useServerCapabilities } from '../hooks/useServerCapabilities';

export type ServerModel = ReturnType<typeof useServerCapabilities>;
export type Capability = 'upload' | 'render' | 'transcribe';

const startHint = 'Abrí GB Motion con «npm start» o con el acceso directo.';

/** Por qué una función no está disponible, o null si lo está. El texto se muestra tal cual. */
export const capabilityReason = (server: ServerModel, capability: Capability): string | null => {
  if (server.status === 'checking') return 'Comprobando el servidor local…';
  if (server.status === 'unavailable') {
    return capability === 'upload'
      ? `Sin servidor local no se puede guardar el video. ${startHint}`
      : capability === 'render'
        ? `Sin servidor local no se puede exportar video. ${startHint}`
        : `Sin servidor local no se pueden generar subtítulos. ${startHint}`;
  }
  if (server.capabilities[capability]) return null;
  if (capability === 'transcribe') return 'El servidor local no tiene un servicio de transcripción configurado.';
  return 'El servidor local no ofrece esta función.';
};

type Props = { server: ServerModel; busy: boolean };

/** Indicador de modo: servidor listo, listo con transcripción de prueba, o modo navegador. */
export const ServerStatus = ({ server, busy }: Props) => {
  const { status, transcriptionMode, retry } = server;
  const label = status === 'checking'
    ? 'Comprobando servidor…'
    : status === 'unavailable'
      ? 'Modo navegador'
      : transcriptionMode === 'mock'
        ? 'Servidor listo · subtítulos de prueba'
        : transcriptionMode === 'unconfigured'
          ? 'Servidor listo · sin transcripción'
          : 'Servidor listo';
  return (
    <span className={`server-status ${status}`} role="status" aria-live="polite">
      <i className="server-dot" aria-hidden="true" />
      <span>{label}</span>
      {status === 'unavailable' && <small>sin servidor local</small>}
      {status === 'unavailable' && (
        <button type="button" className="ghost-button tiny" disabled={busy} onClick={retry}
          title={busy ? 'Hay un video exportándose: reintentá cuando termine.' : 'Volver a buscar el servidor local'}>
          <RefreshCw size={11} /> Reintentar
        </button>
      )}
    </span>
  );
};
