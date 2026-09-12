import type { Plan, PlanEntry, Session } from '../types';

/**
 * Date e calendario del piano. Tutto in stringhe YYYY-MM-DD e in fuso locale:
 * un allenamento delle 21 di mercoledì deve restare mercoledì, e con gli
 * oggetti Date in UTC finirebbe a giovedì. Nessuna libreria di date.
 */

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** 0 = lunedì … 6 = domenica, che è come si legge una settimana in Italia. */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

/** Il lunedì della settimana di quella data. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function daysBetween(fromISO: string, toISO2: string): number {
  return Math.round((parseISO(toISO2).getTime() - parseISO(fromISO).getTime()) / 86400000);
}

export const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/* ------------------------------------------------------- generazione piano */

export interface GeneratedEntry {
  blockId: string;
  date: string;
  workoutId: string;
  /** Numero di settimana dall'inizio del piano, a partire da 1. */
  week: number;
}

/**
 * Materializza le sedute del piano, una per giorno previsto.
 *
 * Si materializzano invece di calcolarle al volo perché devono poter essere
 * spostate una per una: se questa settimana il mercoledì salta e recuperi
 * giovedì, lo schema del blocco non deve cambiare per questo.
 */
export function generateEntries(plan: Pick<Plan, 'startDate' | 'blocks'>): GeneratedEntry[] {
  const out: GeneratedEntry[] = [];
  let weekOffset = 0;

  for (const block of plan.blocks) {
    for (let w = 0; w < block.weeks; w++) {
      for (let day = 0; day < 7; day++) {
        const workoutId = block.weekPattern[day];
        if (!workoutId) continue;
        out.push({
          blockId: block.id,
          workoutId,
          date: addDays(plan.startDate, (weekOffset + w) * 7 + day),
          week: weekOffset + w + 1,
        });
      }
    }
    weekOffset += block.weeks;
  }
  return out;
}

export function planWeeks(plan: Pick<Plan, 'blocks'>): number {
  return plan.blocks.reduce((sum, b) => sum + b.weeks, 0);
}

/** In che settimana del piano cade una data (1-based); 0 se è fuori piano. */
export function weekOf(plan: Pick<Plan, 'startDate' | 'blocks'>, iso: string): number {
  const offset = daysBetween(plan.startDate, iso);
  if (offset < 0) return 0;
  const week = Math.floor(offset / 7) + 1;
  return week > planWeeks(plan) ? 0 : week;
}

/** Il blocco in cui cade una settimana del piano. */
export function blockOfWeek(plan: Pick<Plan, 'blocks'>, week: number): { index: number; from: number; to: number } | null {
  let from = 1;
  for (let i = 0; i < plan.blocks.length; i++) {
    const to = from + plan.blocks[i].weeks - 1;
    if (week >= from && week <= to) return { index: i, from, to };
    from = to + 1;
  }
  return null;
}

/* ------------------------------------------------------------------- favo */

export type DayState = 'done' | 'planned' | 'skipped' | 'rest';

export interface FavoDay {
  date: string;
  state: DayState;
  /** Volume della giornata, per distinguere le celle piene da quelle piene forte. */
  volume: number;
}

/**
 * Lo stato di ogni giorno dell'anno.
 *
 * Regole, in ordine di precedenza: se quel giorno hai chiuso un allenamento
 * la cella è accesa, punto — anche se non era previsto. Se era previsto ed è
 * passato senza allenamento, è saltato. Se è previsto e deve ancora venire,
 * è in attesa. Tutto il resto è riposo, che non è un fallimento.
 */
export function favoYear(
  year: number,
  entries: Pick<PlanEntry, 'date'>[],
  sessions: Pick<Session, 'date' | 'entries'>[],
  todayISO: string
): FavoDay[] {
  const planned = new Set(entries.map((e) => e.date));
  const volumeByDate = new Map<string, number>();
  for (const s of sessions) {
    const volume = s.entries.reduce(
      (sum, e) => sum + e.setLogs.reduce((v, l) => v + (l.done && l.weight ? l.reps * l.weight : 0), 0),
      0
    );
    volumeByDate.set(s.date, (volumeByDate.get(s.date) ?? 0) + volume);
  }

  const days: FavoDay[] = [];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const total = isLeap ? 366 : 365;
  let date = `${year}-01-01`;

  for (let i = 0; i < total; i++) {
    const trained = volumeByDate.has(date);
    const state: DayState = trained
      ? 'done'
      : planned.has(date)
        ? date < todayISO
          ? 'skipped'
          : 'planned'
        : 'rest';
    days.push({ date, state, volume: volumeByDate.get(date) ?? 0 });
    date = addDays(date, 1);
  }
  return days;
}

/**
 * Settimane consecutive con almeno un allenamento, contando all'indietro dalla
 * settimana corrente. La settimana in corso conta solo se ci hai già messo
 * qualcosa dentro: altrimenti il lunedì mattina azzererebbe la serie di
 * chiunque, che è il modo più stupido di demotivare.
 */
export function weekStreak(sessions: Pick<Session, 'date'>[], todayISO: string): number {
  const weeks = new Set(sessions.map((s) => startOfWeek(s.date)));
  let streak = 0;
  let week = startOfWeek(todayISO);
  if (!weeks.has(week)) week = addDays(week, -7);
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

/** Percentuale di sedute previste e fatte, sui giorni già passati. */
export function adherence(days: FavoDay[], todayISO: string): number | null {
  const past = days.filter((d) => d.date <= todayISO && (d.state === 'done' || d.state === 'skipped'));
  if (!past.length) return null;
  const done = past.filter((d) => d.state === 'done').length;
  return Math.round((done / past.length) * 100);
}
