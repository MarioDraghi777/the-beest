import { signal } from '@preact/signals';
import { navigate } from '../router';
import { addItem, getWorkout } from './workouts';

/**
 * Modalità "scegli esercizi per una scheda".
 *
 * Invece di costruire un selettore a parte con la sua ricerca e i suoi filtri,
 * si riusa il Catalogo vero: quando c'è una scheda di destinazione, toccare
 * una riga aggiunge invece di aprire il dettaglio. Un motore di ricerca solo,
 * un comportamento solo da imparare.
 */

export const pickerWorkoutId = signal<string | null>(null);
/** Id degli esercizi aggiunti in questa sessione di scelta: feedback visivo. */
export const pickedNow = signal<string[]>([]);

export function startPicking(workoutId: string): void {
  pickerWorkoutId.value = workoutId;
  pickedNow.value = [];
  navigate('catalogo');
}

export function stopPicking(): void {
  const id = pickerWorkoutId.value;
  pickerWorkoutId.value = null;
  pickedNow.value = [];
  if (id) navigate('scheda', id);
}

export function pickerWorkoutName(): string {
  const id = pickerWorkoutId.value;
  return (id && getWorkout(id)?.name) || '';
}

export async function pick(exerciseId: string): Promise<void> {
  const id = pickerWorkoutId.value;
  if (!id) return;
  await addItem(id, { type: 'catalog', id: exerciseId });
  pickedNow.value = [...pickedNow.value, exerciseId];
}
