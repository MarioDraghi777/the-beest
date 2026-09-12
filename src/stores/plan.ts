import { signal } from '@preact/signals';
import { db, newId } from '../db/schema';
import { generateEntries } from '../services/planMath';
import { localDate } from '../services/sessionMath';
import type { Plan, PlanBlock, PlanEntry } from '../types';
import { duplicateWorkout } from './workouts';

/**
 * Il piano annuale e le sue sedute a calendario.
 *
 * Le sedute sono materializzate (una riga per giorno previsto) invece di
 * essere calcolate al volo: solo così si può spostare il mercoledì di questa
 * settimana al giovedì senza cambiare lo schema del blocco, e solo così una
 * seduta può portarsi dietro il suo stato e la sessione che l'ha chiusa.
 */

const ACTIVE_PLAN_KEY = 'activePlanId';

export const plans = signal<Plan[]>([]);
export const entries = signal<PlanEntry[]>([]);
export const activePlanId = signal<string | null>(null);
export const plansLoaded = signal(false);

export function activePlan(): Plan | undefined {
  return plans.value.find((p) => p.id === activePlanId.value) ?? plans.value[0];
}

export function planEntries(planId?: string): PlanEntry[] {
  const id = planId ?? activePlan()?.id;
  return id ? entries.value.filter((e) => e.planId === id) : [];
}

export function entriesOn(date: string): PlanEntry[] {
  return planEntries().filter((e) => e.date === date);
}

export async function loadPlans(): Promise<void> {
  const [p, e, saved] = await Promise.all([
    db.plans.toArray(),
    db.planEntries.toArray(),
    db.settings.get(ACTIVE_PLAN_KEY),
  ]);
  plans.value = p.sort((a, b) => b.updatedAt - a.updatedAt);
  entries.value = e.sort((a, b) => a.date.localeCompare(b.date));
  activePlanId.value = (saved?.value as string) ?? p[0]?.id ?? null;
  plansLoaded.value = true;
}

export async function setActivePlan(id: string): Promise<void> {
  activePlanId.value = id;
  await db.settings.put({ key: ACTIVE_PLAN_KEY, value: id });
}

/* --------------------------------------------------------- creazione piano */

export function emptyBlock(name = 'Blocco 1', weeks = 4): PlanBlock {
  return { id: newId('b'), name, weeks, weekPattern: [null, null, null, null, null, null, null] };
}

export async function createPlan(name: string, startDate: string, blocks: PlanBlock[]): Promise<Plan> {
  const now = Date.now();
  const plan: Plan = { id: newId('p'), name, startDate, blocks, createdAt: now, updatedAt: now };
  await db.plans.put(plan);
  plans.value = [plan, ...plans.value];
  await setActivePlan(plan.id);
  await rebuildEntries(plan.id);
  return plan;
}

export async function updatePlan(id: string, change: (p: Plan) => Plan): Promise<void> {
  const current = plans.value.find((p) => p.id === id);
  if (!current) return;
  const updated = { ...change(current), updatedAt: Date.now() };
  await db.plans.put(updated);
  plans.value = plans.value.map((p) => (p.id === id ? updated : p));
}

export async function deletePlan(id: string): Promise<void> {
  await db.plans.delete(id);
  await db.planEntries.where('planId').equals(id).delete();
  plans.value = plans.value.filter((p) => p.id !== id);
  entries.value = entries.value.filter((e) => e.planId !== id);
  if (activePlanId.value === id) await setActivePlan(plans.value[0]?.id ?? '');
}

/**
 * Ricostruisce le sedute dallo schema dei blocchi.
 *
 * Tocca solo il futuro: quello che è già stato fatto o saltato resta com'è,
 * e anche le sedute spostate a mano restano dove le hai messe. Riscrivere il
 * passato per far quadrare uno schema sarebbe falsificare lo storico.
 */
export async function rebuildEntries(planId: string, fromDate = localDate()): Promise<void> {
  const plan = plans.value.find((p) => p.id === planId);
  if (!plan) return;

  const keep = entries.value.filter(
    (e) => e.planId !== planId || e.date < fromDate || e.status !== 'previsto'
  );
  const removed = entries.value.filter((e) => !keep.includes(e));
  if (removed.length) await db.planEntries.bulkDelete(removed.map((e) => e.id));

  const fresh: PlanEntry[] = generateEntries(plan)
    .filter((g) => g.date >= fromDate)
    .map((g) => ({
      id: newId('e'),
      planId,
      blockId: g.blockId,
      date: g.date,
      workoutId: g.workoutId,
      status: 'previsto' as const,
    }));

  await db.planEntries.bulkPut(fresh);
  entries.value = [...keep, ...fresh].sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------------------------------------------------------- singole sedute */

async function writeEntry(entry: PlanEntry): Promise<void> {
  await db.planEntries.put(entry);
  entries.value = entries.value
    .map((e) => (e.id === entry.id ? entry : e))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function moveEntry(entryId: string, date: string): Promise<void> {
  const entry = entries.value.find((e) => e.id === entryId);
  if (entry) await writeEntry({ ...entry, date });
}

export async function skipEntry(entryId: string): Promise<void> {
  const entry = entries.value.find((e) => e.id === entryId);
  if (entry) await writeEntry({ ...entry, status: 'saltato' });
}

export async function resetEntry(entryId: string): Promise<void> {
  const entry = entries.value.find((e) => e.id === entryId);
  if (entry) await writeEntry({ ...entry, status: 'previsto', sessionId: undefined });
}

export async function deleteEntry(entryId: string): Promise<void> {
  await db.planEntries.delete(entryId);
  entries.value = entries.value.filter((e) => e.id !== entryId);
}

export async function addEntry(date: string, workoutId: string): Promise<void> {
  const plan = activePlan();
  if (!plan) return;
  const entry: PlanEntry = {
    id: newId('e'),
    planId: plan.id,
    blockId: plan.blocks[0]?.id ?? '',
    date,
    workoutId,
    status: 'previsto',
  };
  await db.planEntries.put(entry);
  entries.value = [...entries.value, entry].sort((a, b) => a.date.localeCompare(b.date));
}

/** Chiamata alla fine di un allenamento: accende la cella del favo. */
export async function markEntryDone(entryId: string, sessionId: string): Promise<void> {
  const entry = entries.value.find((e) => e.id === entryId);
  if (entry) await writeEntry({ ...entry, status: 'fatto', sessionId });
}

/* ----------------------------------------------------------- propagazione */

export type PropagationScope = 'questa' | 'avanti' | 'tutte';

/**
 * Prepara la modifica di una scheda dentro il piano e restituisce l'id della
 * scheda da aprire nell'editor.
 *
 * - "tutte": si modifica la scheda originale, e tutte le sedute che la usano
 *   seguono da sole, perché la puntano.
 * - "questa": si clona la scheda e si riaggancia solo questa seduta.
 * - "avanti": si clona e si riagganciano questa e tutte le successive che
 *   usavano la stessa scheda.
 *
 * Il clone è economico (una scheda sono poche righe) e rende la propagazione
 * una cosa che si capisce guardando i dati, invece di un sistema di versioni
 * da tenere allineato.
 */
export async function prepareEdit(entryId: string, scope: PropagationScope): Promise<string | null> {
  const entry = entries.value.find((e) => e.id === entryId);
  if (!entry) return null;
  if (scope === 'tutte') return entry.workoutId;

  const clone = await duplicateWorkout(entry.workoutId, undefined);
  if (!clone) return null;

  const targets = entries.value.filter((e) => {
    if (e.planId !== entry.planId || e.workoutId !== entry.workoutId) return false;
    if (e.status !== 'previsto' && e.id !== entry.id) return false;
    return scope === 'questa' ? e.id === entry.id : e.date >= entry.date;
  });

  const updated = targets.map((e) => ({ ...e, workoutId: clone.id }));
  await db.planEntries.bulkPut(updated);
  entries.value = entries.value.map((e) => updated.find((u) => u.id === e.id) ?? e);
  return clone.id;
}

/** Quante sedute future useranno la stessa scheda: serve a chiedere o no. */
export function occurrencesAhead(entryId: string): number {
  const entry = entries.value.find((e) => e.id === entryId);
  if (!entry) return 0;
  return entries.value.filter(
    (e) => e.planId === entry.planId && e.workoutId === entry.workoutId && e.date > entry.date && e.status === 'previsto'
  ).length;
}
