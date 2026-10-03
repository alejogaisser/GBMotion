import { AlignCenter, AlignLeft, AlignRight, CaseSensitive, Italic } from 'lucide-react';
import type { KeywordStyle, TypographySettings } from '../types/motion';
import { FontBrowser } from './FontBrowser';
import { RangeControl } from './RangeControl';
import { closestFontWeight, fontFromFamily, fontStack, supportsItalic } from '../typography/fontRegistry';
import { captionColors } from '../presets/palette';

type Props = {
  text: string;
  typography: TypographySettings;
  keywords: Record<number, KeywordStyle>;
  positionX: number;
  positionY: number;
  onText: (text: string) => void;
  onTypography: (patch: Partial<TypographySettings>) => void;
  onPosition: (patch: { positionX?: number; positionY?: number }) => void;
  onKeyword: (index: number) => void;
  onKeywordStyle: (index: number, patch: Partial<KeywordStyle>) => void;
  onKeywordRemove: (index: number) => void;
};

const alignments = [
  { id: 'left', label: 'Izquierda', Icon: AlignLeft },
  { id: 'center', label: 'Centro', Icon: AlignCenter },
  { id: 'right', label: 'Derecha', Icon: AlignRight },
] as const;

/**
 * Cambiar el color acá tiene que pisar el relleno del estilo, incluso cuando
 * el estilo traía un degradado. Por eso se escribe `fill` además de `color`.
 */
const withColor = (color: string): Partial<TypographySettings> => ({ color, fill: { type: 'solid', color } });

export const TextPanel = ({
  text, typography, keywords, positionX, positionY,
  onText, onTypography, onPosition, onKeyword, onKeywordStyle, onKeywordRemove,
}: Props) => {
  const font = fontFromFamily(typography.fontFamily);
  const words = text.split(/\s+/).filter(Boolean);
  const isGradient = typography.fill?.type === 'gradient';

  return (
    <div className="text-panel">
      <div className="panel-block">
        <h3>Tu frase</h3>
        <textarea
          className="caption-input"
          aria-label="Texto del subtítulo"
          value={text}
          rows={3}
          maxLength={180}
          placeholder="Escribí lo que querés que se lea"
          onChange={(event) => onText(event.target.value)}
        />
        <p className="hint">Enter parte la frase en dos líneas. Con un estilo de dos tipografías, la segunda línea usa la otra letra.</p>
      </div>

      <div className="panel-block">
        <h3>Letra</h3>
        <FontBrowser
          text={text}
          fontFamily={typography.fontFamily}
          onSelect={(definition) => onTypography({
            fontFamily: fontStack(definition),
            fontWeight: closestFontWeight(definition, typography.fontWeight),
            italic: typography.italic && supportsItalic(definition),
          })}
        />
        <label className="field"><span>Peso de la letra</span><select aria-label="Peso de la letra" value={closestFontWeight(font, typography.fontWeight)} onChange={(e) => onTypography({ fontWeight: Number(e.target.value) })}>
          {font.availableWeights.map((weight) => <option key={weight} value={weight}>{weight}{weight === 400 ? ' · Normal' : weight === 700 ? ' · Negrita' : weight === 900 ? ' · Muy gruesa' : ''}</option>)}
        </select></label>
        <RangeControl label="Tamaño" value={typography.fontSize} min={40} max={320} onChange={(fontSize) => onTypography({ fontSize })} />
        <div className="control-row">
          <div className="segmented" role="group" aria-label="Alineación">
            {alignments.map(({ id, label, Icon }) => (
              <button type="button" key={id} className={typography.textAlign === id ? 'on' : ''} aria-pressed={typography.textAlign === id}
                aria-label={label} title={label} onClick={() => onTypography({ textAlign: id })}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Estilo de la letra">
            <button type="button" className={typography.uppercase ? 'on' : ''} aria-pressed={typography.uppercase}
              aria-label="Mayúsculas" title="Mayúsculas" onClick={() => onTypography({ uppercase: !typography.uppercase })}>
              <CaseSensitive size={16} />
            </button>
            <button type="button" className={typography.italic ? 'on' : ''} aria-pressed={typography.italic}
              aria-label="Cursiva" title={supportsItalic(font) ? 'Cursiva' : 'Esta letra no tiene cursiva'}
              disabled={!supportsItalic(font)} onClick={() => onTypography({ italic: !typography.italic })}>
              <Italic size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="panel-block">
        <h3>Color</h3>
        {isGradient && <p className="hint">Este estilo usa un degradado. Si elegís un color, pasa a ser plano.</p>}
        <div className="swatch-row">
          {captionColors.map((swatch) => (
            <button type="button" key={swatch.color} className={`swatch ${!isGradient && typography.color.toLowerCase() === swatch.color.toLowerCase() ? 'on' : ''}`}
              style={{ background: swatch.color }} title={swatch.name} aria-label={swatch.name} onClick={() => onTypography(withColor(swatch.color))} />
          ))}
          <label className="swatch custom" title="Otro color">
            <input type="color" aria-label="Elegir otro color" value={typography.color} onChange={(event) => onTypography(withColor(event.target.value))} />
          </label>
        </div>
      </div>

      {words.length > 1 && (
        <div className="panel-block">
          <h3>Destacar una palabra</h3>
          <p className="hint">Tocá una palabra para pintarla distinto. Es lo que hace legible un subtítulo hablado.</p>
          <div className="word-row">
            {words.map((word, index) => {
              const active = Boolean(keywords[index]);
              return (
                <button type="button" key={`${word}-${index}`} className={`word-chip ${active ? 'on' : ''}`}
                  aria-pressed={active}
                  style={active ? { color: keywords[index].color, borderColor: keywords[index].color } : undefined}
                  onClick={() => (active ? onKeywordRemove(index) : onKeyword(index))}>
                  {word}
                </button>
              );
            })}
          </div>
          {Object.entries(keywords).map(([key, style]) => (
            <div className="keyword-edit" key={key}>
              <strong>{style.word}</strong>
              <div className="swatch-row">
                {captionColors.slice(0, 18).map((swatch) => (
                  <button type="button" key={swatch.color} className={`swatch small ${style.color.toLowerCase() === swatch.color.toLowerCase() ? 'on' : ''}`}
                    style={{ background: swatch.color }} aria-label={`Pintar ${style.word} de ${swatch.name}`}
                    onClick={() => onKeywordStyle(Number(key), { color: swatch.color })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel-block">
        <h3>Posición</h3>
        <p className="hint">También podés arrastrar el texto directamente sobre el video.</p>
        <RangeControl label="Izquierda / derecha" value={positionX} min={-460} max={460} onChange={(value) => onPosition({ positionX: value })} />
        <RangeControl label="Arriba / abajo" value={positionY} min={-820} max={820} onChange={(value) => onPosition({ positionY: value })} />
        <button type="button" className="ghost-button" onClick={() => onPosition({ positionX: 0, positionY: 0 })}>Volver al centro</button>
      </div>
    </div>
  );
};
