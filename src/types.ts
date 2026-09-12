/**
 * Modello dati dell'app.
 *
 * Il catalogo è statico e arriva da public/data (generato da tools/ingest.mjs).
 * Tutto il resto è roba dell'utente e vive in IndexedDB, sul suo dispositivo:
 * nessun account, nessun server, nessun dato che esce dal telefono se non
 * dentro un link di condivisione generato apposta.
 */

/* ------------------------------------------------------------------ catalogo */

/** Un esercizio del dataset, in formato compatto (chiavi corte = file più leggero). */
export interface Exercise {
  /** Identificativo a 4 cifre del dataset, es. "0025". */
  id: string;
  /** Nome inglese, come in palestra. Es. "barbell bench press". */
  name: string;
  /** Body part: chiave inglese, etichetta italiana nella tassonomia. */
  bp: string;
  /** Attrezzo. */
  eq: string;
  /** Muscolo target. */
  tg: string;
  /** Gruppo muscolare sinergista principale. */
  mg: string;
  /** Muscoli secondari. */
  sm: string[];
  /** Istruzioni passo passo, in italiano. */
  st: string[];
  /** Blob di ricerca precalcolato: nome + alias italiani + etichette. */
  q: string;
}

export interface TaxonomyEntry {
  key: string;
  label: string;
  count: number;
}

export interface Taxonomy {
  bodyParts: TaxonomyEntry[];
  equipment: TaxonomyEntry[];
  targets: TaxonomyEntry[];
  muscles: TaxonomyEntry[];
}

export interface CatalogMeta {
  generatedAt: string;
  count: number;
  source: string;
  language: string;
  mediaAttribution: string;
}

/* ----------------------------------------------------------- roba dell'utente */

/** Esercizio inventato dall'utente, non presente nel dataset. */
export interface CustomExercise {
  id: string;
  name: string;
  bp?: string;
  eq?: string;
  tg?: string;
  notes?: string;
  createdAt: number;
}

/** Riferimento a un esercizio: o del catalogo, o custom. */
export interface ExerciseRef {
  type: 'catalog' | 'custom';
  id: string;
}

export type LoadUnit = 'kg' | 'lb' | 'corpo' | 'elastico';

/** Una riga di scheda: l'esercizio con i suoi parametri. */
export interface WorkoutItem {
  ref: ExerciseRef;
  /** Numero di serie previste. */
  sets: number;
  /** Ripetizioni: testo libero perché "8-10", "max", "30s" sono tutti validi. */
  reps: string;
  load?: number;
  loadUnit?: LoadUnit;
  restSec?: number;
  /** Tempo di esecuzione, es. "3-0-1-0". */
  tempo?: string;
  notes?: string;
  /** Esercizi con la stessa lettera sono un superset. */
  supersetGroup?: string;
}

export interface Workout {
  id: string;
  name: string;
  notes?: string;
  tags: string[];
  items: WorkoutItem[];
  /** Se la scheda nasce dal clone di un'altra (propagazione nel piano). */
  originId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Un blocco del piano: mesociclo con il suo schema settimanale. */
export interface PlanBlock {
  id: string;
  name: string;
  /** Quante settimane dura. */
  weeks: number;
  focus?: string;
  /** Schema della settimana: 7 posizioni da lunedì, workoutId oppure null. */
  weekPattern: (string | null)[];
}

export interface Plan {
  id: string;
  name: string;
  /** Primo giorno del piano, formato YYYY-MM-DD. */
  startDate: string;
  blocks: PlanBlock[];
  createdAt: number;
  updatedAt: number;
}

export type PlanEntryStatus = 'previsto' | 'fatto' | 'saltato';

/**
 * Una singola seduta a calendario. Materializzata alla creazione del piano,
 * così spostare un allenamento al giovedì non rompe lo schema del blocco.
 * È anche la riga che colora la cella del favo.
 */
export interface PlanEntry {
  id: string;
  planId: string;
  blockId: string;
  /** YYYY-MM-DD. */
  date: string;
  workoutId: string;
  status: PlanEntryStatus;
  sessionId?: string;
}

export interface SetLog {
  reps: number;
  weight?: number;
  rpe?: number;
  done: boolean;
  restSec?: number;
}

export interface SessionEntry {
  ref: ExerciseRef;
  /** Nome congelato al momento dell'esecuzione: lo storico non deve cambiare. */
  name: string;
  setLogs: SetLog[];
}

/** Un allenamento effettivamente svolto. Non viene mai modificato a posteriori. */
export interface Session {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  workoutId?: string;
  planEntryId?: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  entries: SessionEntry[];
  notes?: string;
}

export interface Settings {
  key: string;
  value: unknown;
}
