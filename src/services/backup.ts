import { db } from '../db/schema';
import { toCsv } from './csv';
import { downloadFile } from './ics';
import { bestSet, countDoneSets, sessionVolume } from './sessionMath';
import type { CustomExercise, Plan, PlanEntry, Session, Workout } from '../types';
import { loadPlans } from '../stores/plan';
import { loadSessions } from '../stores/session';
import { loadWorkouts } from '../stores/workouts';

/**
 * Backup e ripristino.
 *
 * Senza account non esiste nessun recupero lato server: se cancelli i dati
 * del sito o cambi telefono, quello che non hai esportato non torna. Il
 * backup non è un extra di questa app, è l'unica rete di sicurezza — per
 * questo sta in prima pagina nelle impostazioni e non in fondo a un menu.
 */

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'the-beest';
  version: number;
  exportedAt: string;
  workouts: Workout[];
  customExercises: CustomExercise[];
  plans: Plan[];
  planEntries: PlanEntry[];
  sessions: Session[];
}

export async function buildBackup(): Promise<BackupFile> {
  const [workouts, customExercises, plans, planEntries, sessions] = await Promise.all([
    db.workouts.toArray(),
    db.customExercises.toArray(),
    db.plans.toArray(),
    db.planEntries.toArray(),
    db.sessions.toArray(),
  ]);
  return {
    app: 'the-beest',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    workouts,
    customExercises,
    plans,
    planEntries,
    sessions,
  };
}

export async function exportBackup(): Promise<void> {
  const backup = await buildBackup();
  const date = backup.exportedAt.slice(0, 10);
  downloadFile(`the-beest-backup-${date}.json`, JSON.stringify(backup), 'application/json');
}

export function isBackup(value: unknown): value is BackupFile {
  const b = value as BackupFile;
  return Boolean(b && b.app === 'the-beest' && Array.isArray(b.workouts));
}

export interface RestoreReport {
  workouts: number;
  customExercises: number;
  plans: number;
  planEntries: number;
  sessions: number;
}

/**
 * Ripristino. Non cancella niente: i record esistenti con lo stesso id
 * vengono sovrascritti, il resto si aggiunge. Così ripristinare un backup su
 * un telefono già usato unisce invece di distruggere.
 */
export async function restoreBackup(backup: BackupFile): Promise<RestoreReport> {
  await Promise.all([
    db.workouts.bulkPut(backup.workouts ?? []),
    db.customExercises.bulkPut(backup.customExercises ?? []),
    db.plans.bulkPut(backup.plans ?? []),
    db.planEntries.bulkPut(backup.planEntries ?? []),
    db.sessions.bulkPut(backup.sessions ?? []),
  ]);

  await loadWorkouts();
  await Promise.all([loadSessions(), loadPlans()]);

  return {
    workouts: backup.workouts?.length ?? 0,
    customExercises: backup.customExercises?.length ?? 0,
    plans: backup.plans?.length ?? 0,
    planEntries: backup.planEntries?.length ?? 0,
    sessions: backup.sessions?.length ?? 0,
  };
}

/** Storico in CSV, per chi vuole farci i grafici per conto suo. */
export async function exportHistoryCsv(): Promise<void> {
  const sessions = (await db.sessions.toArray()).sort((a, b) => a.startedAt - b.startedAt);
  const rows: (string | number | undefined)[][] = [];

  for (const session of sessions) {
    for (const entry of session.entries) {
      const done = entry.setLogs.filter((l) => l.done);
      if (!done.length) continue;
      const best = bestSet(entry.setLogs);
      rows.push([
        session.date,
        session.name,
        entry.name,
        done.length,
        done.map((l) => l.reps).join('+'),
        best?.weight,
        done.reduce((s, l) => s + (l.weight ? l.reps * l.weight : 0), 0),
      ]);
    }
  }

  const csv = toCsv(
    ['data', 'allenamento', 'esercizio', 'serie', 'ripetizioni', 'carico max', 'volume'],
    rows
  );
  // Il BOM fa aprire gli accenti correttamente in Excel su Windows.
  downloadFile(`the-beest-storico-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${csv}`, 'text/csv');
}

/** Due numeri per dire all'utente quanto ha da perdere. */
export async function backupStats(): Promise<{ sessions: number; workouts: number; lastSession?: string }> {
  const [sessions, workouts] = await Promise.all([db.sessions.toArray(), db.workouts.count()]);
  const last = sessions.sort((a, b) => b.startedAt - a.startedAt)[0];
  return { sessions: sessions.length, workouts, lastSession: last?.date };
}

export { countDoneSets, sessionVolume };
