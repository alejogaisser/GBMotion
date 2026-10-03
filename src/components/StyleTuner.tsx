import type { StrokeLayer, TextFill, TypographySettings } from '../types/motion';
import { captionColors, gradientPresets, outlineColors, type Swatch } from '../presets/palette';
import { normalizeTypography } from '../engine/textPaint';

type Props = {
  typography: TypographySettings;
  onChange: (patch: Partial<TypographySettings>) => void;
};

/**
 * Ajuste fino de un estilo ya elegido.
 *
 * Va dentro de un `<details>` cerrado: la galería sigue siendo el camino
 * principal y esto aparece sólo cuando alguien quiere correrse del preset.
 * Cada control escribe también el campo viejo equivalente (`color`,
 * `strokeColor`, `strokeWidth`) para que un proyecto guardado con esta versión
 * se siga leyendo si alguna vez se abre con la anterior.
 */

const Swatches = ({ colors, value, label, onPick }: {
  colors: Swatch[]; value: string; label: string; onPick: (color: string) => void;
}) => (
  <div className="swatch-row" role="group" aria-label={label}>
    {colors.map((swatch) => (
      <button
        type="button"
        key={swatch.color}
        className={`swatch small ${value.toLowerCase() === swatch.color.toLowerCase() ? 'on' : ''}`}
        style={{ background: swatch.color }}
        title={swatch.name}
        aria-label={swatch.name}
        onClick={() => onPick(swatch.color)}
      />
    ))}
    <label className="swatch small custom" title="Otro color">
      <input type="color" aria-label={`${label}: otro color`} value={value} onChange={(event) => onPick(event.target.value)} />
    </label>
  </div>
);

const Slider = ({ label, value, min, max, step = 1, suffix = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void;
}) => (
  <label className="time-field">
    <span>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))} />
    <output>{Math.round(value * 10) / 10}{suffix}</output>
  </label>
);

export const StyleTuner = ({ typography, onChange }: Props) => {
  const paint = normalizeTypography(typography);
  const strokes = paint.strokes;
  const inner: StrokeLayer = strokes[0] ?? { color: '#000000', width: 0 };
  const outer: StrokeLayer | undefined = strokes[1];
  const isGradient = paint.fill.type === 'gradient';

  const setStrokes = (next: StrokeLayer[]) => onChange({
    strokes: next,
    strokeColor: next[0]?.color ?? '#000000',
    strokeWidth: next[0]?.width ?? 0,
  });

  const setFill = (fill: TextFill) => onChange({
    fill,
    color: fill.type === 'solid' ? fill.color : typography.color,
  });

  return (
    <details className="tuner">
      <summary>Ajustar este estilo</summary>

      <div className="tuner-block">
        <h4>Relleno</h4>
        <div className="segmented" role="group" aria-label="Tipo de relleno">
          <button type="button" className={!isGradient ? 'on' : ''} aria-pressed={!isGradient}
            onClick={() => setFill({ type: 'solid', color: typography.color })}>Color plano</button>
          <button type="button" className={isGradient ? 'on' : ''} aria-pressed={isGradient}
            onClick={() => setFill(gradientPresets[0].fill)}>Degradado</button>
        </div>
        {isGradient ? (
          <>
            <div className="grad-row" role="group" aria-label="Degradados">
              {gradientPresets.map((preset) => {
                const stops = preset.fill.stops.map((stop) => `${stop.color} ${Math.round(stop.at * 100)}%`).join(', ');
                const active = isGradient && JSON.stringify(paint.fill) === JSON.stringify(preset.fill);
                return (
                  <button type="button" key={preset.id} className={`grad-chip ${active ? 'on' : ''}`}
                    style={{ backgroundImage: `linear-gradient(90deg, ${stops})` }}
                    title={preset.name} aria-label={preset.name} onClick={() => setFill(preset.fill)} />
                );
              })}
            </div>
            <Slider label="Ángulo" value={paint.fill.type === 'gradient' ? paint.fill.angle : 180} min={0} max={360} suffix="°"
              onChange={(angle) => paint.fill.type === 'gradient' && setFill({ ...paint.fill, angle })} />
          </>
        ) : (
          <Swatches colors={captionColors} label="Color de la letra"
            value={paint.fill.type === 'solid' ? paint.fill.color : typography.color}
            onPick={(color) => setFill({ type: 'solid', color })} />
        )}
      </div>

      <div className="tuner-block">
        <h4>Contorno</h4>
        <Slider label="Grosor" value={inner.width} min={0} max={16} step={0.5} suffix=" px"
          onChange={(width) => setStrokes(width === 0 && !outer ? [] : [{ ...inner, width }, ...(outer ? [outer] : [])])} />
        {inner.width > 0 && (
          <Swatches colors={outlineColors} label="Color del contorno" value={inner.color}
            onPick={(color) => setStrokes([{ ...inner, color }, ...(outer ? [outer] : [])])} />
        )}
        <label className="toggle-row">
          <span>
            <strong>Segundo contorno</strong>
            <small>Un trazo de color por fuera del primero.</small>
          </span>
          <input type="checkbox" checked={Boolean(outer)} aria-label="Segundo contorno"
            onChange={(event) => setStrokes(event.target.checked
              ? [{ ...inner, width: inner.width || 4 }, { color: '#D6FF4B', width: (inner.width || 4) + 4 }]
              : [{ ...inner }])} />
        </label>
        {outer && (
          <>
            <Slider label="Grosor del segundo" value={outer.width} min={inner.width} max={22} step={0.5} suffix=" px"
              onChange={(width) => setStrokes([inner, { ...outer, width }])} />
            <Swatches colors={captionColors} label="Color del segundo contorno" value={outer.color}
              onPick={(color) => setStrokes([inner, { ...outer, color }])} />
          </>
        )}
      </div>

      <div className="tuner-block">
        <h4>Sombra</h4>
        <p className="hint">Con desenfoque en 0 y distancia alta se obtiene el efecto 3D duro.</p>
        <Slider label="Distancia horizontal" value={paint.shadowX} min={-24} max={24} suffix=" px"
          onChange={(shadowX) => onChange({ shadowX })} />
        <Slider label="Distancia vertical" value={paint.shadowY} min={-24} max={24} suffix=" px"
          onChange={(shadowY) => onChange({ shadowY })} />
        <Slider label="Desenfoque" value={paint.shadowBlur} min={0} max={48} suffix=" px"
          onChange={(shadowBlur) => onChange({ shadowBlur })} />
        <Slider label="Fuerza" value={paint.shadowOpacity} min={0} max={1} step={0.05}
          onChange={(shadowOpacity) => onChange({ shadowOpacity })} />
        {paint.shadowOpacity > 0 && (
          <Swatches colors={outlineColors} label="Color de la sombra" value={paint.shadowColor}
            onPick={(shadowColor) => onChange({ shadowColor })} />
        )}
      </div>

      <div className="tuner-block">
        <h4>Resplandor</h4>
        <Slider label="Tamaño" value={paint.glow?.radius ?? 0} min={0} max={30} suffix=" px"
          onChange={(radius) => onChange({
            glow: radius === 0 ? null : { color: paint.glow?.color ?? '#FF2D1F', intensity: paint.glow?.intensity ?? 3, radius },
          })} />
        {paint.glow && paint.glow.radius > 0 && (
          <>
            <Slider label="Capas" value={paint.glow.intensity} min={1} max={4}
              onChange={(intensity) => onChange({ glow: { ...paint.glow!, intensity } })} />
            <Swatches colors={captionColors} label="Color del resplandor" value={paint.glow.color}
              onPick={(color) => onChange({ glow: { ...paint.glow!, color } })} />
          </>
        )}
      </div>

      <div className="tuner-block">
        <h4>Caja de fondo</h4>
        <label className="toggle-row">
          <span>
            <strong>Caja detrás del texto</strong>
            <small>Una por renglón. Es lo más legible sobre video movido.</small>
          </span>
          <input type="checkbox" checked={Boolean(paint.box)} aria-label="Caja detrás del texto"
            onChange={(event) => onChange({
              box: event.target.checked ? { color: '#FFFFFF', paddingX: 26, paddingY: 10, radius: 12 } : null,
            })} />
        </label>
        {paint.box && (
          <>
            <Swatches colors={captionColors} label="Color de la caja" value={paint.box.color}
              onPick={(color) => onChange({ box: { ...paint.box!, color } })} />
            <Slider label="Redondeo" value={paint.box.radius} min={0} max={60} suffix=" px"
              onChange={(radius) => onChange({ box: { ...paint.box!, radius } })} />
            <Slider label="Aire a los costados" value={paint.box.paddingX} min={0} max={70} suffix=" px"
              onChange={(paddingX) => onChange({ box: { ...paint.box!, paddingX } })} />
          </>
        )}
      </div>

      <div className="tuner-block">
        <h4>Espaciado</h4>
        <Slider label="Entre letras" value={typography.letterSpacing} min={-20} max={40} suffix=" px"
          onChange={(letterSpacing) => onChange({ letterSpacing })} />
        <Slider label="Entre renglones" value={typography.lineHeight} min={0.75} max={2.2} step={0.02} suffix="×"
          onChange={(lineHeight) => onChange({ lineHeight })} />
      </div>
    </details>
  );
};
