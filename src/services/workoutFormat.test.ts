import { describe, expect, it } from 'vitest';
import { countSets, estimateMinutes, summary, swap } from './workoutFormat';
import type { WorkoutItem } from '../types';

const item = (over: Partial<WorkoutItem> = {}): WorkoutItem => ({
  ref: { type: 'catalog', id: '0025' },
  sets: 4,
  reps: '8',
  restSec: 90,
  loadUnit: 'kg',
  ...over,
});

describe('conti della scheda', () => {
  it('somma le serie di tutti gli esercizi', () => {
    expect(countSets({ items: [item({ sets: 4 }), item({ sets: 3 }), item({ sets: 5 })] })).toBe(12);
  });

  it('non si rompe su una scheda vuota', () => {
    expect(countSets({ items: [] })).toBe(0);
    expect(estimateMinutes({ items: [] })).toBe(0);
  });

  it('stima la durata contando lavoro e recuperi', () => {
    // 4 serie × (30s di lavoro + 90s di recupero) = 480s = 8 minuti
    expect(estimateMinutes({ items: [item({ sets: 4, restSec: 90 })] })).toBe(8);
  });

  it('tiene conto di recuperi diversi', () => {
    const corto = estimateMinutes({ items: [item({ restSec: 30 })] });
    const lungo = estimateMinutes({ items: [item({ restSec: 180 })] });
    expect(lungo).toBeGreaterThan(corto);
  });
});

describe('riassunto di una riga', () => {
  it('mostra serie, ripetizioni, carico e recupero', () => {
    expect(summary(item({ sets: 4, reps: '8', load: 82.5, restSec: 90 }))).toBe('4×8 · 82.5 kg · rec 90″');
  });

  it('dice "corpo libero" invece di un carico', () => {
    expect(summary(item({ loadUnit: 'corpo', load: undefined }))).toContain('corpo libero');
  });

  it('omette il carico quando non c\'è', () => {
    expect(summary(item({ load: undefined }))).toBe('4×8 · rec 90″');
  });

  it('accetta ripetizioni scritte a parole', () => {
    expect(summary(item({ reps: 'max', load: undefined, restSec: 0 }))).toBe('4×max');
  });

  it('aggiunge il tempo di esecuzione quando è indicato', () => {
    expect(summary(item({ load: 60, tempo: '3-0-1-0' }))).toContain('3-0-1-0');
  });
});

describe('riordino delle righe', () => {
  const list = ['a', 'b', 'c'];

  it('sposta su', () => {
    expect(swap(list, 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('sposta giù', () => {
    expect(swap(list, 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('fuori dai bordi non fa niente', () => {
    expect(swap(list, 0, -1)).toEqual(list);
    expect(swap(list, 2, 1)).toEqual(list);
  });

  it('non modifica la lista originale', () => {
    swap(list, 0, 1);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
