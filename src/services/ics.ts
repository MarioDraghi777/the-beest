import type { Plan, PlanEntry, Workout } from '../types';

/**
 * Esportazione delle sedute nel Calendario del telefono.
 *
 * Su iPhone il web non può programmare notifiche per conto proprio: niente
 * background sync, niente notifiche a tempo, e Web Push vorrebbe un server
 * acceso più l'app installata sulla Home. Il Calendario di iOS invece fa
 * esattamente questo mestiere, e lo fa meglio: l'avviso arriva con l'app
 * chiusa, senza rete, e anche se l'app viene disinstallata.
 *
 * Dettaglio che evita il disastro classico: ogni evento ha un UID stabile
 * derivato dall'id della seduta, e un SEQUENCE che cresce a ogni export. Così
 * riesportando un piano modificato gli eventi si AGGIORNANO invece di
 * duplicarsi, e il calendario non diventa illeggibile dopo tre ritocchi.
 */

const DOMAIN = 'the-beest.app';

/** Testo ICS: le righe lunghe vanno spezzate a 75 ottetti con uno spazio iniziale. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

/** Nel testo ICS virgole, punti e virgola, barre e a capo vanno protetti. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Orario locale "fluttuante", senza fuso: è la forma giusta per un impegno
 * personale. Se vai in palestra alle 18:30 e ti sposti di fuso, l'allenamento
 * resta alle 18:30 di dove sei, che è quello che vuoi.
 */
function localTime(dateISO: string, time: string, addMinutes = 0): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const date = new Date(y, m - 1, d, hh, mm + addMinutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T` +
    `${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
}

export interface IcsOptions {
  /** Ora di inizio, "18:30". */
  time: string;
  /** Durata prevista in minuti. */
  durationMin: number;
  /** Minuti di anticipo dell'avviso. */
  alarmMin: number;
  /** Cresce a ogni export: è quello che fa aggiornare gli eventi già importati. */
  sequence: number;
}

export function buildIcs(
  plan: Pick<Plan, 'id' | 'name'>,
  entries: PlanEntry[],
  workouts: Workout[],
  options: IcsOptions
): string {
  const dtstamp = stamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//The Beest//Piano di allenamento//IT`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(plan.name)}`,
  ];

  for (const entry of entries) {
    const workout = workouts.find((w) => w.id === entry.workoutId);
    const title = workout?.name ?? 'Allenamento';
    const exercises = workout?.items.length ?? 0;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${entry.id}@${DOMAIN}`,
      `DTSTAMP:${dtstamp}`,
      `SEQUENCE:${options.sequence}`,
      `DTSTART:${localTime(entry.date, options.time)}`,
      `DTEND:${localTime(entry.date, options.time, options.durationMin)}`,
      fold(`SUMMARY:${escapeText(`🐝 ${title}`)}`),
      fold(
        `DESCRIPTION:${escapeText(
          `${exercises} esercizi${workout ? ` · ${workout.items.reduce((s, i) => s + i.sets, 0)} serie` : ''}\n${plan.name}`
        )}`
      ),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE'
    );

    if (options.alarmMin > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:-PT${options.alarmMin}M`,
        fold(`DESCRIPTION:${escapeText(`Fra poco: ${title}`)}`),
        'END:VALARM'
      );
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Scarica un file di testo. Su iOS apre il foglio di condivisione di Safari. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
