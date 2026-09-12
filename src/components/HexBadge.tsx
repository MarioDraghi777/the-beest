interface Props {
  /** Etichetta italiana completa, es. "Pettorali". */
  label: string;
  /** Ruolo mostrato sotto, es. "TARGET". */
  role: string;
  /** Badge secondario: stesso esagono, colori smorzati. */
  muted?: boolean;
}

/**
 * Il badge esagonale: muscolo o attrezzo, leggibile a colpo d'occhio.
 * L'esagono è il modulo dell'identità, qui è al suo posto perché sta su
 * un'informazione atomica e ripetuta.
 */
export function HexBadge({ label, role, muted }: Props) {
  const abbr = label.slice(0, 3).toUpperCase();
  return (
    <div class="hexbadge" title={label} aria-label={`${role}: ${label}`}>
      <b style={muted ? { color: 'var(--drone)' } : undefined}>{abbr}</b>
      <span>{role}</span>
    </div>
  );
}
