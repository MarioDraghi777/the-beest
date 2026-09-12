import { describe, expect, it } from 'vitest';
import {
  addDays,
  adherence,
  blockOfWeek,
  daysBetween,
  favoYear,
  generateEntries,
  planWeeks,
  startOfWeek,
  weekOf,
  weekStreak,
  weekdayIndex,
} from './planMath';
import type { PlanBlock, Session } from '../types';

const block = (over: Partial<PlanBlock> = {}): PlanBlock => ({
  id: 'b1',
  name: 'Blocco',
  weeks: 4,
  weekPattern: ['w1', null, 'w2', null, 'w3', null, null], // lun, mer, ven
  ...over,
});

const session = (date: string, weight = 80): Session => ({
  id: `s-${date}`,
  date,
  name: 'x',
  startedAt: 0,
  entries: [{ ref: { type: 'catalog', id: '0025' }, name: 'x', setLogs: [{ reps: 10, weight, done: true }] }],
});

describe('aritmetica delle date', () => {
  it('somma giorni attraverso il cambio di mese', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
  });

  it('gestisce il 29 febbraio degli anni bisestili', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('non sposta il giorno per colpa del fuso', () => {
    // 2026-09-12 è un sabato: con toISOString in UTC+2 si leggerebbe venerdì
    expect(weekdayIndex('2026-09-12')).toBe(5);
  });

  it('la settimana comincia di lunedì', () => {
    expect(startOfWeek('2026-09-12')).toBe('2026-09-07');
    expect(weekdayIndex('2026-09-07')).toBe(0);
  });

  it('conta i giorni fra due date', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-03-01', '2026-02-01')).toBe(-28);
  });
});

describe('generazione delle sedute', () => {
  const plan = { startDate: '2026-01-05', blocks: [block()] }; // 5 gennaio = lunedì

  it('crea una seduta per ogni giorno previsto di ogni settimana', () => {
    expect(generateEntries(plan)).toHaveLength(12); // 3 a settimana × 4
  });

  it('mette le sedute nei giorni giusti', () => {
    const dates = generateEntries(plan).slice(0, 3).map((e) => e.date);
    expect(dates).toEqual(['2026-01-05', '2026-01-07', '2026-01-09']); // lun, mer, ven
  });

  it('numera le settimane a partire da 1', () => {
    const entries = generateEntries(plan);
    expect(entries[0].week).toBe(1);
    expect(entries[entries.length - 1].week).toBe(4);
  });

  it('accoda i blocchi uno dopo l\'altro senza sovrapporli', () => {
    const due = {
      startDate: '2026-01-05',
      blocks: [block({ id: 'b1', weeks: 2 }), block({ id: 'b2', weeks: 2, weekPattern: ['w9', null, null, null, null, null, null] })],
    };
    const entries = generateEntries(due);
    const secondo = entries.filter((e) => e.blockId === 'b2');
    expect(secondo).toHaveLength(2);
    expect(secondo[0].date).toBe('2026-01-19'); // dopo le 2 settimane del primo
    expect(secondo[0].week).toBe(3);
  });

  it('salta i giorni senza scheda', () => {
    const riposo = { startDate: '2026-01-05', blocks: [block({ weekPattern: [null, null, null, null, null, null, null] })] };
    expect(generateEntries(riposo)).toHaveLength(0);
  });
});

describe('settimane e blocchi', () => {
  const plan = { startDate: '2026-01-05', blocks: [block({ id: 'b1', weeks: 6 }), block({ id: 'b2', weeks: 13 })] };

  it('somma la durata dei blocchi', () => {
    expect(planWeeks(plan)).toBe(19);
  });

  it('dice in che settimana cade una data', () => {
    expect(weekOf(plan, '2026-01-05')).toBe(1);
    expect(weekOf(plan, '2026-01-11')).toBe(1);
    expect(weekOf(plan, '2026-01-12')).toBe(2);
  });

  it('torna 0 fuori dal piano', () => {
    expect(weekOf(plan, '2026-01-01')).toBe(0);
    expect(weekOf(plan, '2027-01-01')).toBe(0);
  });

  it('trova il blocco di una settimana con i suoi estremi', () => {
    expect(blockOfWeek(plan, 3)).toEqual({ index: 0, from: 1, to: 6 });
    expect(blockOfWeek(plan, 7)).toEqual({ index: 1, from: 7, to: 19 });
    expect(blockOfWeek(plan, 40)).toBeNull();
  });
});

describe('il favo', () => {
  const entries = [{ date: '2026-09-07' }, { date: '2026-09-09' }, { date: '2026-09-14' }];
  const sessions = [session('2026-09-07')];
  const days = favoYear(2026, entries, sessions, '2026-09-12');

  const stateOf = (date: string) => days.find((d) => d.date === date)?.state;

  it('ha una cella per ogni giorno dell\'anno', () => {
    expect(days).toHaveLength(365);
    expect(days[0].date).toBe('2026-01-01');
    expect(days[364].date).toBe('2026-12-31');
  });

  it('conta 366 giorni negli anni bisestili', () => {
    expect(favoYear(2028, [], [], '2028-06-01')).toHaveLength(366);
  });

  it('accende il giorno in cui hai chiuso un allenamento', () => {
    expect(stateOf('2026-09-07')).toBe('done');
  });

  it('segna saltato un giorno previsto e passato senza allenamento', () => {
    expect(stateOf('2026-09-09')).toBe('skipped');
  });

  it('lascia in attesa i giorni previsti che devono ancora venire', () => {
    expect(stateOf('2026-09-14')).toBe('planned');
  });

  it('tratta come riposo i giorni senza niente', () => {
    expect(stateOf('2026-09-08')).toBe('rest');
  });

  it('accende anche un allenamento non previsto dal piano', () => {
    const extra = favoYear(2026, entries, [...sessions, session('2026-09-10')], '2026-09-12');
    expect(extra.find((d) => d.date === '2026-09-10')?.state).toBe('done');
  });

  it('registra il volume del giorno', () => {
    expect(days.find((d) => d.date === '2026-09-07')?.volume).toBe(800);
  });
});

describe('serie aperta', () => {
  it('conta le settimane consecutive con almeno un allenamento', () => {
    const s = [session('2026-09-07'), session('2026-09-02'), session('2026-08-26')];
    expect(weekStreak(s, '2026-09-12')).toBe(3);
  });

  it('non azzera la serie il lunedì mattina di una settimana ancora vuota', () => {
    const s = [session('2026-09-11'), session('2026-09-04')];
    expect(weekStreak(s, '2026-09-14')).toBe(2); // lunedì nuovo, niente fatto oggi
  });

  it('si interrompe su una settimana saltata', () => {
    const s = [session('2026-09-07'), session('2026-08-24')];
    expect(weekStreak(s, '2026-09-12')).toBe(1);
  });

  it('è zero senza allenamenti', () => {
    expect(weekStreak([], '2026-09-12')).toBe(0);
  });
});

describe('aderenza', () => {
  it('è la percentuale di sedute previste e fatte', () => {
    const days = favoYear(2026, [{ date: '2026-09-07' }, { date: '2026-09-09' }], [session('2026-09-07')], '2026-09-12');
    expect(adherence(days, '2026-09-12')).toBe(50);
  });

  it('non esiste finché non c\'è niente di passato', () => {
    const days = favoYear(2026, [{ date: '2026-12-30' }], [], '2026-09-12');
    expect(adherence(days, '2026-09-12')).toBeNull();
  });
});
