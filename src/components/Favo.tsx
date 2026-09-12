import type { FavoDay } from '../services/planMath';

interface Props {
  days: FavoDay[];
  today: string;
  /** Volume oltre il quale una cella piena diventa gradiente: "giornata pesante". */
  heavyVolume?: number;
  onPick?: (date: string) => void;
}

const PER_ROW = 19;

/**
 * Il favo dell'anno: una cella esagonale per giorno, 365 in una schermata.
 *
 * Le celle sono da 18 px, sotto il minimo di 48 che l'app si è data per i
 * bersagli: qui è voluto. Il favo è un colpo d'occhio, non un pannello di
 * controllo — il tap apre il giorno in una scheda sotto, e il calendario
 * toccabile con celle da 28 px è quello della settimana.
 */
export function Favo({ days, today, heavyVolume = 5000, onPick }: Props) {
  const rows: FavoDay[][] = [];
  for (let i = 0; i < days.length; i += PER_ROW) rows.push(days.slice(i, i + PER_ROW));

  return (
    <div class="favo" role="img" aria-label={`Anno di allenamenti: ${days.filter((d) => d.state === 'done').length} giorni fatti`}>
      {rows.map((row, r) => (
        <div key={r} class={`favo-row${r % 2 ? ' odd' : ''}`}>
          {row.map((day) => {
            const heavy = day.state === 'done' && day.volume >= heavyVolume;
            const cell = (
              <span
                class={`cell ${day.state}${heavy ? ' heavy' : ''}`}
                title={day.date}
                onClick={onPick ? () => onPick(day.date) : undefined}
              />
            );
            return day.date === today ? (
              <span key={day.date} class="ring">
                {cell}
              </span>
            ) : (
              <span key={day.date} style={{ display: 'contents' }}>
                {cell}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function FavoLegend() {
  return (
    <div class="legend">
      <span>
        <i style={{ background: 'var(--honey)' }} />
        fatto
      </span>
      <span>
        <i style={{ background: 'rgba(255,192,0,.22)' }} />
        previsto
      </span>
      <span>
        <i style={{ background: 'rgba(255,74,61,.32)' }} />
        saltato
      </span>
      <span>
        <i style={{ background: 'var(--field)' }} />
        riposo
      </span>
    </div>
  );
}
