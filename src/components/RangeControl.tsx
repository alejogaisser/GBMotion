import { useEffect, useState } from 'react';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Show at most 2 decimals, and never a trailing ".00". */
const format = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
};

export const RangeControl = ({ label, value, min, max, step = 1, suffix = '', onChange }: Props) => {
  // Keep a local text buffer so the field can be briefly empty or "-" while typing
  // without snapping to the minimum on every keystroke.
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [value]);

  const type = (raw: string) => {
    setDraft(raw);
    const parsed = Number(raw);
    if (raw.trim() !== '' && !Number.isNaN(parsed)) onChange(clamp(parsed, min, max));
  };
  const commit = (raw: string) => {
    if (raw.trim() === '' || Number.isNaN(Number(raw))) setDraft(null);
    else { onChange(clamp(Number(raw), min, max)); setDraft(null); }
  };

  return (
    <label className="range-control">
      <span>
        <span>{label}</span>
        <span className="range-value">
          <input
            aria-label={`${label}, valor`}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft ?? format(value)}
            onChange={(event) => type(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') commit((event.target as HTMLInputElement).value); }}
          />
          <small>{suffix}</small>
        </span>
      </span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
};
