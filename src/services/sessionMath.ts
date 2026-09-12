import type { ExerciseRef, Session, SetLog } from '../types';

/**
 * Conti sulle sessioni. Funzioni pure e testate: sono i numeri che l'utente
 * guarda per decidere se sta migliorando, non possono sbagliare.
 */

/** mm:ss, oppure h:mm:ss oltre l'ora. Cifre sempre allineate. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Volume di una serie: ripetizioni × carico. Senza carico non fa volume. */
export function setVolume(set: SetLog): number {
  if (!set.done || !set.weight) return 0;
  return set.reps * set.weight;
}

export function sessionVolume(session: Pick<Session, 'entries'>): number {
  return session.entries.reduce(
    (sum, e) => sum + e.setLogs.reduce((s, log) => s + setVolume(log), 0),
    0
  );
}

export function countDoneSets(session: Pick<Session, 'entries'>): number {
  return session.entries.reduce((sum, e) => sum + e.setLogs.filter((l) => l.done).length, 0);
}

export function countPlannedSets(session: Pick<Session, 'entries'>): number {
  return session.entries.reduce((sum, e) => sum + e.setLogs.length, 0);
}

export function sameRef(a: ExerciseRef, b: ExerciseRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/**
 * Il carico migliore usato l'ultima volta su quell'esercizio, guardando le
 * sessioni dalla più recente. È il numero che l'app propone quando riapri la
 * stessa scheda: in palestra nessuno si ricorda a quanto era la volta prima.
 */
export function lastLoadFor(sessions: Session[], ref: ExerciseRef): number | undefined {
  const ordered = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  for (const session of ordered) {
    const entry = session.entries.find((e) => sameRef(e.ref, ref));
    if (!entry) continue;
    const weights = entry.setLogs.filter((l) => l.done && l.weight).map((l) => l.weight as number);
    if (weights.length) return Math.max(...weights);
  }
  return undefined;
}

/** Differenza di carico rispetto alla volta prima: serve alla freccia ↑ / ↓. */
export function loadDelta(sessions: Session[], ref: ExerciseRef, current?: number): number | undefined {
  if (current == null) return undefined;
  const previous = lastLoadFor(sessions, ref);
  if (previous == null) return undefined;
  const delta = Math.round((current - previous) * 10) / 10;
  return delta === 0 ? undefined : delta;
}

/**
 * Serie migliore di una entry: la più pesante, non quella col volume più alto.
 * A parità di carico vince quella con più ripetizioni. È il numero che un
 * atleta cerca nel riepilogo ("a quanto sono arrivato oggi"), e il volume
 * totale sta già da un'altra parte.
 */
export function bestSet(setLogs: SetLog[]): SetLog | undefined {
  const done = setLogs.filter((l) => l.done);
  if (!done.length) return undefined;
  return done.reduce((best, l) => {
    const w = l.weight ?? 0;
    const bw = best.weight ?? 0;
    if (w !== bw) return w > bw ? l : best;
    return l.reps > best.reps ? l : best;
  });
}

/** Data ISO YYYY-MM-DD nel fuso locale (mai toISOString, che sposta il giorno). */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** "mercoledì 12 settembre", senza librerie di date. */
export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${GIORNI[date.getDay()]} ${d} ${MESI[m - 1]}`;
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${GIORNI[date.getDay()].slice(0, 3)} ${d} ${MESI[m - 1].slice(0, 3)}`;
}
