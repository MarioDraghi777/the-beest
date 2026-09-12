import Dexie, { type Table } from 'dexie';
import type { CustomExercise, Plan, PlanEntry, Session, Settings, Workout } from '../types';

/**
 * Unico database dell'app (IndexedDB via Dexie). Tutto sul dispositivo:
 * nessuna chiamata di rete per leggere o scrivere.
 *
 * Su iPhone c'è un dettaglio che vale la pena ricordare: Safari cancella i
 * dati dei siti non aperti da 7 giorni, mentre una PWA aggiunta alla schermata
 * Home ne è esente. Per questo il primo avvio insiste sull'installazione, e
 * per questo l'export di backup fa parte del prodotto e non è un extra.
 */
export class BeestDB extends Dexie {
  workouts!: Table<Workout, string>;
  customExercises!: Table<CustomExercise, string>;
  plans!: Table<Plan, string>;
  planEntries!: Table<PlanEntry, string>;
  sessions!: Table<Session, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('the-beest');
    this.version(1).stores({
      // '*tags' è un indice multiEntry: "tutte le schede con il tag X" senza
      // scansionare la tabella.
      workouts: 'id, name, updatedAt, *tags',
      customExercises: 'id, name, createdAt',
      plans: 'id, startDate, updatedAt',
      // [planId+date] serve alla vista calendario, date da solo serve al favo.
      planEntries: 'id, planId, date, workoutId, status, [planId+date]',
      sessions: 'id, date, workoutId, planEntryId, startedAt',
      settings: 'key',
    });
  }
}

export const db = new BeestDB();

/** Id breve e ordinabile nel tempo: niente uuid, niente dipendenze. */
export function newId(prefix = ''): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${time}${rand}`;
}
