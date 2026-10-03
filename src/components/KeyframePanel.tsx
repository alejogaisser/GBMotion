import type { TextLayer } from '../types/motion';
import { sampleTransform, type TransformKey } from '../engine/editorMotion';
import { RangeControl } from './RangeControl';

export function KeyframePanel({ layer, frame, onChange, onSeek }: { layer: TextLayer; frame: number; onChange: (keys: TransformKey[] | undefined) => void; onSeek: (frame: number) => void }) {
  const localFrame = Math.max(0, frame - layer.startFrame);
  const keys = layer.transformKeys ?? [];
  const value = sampleTransform(keys, localFrame);
  const put = (patch: Partial<TransformKey>) => {
    const key = { ...value, ...patch, frame: localFrame };
    onChange([...keys.filter((k) => k.frame !== localFrame), key].sort((a, b) => a.frame - b.frame));
  };
  return <details className="tuner"><summary>Keyframes de transformación</summary><fieldset className="tuner-block" disabled={layer.locked}>
    <p className="hint">Se suman al efecto de entrada y salida. Mové el playhead, guardá un punto y ajustá su transformación.</p>
    <button className="ghost-button" onClick={() => put({})}>Guardar punto en {(localFrame / 30).toFixed(2)} s</button>
    <div className="key-list">{keys.map((key) => <button className="ghost-button tiny" key={key.frame} aria-pressed={key.frame === localFrame} onClick={() => onSeek(layer.startFrame + key.frame)}>{(key.frame / 30).toFixed(2)} s</button>)}</div>
    {keys.length > 0 && <>
      <RangeControl label="Desplazamiento X" value={value.x} min={-1000} max={1000} onChange={(x) => put({ x })} />
      <RangeControl label="Desplazamiento Y" value={value.y} min={-1800} max={1800} onChange={(y) => put({ y })} />
      <RangeControl label="Escala animada" value={value.scale} min={0.1} max={4} step={0.05} onChange={(scale) => put({ scale })} />
      <RangeControl label="Giro animado" value={value.rotation} min={-360} max={360} onChange={(rotation) => put({ rotation })} />
      <RangeControl label="Opacidad animada" value={value.opacity} min={0} max={1} step={0.05} onChange={(opacity) => put({ opacity })} />
      <label className="field"><span>Transición hasta el próximo punto</span><select aria-label="Curva entre keyframes" value={value.easing} onChange={(e) => put({ easing: e.target.value as TransformKey['easing'] })}><option value="smooth">Suave</option><option value="linear">Lineal</option></select></label>
      <svg className="easing-preview" viewBox="0 0 100 35" aria-label={value.easing === 'smooth' ? 'Curva suave' : 'Curva lineal'}><path d={value.easing === 'smooth' ? 'M2 33 C50 33 50 2 98 2' : 'M2 33 L98 2'} /></svg>
      <div className="control-row"><button className="ghost-button" disabled={!keys.some((k) => k.frame === localFrame)} onClick={() => onChange(keys.filter((k) => k.frame !== localFrame))}>Borrar este punto</button><button className="ghost-button" onClick={() => onChange(undefined)}>Quitar keyframes</button></div>
    </>}
  </fieldset></details>;
}
