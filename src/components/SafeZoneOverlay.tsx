export type SafeZone = 'none' | 'tiktok' | 'reels';

export const safeZoneLabels: Record<SafeZone, string> = { none: 'Ninguna', tiktok: 'TikTok', reels: 'Reels' };

/** Fracciones del cuadro que tapa la interfaz de cada red (arriba, abajo y costado derecho). */
const zones: Record<Exclude<SafeZone, 'none'>, { top: number; bottom: number; right: number }> = {
  tiktok: { top: 0.09, bottom: 0.22, right: 0.14 },
  reels: { top: 0.1, bottom: 0.2, right: 0.12 },
};

/**
 * Guía de zona segura sólo para la vista previa. Vive afuera del Player y no forma
 * parte de la composición, así que nunca llega al video exportado.
 */
export const SafeZoneOverlay = ({ zone }: { zone: SafeZone }) => {
  if (zone === 'none') return null;
  const { top, bottom, right } = zones[zone];
  return (
    <div className="safe-zone-overlay" data-zone={zone} aria-hidden="true">
      <span className="zone top" style={{ height: `${top * 100}%` }} />
      <span className="zone bottom" style={{ height: `${bottom * 100}%` }}><small>{safeZoneLabels[zone]}: la interfaz tapa esta franja</small></span>
      <span className="zone right" style={{ width: `${right * 100}%`, top: `${top * 100}%`, bottom: `${bottom * 100}%` }} />
    </div>
  );
};
