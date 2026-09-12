import type { Workout, WorkoutItem } from '../types';

/**
 * Conti e formattazione delle schede. Funzioni pure, senza database: stanno
 * qui separate perché sono quelle che si sbagliano facilmente e vanno testate.
 */

export function countSets(workout: Pick<Workout, 'items'>): number {
  return workout.items.reduce((sum, i) => sum + (Number(i.sets) || 0), 0);
}

/**
 * Durata stimata in minuti: 30 secondi a serie di lavoro più il recupero
 * dichiarato. È una stima e va detto che lo è; serve a capire se una scheda
 * sta in un'ora, non a cronometrare.
 */
export function estimateMinutes(workout: Pick<Workout, 'items'>): number {
  const seconds = workout.items.reduce((sum, i) => {
    const sets = Number(i.sets) || 0;
    return sum + sets * (30 + (i.restSec ?? 90));
  }, 0);
  return Math.round(seconds / 60);
}

/** Riassunto di una riga: "4×8 · 82.5 kg · rec 90″". */
export function summary(item: WorkoutItem): string {
  const parts = [`${item.sets}×${item.reps || '—'}`];
  if (item.loadUnit === 'corpo') parts.push('corpo libero');
  else if (item.load != null) parts.push(`${item.load} ${item.loadUnit ?? 'kg'}`);
  if (item.restSec) parts.push(`rec ${item.restSec}″`);
  if (item.tempo) parts.push(item.tempo);
  return parts.join(' · ');
}

/** Scambia due righe. Fuori range non fa niente, invece di rompere l'ordine. */
export function swap<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const out = [...list];
  [out[index], out[target]] = [out[target], out[index]];
  return out;
}
