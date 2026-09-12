import type { ExerciseRef, Session } from '../types';
import { bestSet, sameRef } from './sessionMath';

/**
 * Progressione dei carichi nel tempo.
 *
 * Il numero che conta non è sempre lo stesso: chi fa forza guarda il carico
 * massimo, chi fa ipertrofia guarda il volume. Qui si calcolano entrambi più
 * il massimale stimato, che è l'unico modo di confrontare una serie da 5×100
 * con una da 10×80 — e si dice chiaramente che è una stima.
 */

export interface TrainedExercise {
  ref: ExerciseRef;
  name: string;
  /** Quante volte l'hai allenato. */
  sessions: number;
  lastDate: string;
}

export interface ProgressPoint {
  date: string;
  /** Carico della serie più pesante di quella giornata. */
  weight: number;
  reps: number;
  /** Volume dell'esercizio in quella sessione. */
  volume: number;
  /** Massimale stimato con la formula di Epley. */
  estimated1RM: number;
}

/**
 * Massimale stimato: carico × (1 + ripetizioni / 30).
 * Sopra le 12 ripetizioni la formula perde senso e non la si applica più:
 * meglio nessun numero che un numero inventato.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (!weight || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return Math.round(weight * (1 + 12 / 30) * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Gli esercizi che hai davvero allenato, dal più recente. */
export function trainedExercises(sessions: Session[]): TrainedExercise[] {
  const map = new Map<string, TrainedExercise>();

  for (const session of sessions) {
    for (const entry of session.entries) {
      if (!entry.setLogs.some((l) => l.done)) continue;
      const key = `${entry.ref.type}:${entry.ref.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.sessions++;
        if (session.date > existing.lastDate) existing.lastDate = session.date;
      } else {
        map.set(key, { ref: entry.ref, name: entry.name, sessions: 1, lastDate: session.date });
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => b.lastDate.localeCompare(a.lastDate) || b.sessions - a.sessions
  );
}

/** La serie di punti di un esercizio, in ordine di data. */
export function progressionFor(sessions: Session[], ref: ExerciseRef): ProgressPoint[] {
  const points: ProgressPoint[] = [];

  for (const session of sessions) {
    const entry = session.entries.find((e) => sameRef(e.ref, ref));
    if (!entry) continue;
    const done = entry.setLogs.filter((l) => l.done && l.weight);
    if (!done.length) continue;

    const best = bestSet(entry.setLogs);
    if (!best?.weight) continue;

    points.push({
      date: session.date,
      weight: best.weight,
      reps: best.reps,
      volume: done.reduce((sum, l) => sum + l.reps * (l.weight ?? 0), 0),
      estimated1RM: estimate1RM(best.weight, best.reps),
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface ProgressSummary {
  first: ProgressPoint;
  last: ProgressPoint;
  best: ProgressPoint;
  /** Differenza di carico fra la prima e l'ultima volta. */
  deltaWeight: number;
  /** Variazione percentuale, arrotondata. */
  deltaPercent: number;
}

export function summarize(points: ProgressPoint[]): ProgressSummary | null {
  if (points.length < 1) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const best = points.reduce((b, p) => (p.weight > b.weight ? p : b));
  const deltaWeight = Math.round((last.weight - first.weight) * 10) / 10;
  const deltaPercent = first.weight ? Math.round(((last.weight - first.weight) / first.weight) * 100) : 0;
  return { first, last, best, deltaWeight, deltaPercent };
}
