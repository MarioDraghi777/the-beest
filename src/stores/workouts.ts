import { signal } from '@preact/signals';
import { db, newId } from '../db/schema';
import { getExercise } from '../services/catalog';
import { swap } from '../services/workoutFormat';
import type { CustomExercise, ExerciseRef, Workout, WorkoutItem } from '../types';

/**
 * Le schede e gli esercizi custom dell'utente.
 *
 * Tutto in IndexedDB, tutto in memoria: sono decine di record, non migliaia.
 * Ogni scrittura aggiorna il signal e il database insieme, così la UI non
 * deve mai rileggere per vedere il risultato di quello che ha appena fatto.
 */

export const workouts = signal<Workout[]>([]);
export const customExercises = signal<CustomExercise[]>([]);
export const workoutsLoaded = signal(false);

export async function loadWorkouts(): Promise<void> {
  const [w, c] = await Promise.all([db.workouts.toArray(), db.customExercises.toArray()]);
  workouts.value = w.sort((a, b) => b.updatedAt - a.updatedAt);
  customExercises.value = c.sort((a, b) => a.name.localeCompare(b.name));
  workoutsLoaded.value = true;
}

export function getWorkout(id: string): Workout | undefined {
  return workouts.value.find((w) => w.id === id);
}

export async function createWorkout(name = 'Nuova scheda'): Promise<Workout> {
  const now = Date.now();
  const workout: Workout = {
    id: newId('w'),
    name,
    tags: [],
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.workouts.put(workout);
  workouts.value = [workout, ...workouts.value];
  return workout;
}

export async function saveWorkout(workout: Workout): Promise<void> {
  const updated = { ...workout, updatedAt: Date.now() };
  await db.workouts.put(updated);
  workouts.value = [updated, ...workouts.value.filter((w) => w.id !== workout.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt
  );
}

/** Modifica mirata: prende la scheda, applica la funzione, salva. */
export async function updateWorkout(id: string, change: (w: Workout) => Workout): Promise<void> {
  const current = getWorkout(id);
  if (!current) return;
  await saveWorkout(change(current));
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.delete(id);
  workouts.value = workouts.value.filter((w) => w.id !== id);
}

/**
 * Duplica una scheda. Serve all'utente ("Upper A pesante" partendo da
 * "Upper A") e servirà al piano annuale per la propagazione delle modifiche:
 * "solo questa occorrenza" è esattamente un clone con originId.
 */
export async function duplicateWorkout(id: string, name?: string): Promise<Workout | undefined> {
  const source = getWorkout(id);
  if (!source) return undefined;
  const now = Date.now();
  const copy: Workout = {
    ...source,
    id: newId('w'),
    name: name ?? `${source.name} (copia)`,
    originId: source.originId ?? source.id,
    items: source.items.map((i) => ({ ...i })),
    createdAt: now,
    updatedAt: now,
  };
  await db.workouts.put(copy);
  workouts.value = [copy, ...workouts.value];
  return copy;
}

/* ------------------------------------------------------------------- righe */

/** Valori di partenza di una riga nuova: 3×10, recupero 90". */
export function defaultItem(ref: ExerciseRef): WorkoutItem {
  return { ref, sets: 3, reps: '10', restSec: 90, loadUnit: 'kg' };
}

export async function addItem(workoutId: string, ref: ExerciseRef): Promise<void> {
  await updateWorkout(workoutId, (w) => ({ ...w, items: [...w.items, defaultItem(ref)] }));
}

export async function replaceItem(workoutId: string, index: number, item: WorkoutItem): Promise<void> {
  await updateWorkout(workoutId, (w) => ({
    ...w,
    items: w.items.map((old, i) => (i === index ? item : old)),
  }));
}

export async function removeItem(workoutId: string, index: number): Promise<void> {
  await updateWorkout(workoutId, (w) => ({ ...w, items: w.items.filter((_, i) => i !== index) }));
}

export async function moveItem(workoutId: string, index: number, delta: number): Promise<void> {
  await updateWorkout(workoutId, (w) => ({ ...w, items: swap(w.items, index, delta) }));
}

/* --------------------------------------------------------- esercizi custom */

export async function createCustomExercise(data: Omit<CustomExercise, 'id' | 'createdAt'>): Promise<CustomExercise> {
  const exercise: CustomExercise = { ...data, id: newId('c'), createdAt: Date.now() };
  await db.customExercises.put(exercise);
  customExercises.value = [...customExercises.value, exercise].sort((a, b) => a.name.localeCompare(b.name));
  return exercise;
}

export function getCustomExercise(id: string): CustomExercise | undefined {
  return customExercises.value.find((c) => c.id === id);
}

/** Nome da mostrare per un riferimento, qualunque sia la sua origine. */
export function refName(ref: ExerciseRef): string {
  if (ref.type === 'catalog') return getExercise(ref.id)?.name ?? `esercizio ${ref.id}`;
  return getCustomExercise(ref.id)?.name ?? 'esercizio rimosso';
}

/* ------------------------------------------------------------------ conti */

export { countSets, estimateMinutes, summary } from '../services/workoutFormat';
