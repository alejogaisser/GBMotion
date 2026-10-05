import { Film } from 'lucide-react';
import { useRef } from 'react';

type Props = {
  onPickVideo: (file: File) => void;
  onWriteByHand: () => void;
};

/** Lo que se ve sobre el lienzo al empezar de nuevo: los tres pasos del flujo. */
export const EmptyState = ({ onPickVideo, onWriteByHand }: Props) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="empty-state" role="region" aria-label="Empezá tu proyecto">
      <Film size={26} aria-hidden="true" />
      <h2>Subí tu video</h2>
      <ol>
        <li><b>1</b><span>Elegí el video de tu computadora. Queda guardado, no tenés que volver a subirlo.</span></li>
        <li><b>2</b><span>La IA escribe los subtítulos con el tiempo de cada palabra.</span></li>
        <li><b>3</b><span>Elegí el estilo, los efectos y descargá el video listo.</span></li>
      </ol>
      <input ref={input} type="file" accept="video/*" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onPickVideo(file);
        event.target.value = '';
      }} />
      <div className="empty-actions">
        <button type="button" className="button primary" onClick={() => input.current?.click()}>Elegir un video</button>
        <button type="button" className="ghost-button" onClick={onWriteByHand}>Escribir a mano</button>
      </div>
    </div>
  );
};
