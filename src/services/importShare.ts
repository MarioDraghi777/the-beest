import { createPlan, emptyBlock } from '../stores/plan';
import {
  createCustomExercise,
  createWorkout,
  customExercises,
  saveWorkout,
} from '../stores/workouts';
import { startOfWeek } from './planMath';
import { localDate } from './sessionMath';
import type { WireSharedPlan, WireSharedWorkout, WirePayload } from './shareCodec';
import type { Workout, WorkoutItem } from '../types';
import { getExercise } from './catalog';

/**
 * Porta dentro l'app una scheda o un piano arrivati da un link.
 *
 * Gli esercizi del catalogo si riagganciano per id, che è lo stesso per tutti.
 * Quelli custom viaggiano come nome: qui si riusa un esercizio custom già
 * esistente con lo stesso nome invece di crearne un doppione, altrimenti dopo
 * tre schede ricevute l'elenco personale è pieno di cloni.
 */

async function refFor(wire: { e?: string; x?: string }): Promise<WorkoutItem['ref']> {
  if (wire.e && getExercise(wire.e)) return { type: 'catalog', id: wire.e };
  const name = (wire.x ?? 'Esercizio').trim();
  const existing = customExercises.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return { type: 'custom', id: existing.id };
  const created = await createCustomExercise({ name });
  return { type: 'custom', id: created.id };
}

async function buildWorkout(wire: { n: string; d?: string; i: WireSharedWorkout['i'] }): Promise<Workout> {
  const workout = await createWorkout(wire.n);
  const items: WorkoutItem[] = [];
  for (const raw of wire.i) {
    items.push({
      ref: await refFor(raw),
      sets: raw.s,
      reps: raw.r,
      load: raw.w,
      loadUnit: raw.u ?? 'kg',
      restSec: raw.p ?? 90,
      tempo: raw.t,
      notes: raw.n,
      supersetGroup: raw.g,
    });
  }
  const full: Workout = { ...workout, notes: wire.d, items };
  await saveWorkout(full);
  return full;
}

export async function importWorkout(wire: WireSharedWorkout): Promise<Workout> {
  return buildWorkout(wire);
}

/**
 * Importa un piano: prima le schede, poi il piano che le riaggancia per
 * posizione. La data di partenza diventa il lunedì di questa settimana, non
 * quella di chi l'ha mandato: un piano ricevuto a metà marzo non ha senso che
 * parta a gennaio.
 */
export async function importPlan(wire: WireSharedPlan): Promise<void> {
  const created: Workout[] = [];
  for (const w of wire.ws) created.push(await buildWorkout(w));

  const blocks = wire.b.map((b, i) => ({
    ...emptyBlock(b.n, b.w),
    id: `${Date.now().toString(36)}${i}`,
    weekPattern: b.p.map((index) => (index != null && created[index] ? created[index].id : null)),
  }));

  await createPlan(wire.n, startOfWeek(localDate()), blocks);
}

export async function importPayload(payload: WirePayload): Promise<void> {
  if (payload.t === 'w') await importWorkout(payload);
  else await importPlan(payload);
}
