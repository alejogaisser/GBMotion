import { useEffect, useState } from 'react';

const KEY = 'gb-motion:seguir-en-movil';
const QUERY = '(max-width: 1023px)';

const readDismissed = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Aviso en pantallas chicas: el editor es para compu. «Seguir igual» se recuerda sólo en esta pestaña. */
export const DesktopOnlyNotice = () => {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);
  if (!narrow || dismissed) return null;
  return (
    <div className="desktop-notice" role="dialog" aria-modal="true" aria-labelledby="desktop-notice-title">
      <div className="desktop-notice-card">
        <h2 id="desktop-notice-title">GB Motion se edita mejor en compu</h2>
        <p>El editor necesita una pantalla ancha para el lienzo, los paneles y la línea de tiempo. Podés seguir igual, pero va a quedar apretado.</p>
        <div className="modal-actions">
          <a className="button secondary" href="/">Volver a GB Motion</a>
          <button type="button" className="button primary" autoFocus onClick={() => {
            try { sessionStorage.setItem(KEY, '1'); } catch { /* sigue valiendo en esta vista */ }
            setDismissed(true);
          }}>Seguir igual</button>
        </div>
      </div>
    </div>
  );
};
