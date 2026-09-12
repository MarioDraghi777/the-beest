import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';
import type { PlanEntry, Workout } from '../types';

const plan = { id: 'p1', name: 'Stagione 2026' };

const entry = (over: Partial<PlanEntry> = {}): PlanEntry => ({
  id: 'e1',
  planId: 'p1',
  blockId: 'b1',
  date: '2026-09-14',
  workoutId: 'w1',
  status: 'previsto',
  ...over,
});

const workouts: Workout[] = [
  {
    id: 'w1',
    name: 'Upper A; spinta, forza',
    tags: [],
    items: [
      { ref: { type: 'catalog', id: '0025' }, sets: 4, reps: '8' },
      { ref: { type: 'catalog', id: '0091' }, sets: 3, reps: '10' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
];

const options = { time: '18:30', durationMin: 75, alarmMin: 45, sequence: 1 };
const ics = buildIcs(plan, [entry()], workouts, options);

describe('file per il calendario', () => {
  it('è un calendario valido', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
  });

  it('separa le righe con CRLF, come vuole lo standard', () => {
    expect(ics).toContain('\r\n');
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
  });

  it('mette l\'orario locale senza fuso, così resta alle 18:30 ovunque', () => {
    expect(ics).toContain('DTSTART:20260914T183000');
    expect(ics).toContain('DTEND:20260914T194500'); // +75 minuti
  });

  it('usa un UID stabile derivato dalla seduta', () => {
    expect(ics).toContain('UID:e1@the-beest.app');
  });

  it('porta il numero di revisione, che fa aggiornare gli eventi già importati', () => {
    expect(ics).toContain('SEQUENCE:1');
    const secondo = buildIcs(plan, [entry()], workouts, { ...options, sequence: 2 });
    expect(secondo).toContain('SEQUENCE:2');
    expect(secondo).toContain('UID:e1@the-beest.app'); // stesso evento, non uno nuovo
  });

  it('mette l\'avviso prima dell\'inizio', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT45M');
  });

  it('non mette nessun avviso se l\'anticipo è zero', () => {
    expect(buildIcs(plan, [entry()], workouts, { ...options, alarmMin: 0 })).not.toContain('VALARM');
  });

  it('protegge punti e virgola e virgole nei titoli', () => {
    expect(ics).toContain('Upper A\\; spinta\\, forza');
  });

  it('scrive un evento per ogni seduta', () => {
    const molte = buildIcs(
      plan,
      [entry({ id: 'e1' }), entry({ id: 'e2', date: '2026-09-16' }), entry({ id: 'e3', date: '2026-09-18' })],
      workouts,
      options
    );
    expect(molte.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it('regge una seduta la cui scheda è stata cancellata', () => {
    const orfana = buildIcs(plan, [entry({ workoutId: 'sparita' })], [], options);
    expect(orfana).toContain('SUMMARY:');
    expect(orfana).toContain('Allenamento');
  });

  it('spezza le righe troppo lunghe a 75 caratteri', () => {
    const lungo = buildIcs(
      plan,
      [entry()],
      [{ ...workouts[0], name: 'A'.repeat(120) }],
      options
    );
    const righe = lungo.split('\r\n');
    expect(righe.every((r) => r.length <= 75)).toBe(true);
  });
});
