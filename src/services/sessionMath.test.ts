import { describe, expect, it } from 'vitest';
import {
  bestSet,
  countDoneSets,
  formatClock,
  formatDateLong,
  lastLoadFor,
  loadDelta,
  localDate,
  sessionVolume,
  setVolume,
} from './sessionMath';
import type { Session, SetLog } from '../types';

const set = (over: Partial<SetLog> = {}): SetLog => ({ reps: 8, weight: 80, done: true, ...over });

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  date: '2026-09-12',
  name: 'Upper A',
  startedAt: Date.parse('2026-09-12T18:00:00'),
  endedAt: Date.parse('2026-09-12T19:06:00'),
  entries: [{ ref: { type: 'catalog', id: '0025' }, name: 'barbell bench press', setLogs: [set(), set()] }],
  ...over,
});

describe('cronometro', () => {
  it('formatta minuti e secondi', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(90_000)).toBe('01:30');
  });

  it('passa alle ore quando serve', () => {
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });

  it('non va mai in negativo', () => {
    expect(formatClock(-5000)).toBe('00:00');
  });
});

describe('volume', () => {
  it('moltiplica ripetizioni per carico', () => {
    expect(setVolume(set({ reps: 8, weight: 80 }))).toBe(640);
  });

  it('non conta le serie non fatte', () => {
    expect(setVolume(set({ done: false }))).toBe(0);
  });

  it('non conta le serie senza carico', () => {
    expect(setVolume(set({ weight: undefined }))).toBe(0);
  });

  it('somma tutta la sessione', () => {
    expect(sessionVolume(session())).toBe(1280);
  });

  it('conta solo le serie chiuse', () => {
    const s = session({
      entries: [
        { ref: { type: 'catalog', id: '0025' }, name: 'x', setLogs: [set(), set({ done: false })] },
      ],
    });
    expect(countDoneSets(s)).toBe(1);
  });
});

describe('carico della volta prima', () => {
  const ref = { type: 'catalog', id: '0025' } as const;

  const storico: Session[] = [
    session({ id: 'vecchia', startedAt: 1000, entries: [{ ref, name: 'x', setLogs: [set({ weight: 70 })] }] }),
    session({ id: 'recente', startedAt: 5000, entries: [{ ref, name: 'x', setLogs: [set({ weight: 80 }), set({ weight: 82.5 })] }] }),
  ];

  it('prende il carico più alto della sessione più recente', () => {
    expect(lastLoadFor(storico, ref)).toBe(82.5);
  });

  it('torna indefinito se quell\'esercizio non è mai stato fatto', () => {
    expect(lastLoadFor(storico, { type: 'catalog', id: '9999' })).toBeUndefined();
  });

  it('ignora le serie non completate', () => {
    const solo = [session({ entries: [{ ref, name: 'x', setLogs: [set({ weight: 100, done: false })] }] })];
    expect(lastLoadFor(solo, ref)).toBeUndefined();
  });

  it('calcola il miglioramento rispetto alla volta prima', () => {
    expect(loadDelta(storico, ref, 85)).toBe(2.5);
    expect(loadDelta(storico, ref, 80)).toBe(-2.5);
  });

  it('non segnala nulla se il carico è identico', () => {
    expect(loadDelta(storico, ref, 82.5)).toBeUndefined();
  });
});

describe('serie migliore', () => {
  it('è la più pesante, non quella col volume più alto', () => {
    const best = bestSet([set({ reps: 10, weight: 60 }), set({ reps: 5, weight: 100 })]);
    expect(best?.weight).toBe(100);
  });

  it('a parità di carico prende quella con più ripetizioni', () => {
    const best = bestSet([set({ reps: 6, weight: 80 }), set({ reps: 9, weight: 80 })]);
    expect(best?.reps).toBe(9);
  });

  it('non esiste se non hai chiuso nessuna serie', () => {
    expect(bestSet([set({ done: false })])).toBeUndefined();
  });
});

describe('date', () => {
  it('usa il fuso locale e non sposta il giorno', () => {
    // Con toISOString un allenamento serale in Italia finirebbe al giorno dopo
    expect(localDate(new Date(2026, 8, 12, 23, 30))).toBe('2026-09-12');
  });

  it('scrive la data per esteso in italiano', () => {
    expect(formatDateLong('2026-09-12')).toBe('sabato 12 settembre');
  });
});
