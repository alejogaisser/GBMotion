import { useRef } from 'react';

type Props = {
  label: string;
  orientation: 'vertical' | 'horizontal';
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Arrastrar o presionar hacia arriba/izquierda agranda (el panel de abajo crece hacia arriba). */
  invert?: boolean;
  className?: string;
};

const STEP = 16;

/** Separador accesible: arrastre con el mouse y flechas con el teclado (Shift ×4, Home/End a los límites). */
export const Resizer = ({ label, orientation, value, min, max, onChange, invert = false, className = '' }: Props) => {
  const drag = useRef<{ start: number; origin: number } | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const vertical = orientation === 'vertical';

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = STEP * (event.shiftKey ? 4 : 1);
    let next: number | null = null;
    if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    else if (vertical && event.key === 'ArrowRight') next = value + step;
    else if (vertical && event.key === 'ArrowLeft') next = value - step;
    else if (!vertical && event.key === 'ArrowUp') next = value + (invert ? step : -step);
    else if (!vertical && event.key === 'ArrowDown') next = value + (invert ? -step : step);
    if (next === null) return;
    event.preventDefault();
    onChange(clamp(next));
  };

  return (
    <div
      className={`resizer ${orientation} ${className}`.trim()}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { start: vertical ? event.clientX : event.clientY, origin: value };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const delta = (vertical ? event.clientX : event.clientY) - drag.current.start;
        onChange(clamp(drag.current.origin + (invert ? -delta : delta)));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
    />
  );
};
