import { describe, expect, it } from 'vitest';
import {
  countWireSets,
  decodePayload,
  describeItem,
  encodePayload,
  planPayload,
  workoutPayload,
  type WireSharedPlan,
  type WireSharedWorkout,
} from './shareCodec';
import type { CustomExercise, Plan, Workout } from '../types';

const item = (over = {}) => ({
  ref: { type: 'catalog' as const, id: '0025' },
  sets: 4,
  reps: '8',
  load: 82.5,
  loadUnit: 'kg' as const,
  restSec: 90,
  ...over,
});

const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 'w1',
  name: 'Upper A — Spinta',
  tags: [],
  items: [item(), item({ ref: { type: 'catalog', id: '0091' }, sets: 3, reps: '10', load: 40 })],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const customs: CustomExercise[] = [{ id: 'c1', name: 'Trazioni alla corda', createdAt: 0 }];

describe('formato compatto', () => {
  it('tiene solo quello che serve e omette i valori di default', () => {
    const payload = workoutPayload(workout(), customs);
    expect(payload.i[0]).toEqual({ e: '0025', s: 4, r: '8', w: 82.5 }); // kg e 90s sono impliciti
  });

  it('manda il nome, non l\'id, per gli esercizi custom', () => {
    const w = workout({ items: [item({ ref: { type: 'custom', id: 'c1' } })] });
    expect(workoutPayload(w, customs).i[0].x).toBe('Trazioni alla corda');
  });

  it('conserva note, tempo e superset quando ci sono', () => {
    const w = workout({ items: [item({ notes: 'presa larga', tempo: '3-0-1-0', supersetGroup: 'A' })] });
    const wire = workoutPayload(w, customs).i[0];
    expect(wire.n).toBe('presa larga');
    expect(wire.t).toBe('3-0-1-0');
    expect(wire.g).toBe('A');
  });
});

describe('andata e ritorno', () => {
  it('una scheda torna identica dopo il giro nel link', async () => {
    const payload = workoutPayload(workout(), customs);
    const back = (await decodePayload(await encodePayload(payload))) as WireSharedWorkout;
    expect(back).toEqual(payload);
  });

  it('una scheda da 8 esercizi sta in un link corto', async () => {
    const big = workout({ items: Array.from({ length: 8 }, () => item()) });
    const code = await encodePayload(workoutPayload(big, customs));
    expect(code.length).toBeLessThan(400);
  });

  it('un piano annuale sta in un link mandabile su WhatsApp', async () => {
    const plan: Plan = {
      id: 'p1',
      name: 'Stagione 2026',
      startDate: '2026-01-05',
      blocks: Array.from({ length: 4 }, (_, i) => ({
        id: `b${i}`,
        name: `Blocco ${i + 1}`,
        weeks: 13,
        weekPattern: ['w1', null, 'w2', null, 'w3', null, null],
      })),
      createdAt: 0,
      updatedAt: 0,
    };
    const workouts = ['w1', 'w2', 'w3'].map((id) => workout({ id, name: `Scheda ${id}` }));
    const code = await encodePayload(planPayload(plan, workouts, customs));
    expect(code.length).toBeLessThan(2000);
  });

  it('rifiuta un codice corrotto invece di esplodere', async () => {
    expect(await decodePayload('zNONVALIDO!!!')).toBeNull();
    expect(await decodePayload('')).toBeNull();
  });

  it('rifiuta una versione del formato che non conosce', async () => {
    const fake = { ...workoutPayload(workout(), customs), v: 99 };
    expect(await decodePayload(await encodePayload(fake))).toBeNull();
  });
});

describe('piano condiviso', () => {
  const plan: Plan = {
    id: 'p1',
    name: 'Stagione',
    startDate: '2026-01-05',
    blocks: [
      { id: 'b1', name: 'Uno', weeks: 4, weekPattern: ['w1', null, 'w2', null, 'w1', null, null] },
      { id: 'b2', name: 'Due', weeks: 4, weekPattern: ['w2', null, null, null, null, null, null] },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
  const workouts = [workout({ id: 'w1', name: 'A' }), workout({ id: 'w2', name: 'B' }), workout({ id: 'w9', name: 'Mai usata' })];

  it('porta solo le schede davvero usate dal piano', () => {
    const payload = planPayload(plan, workouts, customs);
    expect(payload.ws.map((w) => w.n)).toEqual(['A', 'B']);
  });

  it('riaggancia i giorni alle schede per posizione', () => {
    const payload = planPayload(plan, workouts, customs) as WireSharedPlan;
    expect(payload.b[0].p).toEqual([0, null, 1, null, 0, null, null]);
    expect(payload.b[1].p).toEqual([1, null, null, null, null, null, null]);
  });

  it('non si rompe se una scheda del piano è stata cancellata', () => {
    const payload = planPayload(plan, [workouts[0]], customs);
    expect(payload.ws).toHaveLength(1);
  });
});

describe('descrizione leggibile', () => {
  it('scrive serie, carico e recupero', () => {
    expect(describeItem({ s: 4, r: '8', w: 82.5 })).toBe('4×8 · 82.5 kg · rec 90″');
  });

  it('dice corpo libero quando non c\'è carico', () => {
    expect(describeItem({ s: 3, r: 'max', u: 'corpo' })).toBe('3×max · corpo libero · rec 90″');
  });

  it('somma le serie di una scheda ricevuta', () => {
    expect(countWireSets([{ s: 4, r: '8' }, { s: 3, r: '10' }])).toBe(7);
  });
});
