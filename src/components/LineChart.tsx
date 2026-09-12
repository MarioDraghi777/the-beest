interface Point {
  date: string;
  value: number;
}

interface Props {
  points: Point[];
  /** Unità mostrata sulle etichette, es. "kg". */
  unit?: string;
  height?: number;
}

/**
 * Grafico a linea in SVG, senza librerie.
 *
 * Una scala sola posiziona punti, griglia ed etichette, e ogni etichetta
 * indica un valore che il grafico tocca davvero. L'ultimo punto è marcato
 * perché è quello che si va a cercare: "a quanto sono adesso".
 */
export function LineChart({ points, unit = 'kg', height = 150 }: Props) {
  if (points.length < 2) {
    return (
      <p class="sub" style={{ textAlign: 'center', padding: '20px 0' }}>
        Serve almeno un secondo allenamento con questo esercizio per vedere una curva.
      </p>
    );
  }

  const W = 320;
  const H = height;
  const padLeft = 34;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 20;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Un po' di aria sopra e sotto, e mai un intervallo nullo.
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.1);
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const x = (i: number) => padLeft + (i / (points.length - 1)) * (W - padLeft - padRight);
  const y = (v: number) => padTop + (1 - (v - min) / (max - min)) * (H - padTop - padBottom);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - padBottom} L${padLeft} ${H - padBottom} Z`;

  const last = points[points.length - 1];
  const shortDate = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img" aria-label={`Andamento: da ${rawMin} a ${rawMax} ${unit}`}>
      {/* griglia: solo i due estremi, che sono gli unici valori da leggere */}
      {[rawMax, rawMin].map((v) => (
        <g key={v}>
          <line x1={padLeft} x2={W - padRight} y1={y(v)} y2={y(v)} stroke="var(--line)" stroke-width="1" />
          <text x={padLeft - 6} y={y(v) + 3.5} text-anchor="end" class="chart-label">
            {v}
          </text>
        </g>
      ))}

      <path d={area} fill="var(--honey)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--honey)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />

      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 2.5} fill="var(--honey)" />
      ))}
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="7.5" fill="none" stroke="var(--honey)" stroke-width="1.5" opacity="0.5" />

      <text x={padLeft} y={H - 6} text-anchor="start" class="chart-label">
        {shortDate(points[0].date)}
      </text>
      <text x={W - padRight} y={H - 6} text-anchor="end" class="chart-label">
        {shortDate(last.date)}
      </text>
    </svg>
  );
}
