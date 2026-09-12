import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchExercise, scoreExercise } from './importMatch';
import type { Exercise } from '../types';

const catalog: Exercise[] = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));
const canonical: Record<string, string> = JSON.parse(readFileSync('public/data/canonical.json', 'utf8'));

const best = (query: string) => matchExercise(query, catalog, canonical).candidates[0]?.exercise.name;
const kind = (query: string) => matchExercise(query, catalog, canonical).kind;

describe('riconoscimento dei nomi italiani', () => {
  const casi: [string, string][] = [
    ['Panca piana', 'barbell bench press'],
    ['Trazioni', 'pull-up'],
    ['Stacco da terra', 'barbell deadlift'],
    ['Alzate laterali', 'dumbbell lateral raise'],
    ['Curl con manubri', 'dumbbell biceps curl'],
  ];

  for (const [italiano, inglese] of casi) {
    it(`«${italiano}» trova ${inglese}`, () => {
      expect(best(italiano)).toBe(inglese);
    });
  }

  it('propone qualcosa di sensato anche per un attrezzo generico', () => {
    const r = matchExercise('Leg press', catalog, canonical);
    expect(r.candidates[0].exercise.name).toContain('leg press');
  });

  it('le traduzioni canoniche decidono senza chiedere', () => {
    expect(kind('panca piana')).toBe('automatico');
    expect(kind('stacco da terra')).toBe('automatico');
  });
});

describe('tolleranza ai refusi', () => {
  it('regge una lettera mancante', () => {
    expect(best('Panca pian')).toContain('bench press');
  });

  it('regge una lettera in più', () => {
    expect(best('Trazionii')).toContain('pull');
  });

  it('regge le abbreviazioni comuni', () => {
    expect(best('Lat machine')).toContain('pulldown');
  });
});

describe('quando chiedere conferma', () => {
  it('accetta da solo un nome inglese esatto', () => {
    expect(kind('barbell bench press')).toBe('automatico');
  });

  it('chiede conferma quando due esercizi sono quasi uguali', () => {
    // "bench press" da solo sta in decine di varianti: deve decidere una persona
    expect(kind('bench press')).toBe('incerto');
  });

  it('non propone niente per un nome che non esiste', () => {
    const r = matchExercise('Macchina infernale di zio Gino', catalog, canonical);
    expect(r.kind).toBe('nessuno');
    expect(r.candidates).toHaveLength(0);
  });

  it('non propone niente per una stringa vuota o troppo corta', () => {
    expect(matchExercise('', catalog, canonical).kind).toBe('nessuno');
    expect(matchExercise('a', catalog, canonical).kind).toBe('nessuno');
  });

  it('offre al massimo tre candidati', () => {
    expect(matchExercise('curl bicipiti ai cavi', catalog, canonical).candidates.length).toBeLessThanOrEqual(3);
  });
});

describe('punteggio', () => {
  const panca = catalog.find((e) => e.name === 'barbell bench press')!;

  it('è massimo sul nome identico', () => {
    expect(scoreExercise('barbell bench press', panca)).toBe(1);
  });

  it('è alto sull\'alias italiano', () => {
    expect(scoreExercise('panca piana', panca)).toBeGreaterThan(0.7);
  });

  it('è basso su un esercizio che non c\'entra', () => {
    expect(scoreExercise('squat', panca)).toBeLessThan(0.45);
  });

  it('non dà punteggio a una query vuota', () => {
    expect(scoreExercise('', panca)).toBe(0);
  });
});
