import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Exercise } from '../types';
import { filterExercises } from './catalog';
import { matchesAll, normalize, similarity, tokenize } from './search';

const catalog: Exercise[] = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));

const find = (query: string) => filterExercises(catalog, { query });
const names = (query: string) => find(query).map((e) => e.name);

describe('catalogo', () => {
  it('contiene i 1.324 esercizi del dataset', () => {
    expect(catalog).toHaveLength(1324);
  });

  it('ha istruzioni italiane su ogni esercizio', () => {
    expect(catalog.every((e) => e.st.length >= 3)).toBe(true);
    expect(catalog.some((e) => /\byour\b/i.test(e.st.join(' ')))).toBe(false);
  });
});

describe('ricerca in italiano', () => {
  it('trova la panca piana cercando in italiano', () => {
    expect(names('panca piana')).toContain('barbell bench press');
  });

  it('trova le trazioni', () => {
    expect(names('trazioni')).toContain('pull-up');
  });

  it('trova lo stacco da terra', () => {
    expect(names('stacco')).toContain('barbell deadlift');
  });

  it('trova la pressa per le gambe', () => {
    expect(names('pressa').length).toBeGreaterThan(0);
    expect(names('pressa').some((n) => n.includes('leg press'))).toBe(true);
  });

  it('trova le alzate laterali', () => {
    expect(names('alzate laterali')).toContain('dumbbell lateral raise');
  });

  it('cerca anche per attrezzo in italiano', () => {
    const manubri = find('manubri');
    expect(manubri.length).toBeGreaterThan(200);
    expect(manubri.every((e) => e.q.includes('manubri'))).toBe(true);
  });
});

describe('ricerca in inglese', () => {
  it('funziona con i nomi del dataset', () => {
    expect(names('bench press').length).toBeGreaterThan(10);
  });

  it('mette in cima i risultati più pertinenti', () => {
    const top = names('bench press').slice(0, 5);
    expect(top.every((n) => n.includes('bench press'))).toBe(true);
    expect(top).toContain('barbell bench press');
  });

  it('accetta prefissi parziali', () => {
    expect(names('dumb lat rai')).toContain('dumbbell lateral raise');
  });
});

describe('filtri', () => {
  it('filtra per parte del corpo', () => {
    const petto = filterExercises(catalog, { query: '', bodyPart: 'chest' });
    expect(petto).toHaveLength(163);
    expect(petto.every((e) => e.bp === 'chest')).toBe(true);
  });

  it('combina attrezzo e ricerca', () => {
    const res = filterExercises(catalog, { query: 'curl', equipment: 'dumbbell' });
    expect(res.length).toBeGreaterThan(10);
    expect(res.every((e) => e.eq === 'dumbbell')).toBe(true);
  });

  it('filtra per muscolo anche quando è secondario', () => {
    const res = filterExercises(catalog, { query: '', muscle: 'triceps' });
    expect(res.some((e) => e.tg !== 'triceps' && e.sm.includes('triceps'))).toBe(true);
  });

  it('senza query ordina alfabeticamente', () => {
    const res = filterExercises(catalog, { query: '' });
    expect(res[0].name.localeCompare(res[1].name)).toBeLessThanOrEqual(0);
  });
});

describe('utilità di testo', () => {
  it('normalizza accenti e punteggiatura', () => {
    expect(normalize('45° Side Bend')).toBe('45 side bend');
    expect(normalize("Curl con manubri, un braccio")).toBe('curl con manubri un braccio');
  });

  it('richiede tutti i token della query', () => {
    expect(matchesAll('barbell bench press panca piana', tokenize('panca press'))).toBe(true);
    expect(matchesAll('barbell bench press panca piana', tokenize('panca squat'))).toBe(false);
  });

  it('misura la similarità per il matching degli import', () => {
    expect(similarity('panca piana', 'panca piana')).toBe(1);
    expect(similarity('panca piana', 'panca pianna')).toBeGreaterThan(0.85);
    expect(similarity('panca piana', 'squat')).toBeLessThan(0.4);
  });
});
