interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Suffisso mostrato accanto al numero, es. "s". */
  unit?: string;
}

/**
 * Numero con meno e più. In palestra, con le mani sudate e una sola libera,
 * due bersagli da 48 px battono qualunque tastiera numerica.
 */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 999, unit }: Props) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div class="stepper">
      <span class="stepper-label">{label}</span>
      <div class="stepper-controls">
        <button
          class="icon-btn"
          type="button"
          onClick={() => set(value - step)}
          aria-label={`Diminuisci ${label}`}
          disabled={value <= min}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <span class="num stepper-value">
          {value}
          {unit}
        </span>
        <button
          class="icon-btn"
          type="button"
          onClick={() => set(value + step)}
          aria-label={`Aumenta ${label}`}
          disabled={value >= max}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
