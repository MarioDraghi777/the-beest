import { describe, expect, it } from 'vitest';
import { estimate1RM, progressionFor, summarize, trainedExercises } from './progression';
import type { ExerciseRef, Session, SetLog } from '../types';

const panca: ExerciseRef = { type: 'catalog', id: '0025' };
const squat: ExerciseRef = { type: 'catalog', id: '0043' };

const set = (reps: number, weight?: number, done = true): SetLog => ({ reps, weight, done });

const session = (date: string, entries: Session['entries']): Session => ({
  id: `s-${date}`,
  date,
  name: 'Allenamento',
  startedAt: Date.parse(`${date}T18:00:00`),
  endedAt: Date.parse(`${date}T19:00:00`),
  entries,
});

const storico: Session[] = [
  session('2026-01-05', [{ ref: panca, name: 'panca', setLogs: [set(8, 60), set(8, 60)] }]),
  session('2026-01-12', [
    { ref: panca, name: 'panca', setLogs: [set(8, 62.5), set(8, 62.5), set(6, 65)] },
    { ref: squat, name: 'squat', setLogs: [set(5, 100)] },
  ]),
  session('2026-01-19', [{ ref: panca, name: 'panca', setLogs: [set(8, 65), set(5, 70)] }]),
];

describe('massimale stimato', () => {
  it('con una ripetizione è il carico stesso', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it('cresce con le ripetizioni', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.7, 1);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.3, 1);
  });

  it('si ferma a 12 ripetizioni, oltre la formula non vale più', () => {
    expect(estimate1RM(50, 20)).toBe(estimate1RM(50, 12));
  });

  it('non inventa numeri senza carico', () => {
    expect(estimate1RM(0, 8)).toBe(0);
  });
});

describe('esercizi allenati', () => {
  const lista = trainedExercises(storico);

  it('elenca solo quelli con serie completate', () => {
    expect(lista.map((t) => t.name)).toEqual(['panca', 'squat']);
  });

  it('conta quante volte li hai fatti', () => {
    expect(lista.find((t) => t.name === 'panca')?.sessions).toBe(3);
  });

  it('ordina dal più recente', () => {
    expect(lista[0].name).toBe('panca');
    expect(lista[0].lastDate).toBe('2026-01-19');
  });

  it('ignora le serie segnate ma non fatte', () => {
    const solo = trainedExercises([session('2026-02-01', [{ ref: panca, name: 'panca', setLogs: [set(8, 60, false)] }])]);
    expect(solo).toHaveLength(0);
  });
});

describe('curva di un esercizio', () => {
  const punti = progressionFor(storico, panca);

  it('ha un punto per sessione, in ordine di data', () => {
    expect(punti.map((p) => p.date)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
  });

  it('prende la serie più pesante di ogni giornata', () => {
    expect(punti.map((p) => p.weight)).toEqual([60, 65, 70]);
  });

  it('somma il volume della giornata', () => {
    expect(punti[0].volume).toBe(960); // 8×60 + 8×60
    expect(punti[1].volume).toBe(1390); // 8×62.5 ×2 + 6×65
  });

  it('calcola il massimale stimato del giorno', () => {
    expect(punti[2].estimated1RM).toBeCloseTo(81.7, 1); // 70 kg × 5
  });

  it('è vuota per un esercizio mai fatto', () => {
    expect(progressionFor(storico, { type: 'catalog', id: '9999' })).toHaveLength(0);
  });

  it('salta le sessioni senza carico registrato', () => {
    const con = [...storico, session('2026-01-26', [{ ref: panca, name: 'panca', setLogs: [set(10)] }])];
    expect(progressionFor(con, panca)).toHaveLength(3);
  });
});

describe('riepilogo', () => {
  const s = summarize(progressionFor(storico, panca))!;

  it('dice da dove sei partito e dove sei arrivato', () => {
    expect(s.first.weight).toBe(60);
    expect(s.last.weight).toBe(70);
  });

  it('calcola il progresso in kg e in percentuale', () => {
    expect(s.deltaWeight).toBe(10);
    expect(s.deltaPercent).toBe(17);
  });

  it('trova il massimo anche se non è l\'ultimo', () => {
    const calo = [...storico, session('2026-02-02', [{ ref: panca, name: 'panca', setLogs: [set(8, 55)] }])];
    const r = summarize(progressionFor(calo, panca))!;
    expect(r.best.weight).toBe(70);
    expect(r.deltaWeight).toBe(-5);
  });

  it('non esiste senza dati', () => {
    expect(summarize([])).toBeNull();
  });
});
