import { signal } from '@preact/signals';
import { db, newId } from '../db/schema';
import { navigate } from '../router';
import { lastLoadFor, localDate } from '../services/sessionMath';
import { beep, buzz, keepScreenAwake, releaseScreen, unlockAudio } from '../services/wakeAndSound';
import type { Session, SetLog, Workout } from '../types';
import { markEntryDone } from './plan';
import { getWorkout, refName } from './workouts';

/**
 * L'allenamento in corso.
 *
 * Vive in un signal e viene salvato in IndexedDB a ogni modifica: se il
 * telefono blocca lo schermo, se Safari scarica la scheda, se cade la
 * batteria, riaprendo l'app l'allenamento è ancora lì con le serie già fatte.
 * È il requisito più importante di tutta la schermata.
 */

const ACTIVE_KEY = 'activeSession';

export interface RestState {
  /** Quando finisce il recupero, in ms epoch. Null se non si sta recuperando. */
  endsAt: number | null;
  /** Durata impostata, per ridisegnare la barra. */
  totalSec: number;
}

export const active = signal<Session | null>(null);
export const currentIndex = signal(0);
export const rest = signal<RestState>({ endsAt: null, totalSec: 0 });
export const sessions = signal<Session[]>([]);
export const sessionsLoaded = signal(false);

/** Tick globale: fa ridisegnare cronometro e recupero una volta al secondo. */
export const now = signal(Date.now());
let ticker: number | undefined;

function startTicking(): void {
  if (ticker) return;
  ticker = window.setInterval(() => {
    now.value = Date.now();
    const r = rest.value;
    if (r.endsAt && Date.now() >= r.endsAt) {
      rest.value = { endsAt: null, totalSec: 0 };
      beep();
      buzz();
    }
  }, 1000);
}

function stopTicking(): void {
  if (ticker) window.clearInterval(ticker);
  ticker = undefined;
}

export async function loadSessions(): Promise<void> {
  const [all, saved] = await Promise.all([db.sessions.toArray(), db.settings.get(ACTIVE_KEY)]);
  sessions.value = all.sort((a, b) => b.startedAt - a.startedAt);
  sessionsLoaded.value = true;

  const restored = saved?.value as { session: Session; index: number } | undefined;
  if (restored?.session) {
    active.value = restored.session;
    currentIndex.value = restored.index ?? 0;
    startTicking();
    void keepScreenAwake();
  }
}

async function persist(): Promise<void> {
  if (active.value) {
    await db.settings.put({ key: ACTIVE_KEY, value: { session: active.value, index: currentIndex.value } });
  } else {
    await db.settings.delete(ACTIVE_KEY);
  }
}

/**
 * Prepara la sessione dalla scheda: una entry per esercizio, con le serie già
 * pronte e il carico dell'ultima volta precompilato. In palestra nessuno si
 * ricorda a quanto era, e riscriverlo ogni volta è il modo migliore per
 * smettere di loggare.
 */
export async function startSession(workoutId: string, planEntryId?: string): Promise<boolean> {
  const workout: Workout | undefined = getWorkout(workoutId);
  if (!workout) return false;

  const session: Session = {
    id: newId('s'),
    date: localDate(),
    workoutId,
    planEntryId,
    name: workout.name,
    startedAt: Date.now(),
    entries: workout.items.map((item) => {
      const previous = lastLoadFor(sessions.value, item.ref);
      const weight = item.load ?? previous;
      const reps = parseInt(item.reps, 10);
      const setLogs: SetLog[] = Array.from({ length: Math.max(1, item.sets) }, () => ({
        reps: Number.isFinite(reps) ? reps : 10,
        weight,
        done: false,
        restSec: item.restSec ?? 90,
      }));
      return { ref: item.ref, name: refName(item.ref), setLogs };
    }),
  };

  active.value = session;
  currentIndex.value = 0;
  rest.value = { endsAt: null, totalSec: 0 };
  unlockAudio(); // siamo dentro il tap dell'utente: è l'unico momento buono
  void keepScreenAwake();
  startTicking();
  await persist();
  return true;
}

/**
 * Inizia l'allenamento, oppure riapre quello già in corso: due allenamenti
 * aperti insieme non hanno senso e perderebbero dati.
 */
export async function startOrResume(workoutId: string): Promise<void> {
  if (!active.value) await startSession(workoutId);
  navigate('allenamento');
}

function mutate(change: (s: Session) => Session): void {
  if (!active.value) return;
  active.value = change(active.value);
  void persist();
}

/** Aggiorna una serie senza segnarla fatta (modifica di ripetizioni o carico). */
export function patchSet(entryIndex: number, setIndex: number, patch: Partial<SetLog>): void {
  mutate((s) => ({
    ...s,
    entries: s.entries.map((e, i) =>
      i !== entryIndex ? e : { ...e, setLogs: e.setLogs.map((l, j) => (j !== setIndex ? l : { ...l, ...patch })) }
    ),
  }));
}

/**
 * Serie fatta: la marca, copia ripetizioni e carico sulla serie successiva
 * (è quasi sempre uguale) e fa partire il recupero.
 */
export function completeSet(entryIndex: number, setIndex: number): void {
  const entry = active.value?.entries[entryIndex];
  const set = entry?.setLogs[setIndex];
  if (!entry || !set) return;

  mutate((s) => ({
    ...s,
    entries: s.entries.map((e, i) => {
      if (i !== entryIndex) return e;
      return {
        ...e,
        setLogs: e.setLogs.map((l, j) => {
          if (j === setIndex) return { ...l, done: true };
          if (j === setIndex + 1 && !l.done) return { ...l, reps: set.reps, weight: set.weight };
          return l;
        }),
      };
    }),
  }));

  const seconds = set.restSec ?? 90;
  if (seconds > 0) rest.value = { endsAt: Date.now() + seconds * 1000, totalSec: seconds };
}

/** Annulla l'ultima serie segnata, perché il tasto grosso si preme per sbaglio. */
export function undoSet(entryIndex: number, setIndex: number): void {
  patchSet(entryIndex, setIndex, { done: false });
  rest.value = { endsAt: null, totalSec: 0 };
}

export function addSet(entryIndex: number): void {
  mutate((s) => ({
    ...s,
    entries: s.entries.map((e, i) => {
      if (i !== entryIndex) return e;
      const last = e.setLogs[e.setLogs.length - 1];
      return { ...e, setLogs: [...e.setLogs, { ...last, done: false }] };
    }),
  }));
}

export function goToExercise(index: number): void {
  const total = active.value?.entries.length ?? 0;
  currentIndex.value = Math.min(Math.max(0, index), Math.max(0, total - 1));
  void persist();
}

/* ------------------------------------------------------------- recupero */

export function addRest(seconds: number): void {
  const r = rest.value;
  if (!r.endsAt) return;
  rest.value = { endsAt: r.endsAt + seconds * 1000, totalSec: r.totalSec + seconds };
}

export function skipRest(): void {
  rest.value = { endsAt: null, totalSec: 0 };
}

export function restRemainingMs(): number {
  const r = rest.value;
  return r.endsAt ? Math.max(0, r.endsAt - now.value) : 0;
}

/* ------------------------------------------------------------ chiusura */

/**
 * Workout completato: scrive la sessione nello storico e chiude tutto.
 * Le serie non fatte restano registrate come non fatte — lo storico deve
 * essere onesto, non lusinghiero.
 */
export async function finishSession(): Promise<Session | null> {
  const session = active.value;
  if (!session) return null;

  const finished: Session = { ...session, endedAt: Date.now() };
  await db.sessions.put(finished);
  sessions.value = [finished, ...sessions.value];

  // È qui che si accende la cella del favo.
  if (finished.planEntryId) await markEntryDone(finished.planEntryId, finished.id);

  active.value = null;
  currentIndex.value = 0;
  rest.value = { endsAt: null, totalSec: 0 };
  stopTicking();
  releaseScreen();
  await persist();
  return finished;
}

/** Butta via l'allenamento in corso senza registrarlo. */
export async function discardSession(): Promise<void> {
  active.value = null;
  currentIndex.value = 0;
  rest.value = { endsAt: null, totalSec: 0 };
  stopTicking();
  releaseScreen();
  await persist();
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
  sessions.value = sessions.value.filter((s) => s.id !== id);
}
